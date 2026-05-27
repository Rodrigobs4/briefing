-- Configures responsible sectors and data-update deadlines for general briefing topics.
-- A topic is considered updated by the application only when its sections contain actual values.

CREATE TABLE IF NOT EXISTS public.responsible_sectors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.responsible_sectors (name)
SELECT DISTINCT BTRIM(responsible_sector)
FROM public.units
WHERE NULLIF(BTRIM(responsible_sector), '') IS NOT NULL
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.units
ADD COLUMN IF NOT EXISTS responsible_sector_id uuid REFERENCES public.responsible_sectors(id) ON DELETE SET NULL;

UPDATE public.units AS unit
SET responsible_sector_id = sector.id
FROM public.responsible_sectors AS sector
WHERE unit.responsible_sector_id IS NULL
  AND BTRIM(unit.responsible_sector) = sector.name;

CREATE TABLE IF NOT EXISTS public.unit_update_alert_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id uuid NOT NULL UNIQUE REFERENCES public.units(id) ON DELETE CASCADE,
    starts_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    due_at timestamptz NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unit_update_alert_rules_dates_check CHECK (due_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_responsible_sectors_active_name
ON public.responsible_sectors (is_active, name);

CREATE INDEX IF NOT EXISTS idx_units_responsible_sector_id
ON public.units (responsible_sector_id);

CREATE INDEX IF NOT EXISTS idx_unit_update_alert_rules_due
ON public.unit_update_alert_rules (is_active, due_at, unit_id);

CREATE OR REPLACE FUNCTION public.update_alert_configuration_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_responsible_sectors_updated_at ON public.responsible_sectors;
CREATE TRIGGER update_responsible_sectors_updated_at
BEFORE UPDATE ON public.responsible_sectors
FOR EACH ROW EXECUTE FUNCTION public.update_alert_configuration_updated_at();

DROP TRIGGER IF EXISTS update_unit_update_alert_rules_updated_at ON public.unit_update_alert_rules;
CREATE TRIGGER update_unit_update_alert_rules_updated_at
BEFORE UPDATE ON public.unit_update_alert_rules
FOR EACH ROW EXECUTE FUNCTION public.update_alert_configuration_updated_at();

ALTER TABLE public.responsible_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_update_alert_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read responsible sectors" ON public.responsible_sectors;
CREATE POLICY "Authenticated users read responsible sectors" ON public.responsible_sectors
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins manage responsible sectors" ON public.responsible_sectors;
CREATE POLICY "Admins manage responsible sectors" ON public.responsible_sectors
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Authenticated users read unit update alert rules" ON public.unit_update_alert_rules;
CREATE POLICY "Authenticated users read unit update alert rules" ON public.unit_update_alert_rules
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins manage unit update alert rules" ON public.unit_update_alert_rules;
CREATE POLICY "Admins manage unit update alert rules" ON public.unit_update_alert_rules
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

COMMENT ON TABLE public.responsible_sectors IS
'Controlled list of organizational sectors responsible for general briefing topics.';

COMMENT ON TABLE public.unit_update_alert_rules IS
'Deadline cycle for confirming that a general briefing topic received actual section values.';
