-- ==============================================================================
-- BASE INICIAL DO SISTEMA
-- ==============================================================================
-- Use esta migration quando o banco Supabase estiver zerado.
-- Ela cria as tabelas que as migrations posteriores assumem que ja existem.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.units (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    order_index integer NOT NULL DEFAULT 999,
    description text NOT NULL DEFAULT 'building-2',
    responsible_sector text,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL DEFAULT '',
    role public.app_role NOT NULL DEFAULT 'viewer',
    unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.profile_units (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (profile_id, unit_id)
);

CREATE TABLE IF NOT EXISTS public.data_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    title text NOT NULL,
    order_index integer NOT NULL DEFAULT 999,
    report_layout text NOT NULL DEFAULT 'table' CHECK (report_layout IN ('table', 'text')),
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.fields (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    data_group_id uuid NOT NULL REFERENCES public.data_groups(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'textarea', 'enum', 'number', 'currency', 'percentage', 'image', 'calculated')),
    required boolean NOT NULL DEFAULT false,
    order_index integer NOT NULL DEFAULT 999,
    is_active boolean NOT NULL DEFAULT true,
    enum_options jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(enum_options) = 'array'),
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.data_group_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    data_group_id uuid NOT NULL REFERENCES public.data_groups(id) ON DELETE CASCADE,
    updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (unit_id, data_group_id)
);

CREATE TABLE IF NOT EXISTS public.field_values (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id uuid NOT NULL REFERENCES public.data_group_entries(id) ON DELETE CASCADE,
    field_id uuid NOT NULL REFERENCES public.fields(id) ON DELETE CASCADE,
    value text,
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (entry_id, field_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    content text NOT NULL,
    type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
    target_role text NOT NULL DEFAULT 'all' CHECK (target_role IN ('all', 'admin', 'editor', 'viewer', 'commander')),
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.report_configurations (
    user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT report_configurations_configuration_object_check
        CHECK (jsonb_typeof(configuration) = 'object')
);

CREATE TABLE IF NOT EXISTS public.report_table_highlights (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    data_group_id uuid NOT NULL REFERENCES public.data_groups(id) ON DELETE CASCADE,
    target text NOT NULL CHECK (target IN ('row', 'column', 'cell')),
    row_index integer NOT NULL DEFAULT -1,
    column_index integer NOT NULL DEFAULT -1,
    color text NOT NULL CHECK (color IN ('khaki', 'blue', 'green', 'amber', 'red')),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT report_table_highlights_position_check CHECK (
        (target = 'row' AND row_index >= 0 AND column_index = -1)
        OR (target = 'column' AND row_index = -1 AND column_index >= 0)
        OR (target = 'cell' AND row_index >= 0 AND column_index >= 0)
    ),
    UNIQUE (user_id, data_group_id, target, row_index, column_index)
);

CREATE INDEX IF NOT EXISTS idx_units_order
ON public.units (order_index, name);

CREATE INDEX IF NOT EXISTS idx_profile_units_profile
ON public.profile_units (profile_id);

CREATE INDEX IF NOT EXISTS idx_profile_units_unit
ON public.profile_units (unit_id);

CREATE INDEX IF NOT EXISTS idx_data_groups_unit_order
ON public.data_groups (unit_id, order_index);

CREATE INDEX IF NOT EXISTS idx_fields_group_order
ON public.fields (data_group_id, is_active, order_index);

CREATE INDEX IF NOT EXISTS idx_data_group_entries_unit_group
ON public.data_group_entries (unit_id, data_group_id);

CREATE INDEX IF NOT EXISTS idx_field_values_entry
ON public.field_values (entry_id);

CREATE INDEX IF NOT EXISTS idx_notifications_active_created
ON public.notifications (is_active, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_data_group_entries_updated_at ON public.data_group_entries;
CREATE TRIGGER update_data_group_entries_updated_at
BEFORE UPDATE ON public.data_group_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_field_values_updated_at ON public.field_values;
CREATE TRIGGER update_field_values_updated_at
BEFORE UPDATE ON public.field_values
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Cria um profile basico quando um usuario e criado no Auth.
-- Depois voce pode ajustar role/unidades manualmente no SQL Editor.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), ''),
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'app_role'
                  AND e.enumlabel = 'commander'
            )
            THEN 'commander'::public.app_role
            ELSE 'viewer'::public.app_role
        END
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT role::text
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1
$$;

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_table_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_group_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read units" ON public.units;
CREATE POLICY "Authenticated users can read units" ON public.units
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can write units" ON public.units;
CREATE POLICY "Admins can write units" ON public.units
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
FOR SELECT USING (
    id = auth.uid()
    OR public.current_user_role() IN ('admin', 'commander')
);

DROP POLICY IF EXISTS "Admins can write profiles" ON public.profiles;
CREATE POLICY "Admins can write profiles" ON public.profiles
FOR ALL USING (public.current_user_role() = 'admin')
WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Authenticated users can read profile units" ON public.profile_units;
CREATE POLICY "Authenticated users can read profile units" ON public.profile_units
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can write profile units" ON public.profile_units;
CREATE POLICY "Admins can write profile units" ON public.profile_units
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Authenticated users can read data groups" ON public.data_groups;
CREATE POLICY "Authenticated users can read data groups" ON public.data_groups
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can write data groups" ON public.data_groups;
CREATE POLICY "Admins can write data groups" ON public.data_groups
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Authenticated users can read fields" ON public.fields;
CREATE POLICY "Authenticated users can read fields" ON public.fields
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can write fields" ON public.fields;
CREATE POLICY "Admins can write fields" ON public.fields
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Authenticated users can read data group entries" ON public.data_group_entries;
CREATE POLICY "Authenticated users can read data group entries" ON public.data_group_entries
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins and editors can write data group entries" ON public.data_group_entries;
CREATE POLICY "Admins and editors can write data group entries" ON public.data_group_entries
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
);

DROP POLICY IF EXISTS "Authenticated users can read field values" ON public.field_values;
CREATE POLICY "Authenticated users can read field values" ON public.field_values
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins and editors can write field values" ON public.field_values;
CREATE POLICY "Admins and editors can write field values" ON public.field_values
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
);

DROP POLICY IF EXISTS "Authenticated users can read notifications" ON public.notifications;
CREATE POLICY "Authenticated users can read notifications" ON public.notifications
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can write notifications" ON public.notifications;
CREATE POLICY "Admins can write notifications" ON public.notifications
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Users manage own report configuration" ON public.report_configurations;
CREATE POLICY "Users manage own report configuration" ON public.report_configurations
FOR ALL USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own report table highlights" ON public.report_table_highlights;
CREATE POLICY "Users manage own report table highlights" ON public.report_table_highlights
FOR ALL USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
