-- ==============================================================================
-- MODELO REGIONAL CORRETO
-- ==============================================================================
-- Este SQL nao transforma Comandos Regionais em unidades.
-- Ele cria:
-- 1. Comandos Regionais
-- 2. Vinculo historico entre unidades existentes e comandos
-- 3. Periodos de referencia para filtro e comparacao futura
-- 4. Catalogo de secoes/campos do briefing regional
-- 5. Lancamentos preenchidos diretamente pelo preposto regional
--
-- Modo producao segura:
-- - Nao apaga dados
-- - Nao cria unidades falsas
-- - Nao altera data_group_entries
-- - Nao altera collection_items

-- Campos mantidos apenas por compatibilidade com telas atuais.
-- A fonte correta do vinculo regional e public.unit_regional_commands.
ALTER TABLE public.units
ADD COLUMN IF NOT EXISTS region_name text,
ADD COLUMN IF NOT EXISTS regional_ascom text;

CREATE INDEX IF NOT EXISTS idx_units_region_name
ON public.units (region_name, order_index);

COMMENT ON COLUMN public.units.region_name IS 'Campo auxiliar/legado. Para o modelo regional correto, use unit_regional_commands.';
COMMENT ON COLUMN public.units.regional_ascom IS 'Campo auxiliar para exibicao do ASCOM regional.';

CREATE TABLE IF NOT EXISTS public.regional_commands (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    type text NOT NULL DEFAULT 'regional' CHECK (type IN ('regional', 'specialized')),
    headquarters_city text,
    order_index integer NOT NULL DEFAULT 999,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.unit_regional_commands (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    regional_command_id uuid NOT NULL REFERENCES public.regional_commands(id) ON DELETE CASCADE,
    started_at date NOT NULL DEFAULT DATE '2026-01-01',
    ended_at date,
    is_active boolean NOT NULL DEFAULT true,
    notes text,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unit_regional_commands_one_active
ON public.unit_regional_commands (unit_id)
WHERE is_active = true AND ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_unit_regional_commands_command
ON public.unit_regional_commands (regional_command_id, is_active, started_at);

CREATE TABLE IF NOT EXISTS public.regional_report_periods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    label text NOT NULL,
    year integer NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    period_type text NOT NULL DEFAULT 'custom' CHECK (period_type IN ('month', 'quarter', 'year', 'custom')),
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CHECK (end_date >= start_date)
);

ALTER TABLE public.regional_report_periods
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now());

CREATE UNIQUE INDEX IF NOT EXISTS idx_regional_report_periods_single_default
ON public.regional_report_periods (is_default)
WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_regional_report_periods_year_dates
ON public.regional_report_periods (year, start_date, end_date);

-- Catalogo do briefing regional.
-- Isso define o padrao do PDF sem criar Comando Regional como unidade.
CREATE TABLE IF NOT EXISTS public.regional_briefing_sections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    title text NOT NULL,
    category_title text NOT NULL,
    category_order integer NOT NULL DEFAULT 999,
    order_index integer NOT NULL DEFAULT 999,
    mode text NOT NULL DEFAULT 'snapshot' CHECK (mode IN ('snapshot', 'collection')),
    source_strategy text NOT NULL DEFAULT 'manual' CHECK (source_strategy IN ('manual', 'unit_aggregate', 'calculated', 'external')),
    update_frequency text NOT NULL DEFAULT 'custom' CHECK (update_frequency IN ('fixed', 'weekly', 'monthly', 'semester', 'yearly', 'custom')),
    description text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.regional_briefing_sections
ADD COLUMN IF NOT EXISTS update_frequency text NOT NULL DEFAULT 'custom';

ALTER TABLE public.regional_briefing_sections
ALTER COLUMN update_frequency SET DEFAULT 'custom';

UPDATE public.regional_briefing_sections
SET update_frequency = 'custom'
WHERE update_frequency IS NULL;

ALTER TABLE public.regional_briefing_sections
ALTER COLUMN update_frequency SET NOT NULL;

ALTER TABLE public.regional_briefing_sections
DROP CONSTRAINT IF EXISTS regional_briefing_sections_update_frequency_check;

ALTER TABLE public.regional_briefing_sections
ADD CONSTRAINT regional_briefing_sections_update_frequency_check
CHECK (update_frequency IN ('fixed', 'weekly', 'monthly', 'semester', 'yearly', 'custom'));

CREATE TABLE IF NOT EXISTS public.regional_briefing_fields (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id uuid NOT NULL REFERENCES public.regional_briefing_sections(id) ON DELETE CASCADE,
    code text NOT NULL,
    label text NOT NULL,
    field_type text NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'textarea', 'number', 'percentage', 'currency', 'date', 'calculated')),
    order_index integer NOT NULL DEFAULT 999,
    is_required boolean NOT NULL DEFAULT false,
    supports_comparison boolean NOT NULL DEFAULT false,
    aggregation_method text NOT NULL DEFAULT 'none' CHECK (aggregation_method IN ('none', 'sum', 'avg', 'latest', 'list', 'calculated')),
    calculation_config jsonb,
    source_config jsonb,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (section_id, code)
);

CREATE INDEX IF NOT EXISTS idx_regional_briefing_sections_order
ON public.regional_briefing_sections (is_active, category_order, order_index);

CREATE INDEX IF NOT EXISTS idx_regional_briefing_fields_order
ON public.regional_briefing_fields (section_id, is_active, order_index);

-- Entradas do briefing regional.
-- Diferente do briefing geral, estes dados pertencem ao Comando Regional,
-- nao a uma unidade operacional existente.
CREATE TABLE IF NOT EXISTS public.regional_briefing_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    regional_command_id uuid NOT NULL REFERENCES public.regional_commands(id) ON DELETE CASCADE,
    section_id uuid NOT NULL REFERENCES public.regional_briefing_sections(id) ON DELETE CASCADE,
    reference_label text,
    reference_start_date date,
    reference_end_date date,
    reference_year integer GENERATED ALWAYS AS (EXTRACT(YEAR FROM reference_start_date)::integer) STORED,
    reference_period_id uuid REFERENCES public.regional_report_periods(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CHECK (
        reference_start_date IS NULL
        OR reference_end_date IS NULL
        OR reference_end_date >= reference_start_date
    )
);

ALTER TABLE public.regional_briefing_entries
ADD COLUMN IF NOT EXISTS reference_label text,
ADD COLUMN IF NOT EXISTS reference_start_date date,
ADD COLUMN IF NOT EXISTS reference_end_date date;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'regional_briefing_entries'
          AND column_name = 'reference_year'
    ) THEN
        ALTER TABLE public.regional_briefing_entries
        ADD COLUMN reference_year integer GENERATED ALWAYS AS (EXTRACT(YEAR FROM reference_start_date)::integer) STORED;
    END IF;
END;
$$;

DROP INDEX IF EXISTS idx_regional_briefing_entries_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_regional_briefing_entries_unique_dates
ON public.regional_briefing_entries (regional_command_id, section_id, reference_start_date, reference_end_date)
WHERE reference_start_date IS NOT NULL AND reference_end_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_regional_briefing_entries_command
ON public.regional_briefing_entries (regional_command_id, reference_period_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_regional_briefing_entries_dates
ON public.regional_briefing_entries (regional_command_id, reference_year, reference_start_date, reference_end_date);

CREATE TABLE IF NOT EXISTS public.regional_briefing_values (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id uuid NOT NULL REFERENCES public.regional_briefing_entries(id) ON DELETE CASCADE,
    field_id uuid NOT NULL REFERENCES public.regional_briefing_fields(id) ON DELETE CASCADE,
    value_text text,
    value_number numeric,
    value_json jsonb,
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (entry_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_regional_briefing_values_entry
ON public.regional_briefing_values (entry_id);

CREATE TABLE IF NOT EXISTS public.regional_briefing_collection_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    regional_command_id uuid NOT NULL REFERENCES public.regional_commands(id) ON DELETE CASCADE,
    section_id uuid NOT NULL REFERENCES public.regional_briefing_sections(id) ON DELETE CASCADE,
    reference_label text,
    reference_start_date date,
    reference_end_date date,
    reference_year integer GENERATED ALWAYS AS (EXTRACT(YEAR FROM reference_start_date)::integer) STORED,
    reference_period_id uuid REFERENCES public.regional_report_periods(id) ON DELETE SET NULL,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'published',
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CHECK (
        reference_start_date IS NULL
        OR reference_end_date IS NULL
        OR reference_end_date >= reference_start_date
    )
);

ALTER TABLE public.regional_briefing_collection_items
ADD COLUMN IF NOT EXISTS reference_label text,
ADD COLUMN IF NOT EXISTS reference_start_date date,
ADD COLUMN IF NOT EXISTS reference_end_date date;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'regional_briefing_collection_items'
          AND column_name = 'reference_year'
    ) THEN
        ALTER TABLE public.regional_briefing_collection_items
        ADD COLUMN reference_year integer GENERATED ALWAYS AS (EXTRACT(YEAR FROM reference_start_date)::integer) STORED;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_regional_briefing_collection_items_command
ON public.regional_briefing_collection_items (regional_command_id, section_id, reference_period_id, status);

CREATE INDEX IF NOT EXISTS idx_regional_briefing_collection_items_dates
ON public.regional_briefing_collection_items (regional_command_id, section_id, reference_year, reference_start_date, reference_end_date, status);

CREATE TABLE IF NOT EXISTS public.regional_briefing_collection_values (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id uuid NOT NULL REFERENCES public.regional_briefing_collection_items(id) ON DELETE CASCADE,
    field_id uuid NOT NULL REFERENCES public.regional_briefing_fields(id) ON DELETE CASCADE,
    value_text text,
    value_number numeric,
    value_json jsonb,
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (item_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_regional_briefing_collection_values_item
ON public.regional_briefing_collection_values (item_id);

CREATE OR REPLACE FUNCTION public.update_regional_updated_at()
RETURNS trigger AS $$
BEGIN
    IF to_jsonb(NEW) ? 'updated_at' THEN
        NEW := jsonb_populate_record(
            NEW,
            jsonb_build_object('updated_at', timezone('utc'::text, now()))
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_regional_commands_updated_at ON public.regional_commands;
CREATE TRIGGER update_regional_commands_updated_at
BEFORE UPDATE ON public.regional_commands
FOR EACH ROW EXECUTE FUNCTION public.update_regional_updated_at();

DROP TRIGGER IF EXISTS update_unit_regional_commands_updated_at ON public.unit_regional_commands;
CREATE TRIGGER update_unit_regional_commands_updated_at
BEFORE UPDATE ON public.unit_regional_commands
FOR EACH ROW EXECUTE FUNCTION public.update_regional_updated_at();

DROP TRIGGER IF EXISTS update_regional_report_periods_updated_at ON public.regional_report_periods;
CREATE TRIGGER update_regional_report_periods_updated_at
BEFORE UPDATE ON public.regional_report_periods
FOR EACH ROW EXECUTE FUNCTION public.update_regional_updated_at();

DROP TRIGGER IF EXISTS update_regional_briefing_sections_updated_at ON public.regional_briefing_sections;
CREATE TRIGGER update_regional_briefing_sections_updated_at
BEFORE UPDATE ON public.regional_briefing_sections
FOR EACH ROW EXECUTE FUNCTION public.update_regional_updated_at();

DROP TRIGGER IF EXISTS update_regional_briefing_fields_updated_at ON public.regional_briefing_fields;
CREATE TRIGGER update_regional_briefing_fields_updated_at
BEFORE UPDATE ON public.regional_briefing_fields
FOR EACH ROW EXECUTE FUNCTION public.update_regional_updated_at();

DROP TRIGGER IF EXISTS update_regional_briefing_entries_updated_at ON public.regional_briefing_entries;
CREATE TRIGGER update_regional_briefing_entries_updated_at
BEFORE UPDATE ON public.regional_briefing_entries
FOR EACH ROW EXECUTE FUNCTION public.update_regional_updated_at();

DROP TRIGGER IF EXISTS update_regional_briefing_values_updated_at ON public.regional_briefing_values;
CREATE TRIGGER update_regional_briefing_values_updated_at
BEFORE UPDATE ON public.regional_briefing_values
FOR EACH ROW EXECUTE FUNCTION public.update_regional_updated_at();

DROP TRIGGER IF EXISTS update_regional_briefing_collection_items_updated_at ON public.regional_briefing_collection_items;
CREATE TRIGGER update_regional_briefing_collection_items_updated_at
BEFORE UPDATE ON public.regional_briefing_collection_items
FOR EACH ROW EXECUTE FUNCTION public.update_regional_updated_at();

DROP TRIGGER IF EXISTS update_regional_briefing_collection_values_updated_at ON public.regional_briefing_collection_values;
CREATE TRIGGER update_regional_briefing_collection_values_updated_at
BEFORE UPDATE ON public.regional_briefing_collection_values
FOR EACH ROW EXECUTE FUNCTION public.update_regional_updated_at();

ALTER TABLE public.regional_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_regional_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regional_report_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regional_briefing_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regional_briefing_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regional_briefing_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regional_briefing_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regional_briefing_collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regional_briefing_collection_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Regional commands read" ON public.regional_commands;
CREATE POLICY "Regional commands read" ON public.regional_commands
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Regional commands admin write" ON public.regional_commands;
CREATE POLICY "Regional commands admin write" ON public.regional_commands
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Unit regional commands read" ON public.unit_regional_commands;
CREATE POLICY "Unit regional commands read" ON public.unit_regional_commands
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Unit regional commands admin write" ON public.unit_regional_commands;
CREATE POLICY "Unit regional commands admin write" ON public.unit_regional_commands
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Regional periods read" ON public.regional_report_periods;
CREATE POLICY "Regional periods read" ON public.regional_report_periods
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Regional periods admin write" ON public.regional_report_periods;
CREATE POLICY "Regional periods admin write" ON public.regional_report_periods
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Regional briefing sections read" ON public.regional_briefing_sections;
CREATE POLICY "Regional briefing sections read" ON public.regional_briefing_sections
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Regional briefing sections admin write" ON public.regional_briefing_sections;
CREATE POLICY "Regional briefing sections admin write" ON public.regional_briefing_sections
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Regional briefing fields read" ON public.regional_briefing_fields;
CREATE POLICY "Regional briefing fields read" ON public.regional_briefing_fields
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Regional briefing fields admin write" ON public.regional_briefing_fields;
CREATE POLICY "Regional briefing fields admin write" ON public.regional_briefing_fields
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Regional briefing entries read" ON public.regional_briefing_entries;
CREATE POLICY "Regional briefing entries read" ON public.regional_briefing_entries
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Regional briefing entries write" ON public.regional_briefing_entries;
CREATE POLICY "Regional briefing entries write" ON public.regional_briefing_entries
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor')));

DROP POLICY IF EXISTS "Regional briefing values read" ON public.regional_briefing_values;
CREATE POLICY "Regional briefing values read" ON public.regional_briefing_values
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Regional briefing values write" ON public.regional_briefing_values;
CREATE POLICY "Regional briefing values write" ON public.regional_briefing_values
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor')));

DROP POLICY IF EXISTS "Regional briefing collection items read" ON public.regional_briefing_collection_items;
CREATE POLICY "Regional briefing collection items read" ON public.regional_briefing_collection_items
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Regional briefing collection items write" ON public.regional_briefing_collection_items;
CREATE POLICY "Regional briefing collection items write" ON public.regional_briefing_collection_items
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor')));

DROP POLICY IF EXISTS "Regional briefing collection values read" ON public.regional_briefing_collection_values;
CREATE POLICY "Regional briefing collection values read" ON public.regional_briefing_collection_values
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Regional briefing collection values write" ON public.regional_briefing_collection_values;
CREATE POLICY "Regional briefing collection values write" ON public.regional_briefing_collection_values
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor')));
