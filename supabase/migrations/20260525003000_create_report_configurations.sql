-- Stores one reusable general-report layout per authenticated user.

CREATE TABLE IF NOT EXISTS public.report_configurations (
    user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT report_configurations_configuration_object_check
        CHECK (jsonb_typeof(configuration) = 'object')
);

ALTER TABLE public.report_configurations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own report configuration" ON public.report_configurations;
CREATE POLICY "Users manage own report configuration" ON public.report_configurations
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.report_configurations IS
'Reusable general-report selection and layout saved separately for each user.';

COMMENT ON COLUMN public.report_configurations.configuration IS
'JSON configuration for selected topics, categories, ordering and output format.';
