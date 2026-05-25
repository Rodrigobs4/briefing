-- Publishes one general-report model for every authenticated user.
-- Personal models remain available only as migration history.

CREATE TABLE IF NOT EXISTS public.global_report_configurations (
    id text PRIMARY KEY DEFAULT 'general',
    configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT global_report_configurations_singleton_check CHECK (id = 'general'),
    CONSTRAINT global_report_configurations_configuration_object_check
        CHECK (jsonb_typeof(configuration) = 'object')
);

CREATE TABLE IF NOT EXISTS public.global_report_table_highlights (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    data_group_id uuid NOT NULL REFERENCES public.data_groups(id) ON DELETE CASCADE,
    target text NOT NULL CHECK (target IN ('row', 'column', 'cell')),
    row_index integer NOT NULL DEFAULT -1,
    column_index integer NOT NULL DEFAULT -1,
    color text NOT NULL CHECK (color IN ('khaki', 'blue', 'green', 'amber', 'red')),
    updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT global_report_table_highlights_position_check CHECK (
        (target = 'row' AND row_index >= 0 AND column_index = -1)
        OR (target = 'column' AND row_index = -1 AND column_index >= 0)
        OR (target = 'cell' AND row_index >= 0 AND column_index >= 0)
    ),
    CONSTRAINT global_report_table_highlights_location_unique
        UNIQUE (data_group_id, target, row_index, column_index)
);

CREATE INDEX IF NOT EXISTS idx_global_report_table_highlights_group
ON public.global_report_table_highlights (data_group_id);

INSERT INTO public.global_report_configurations (id, configuration, updated_by, updated_at)
SELECT
    'general',
    configuration.configuration,
    configuration.user_id,
    configuration.updated_at
FROM public.report_configurations AS configuration
LEFT JOIN public.profiles AS profile ON profile.id = configuration.user_id
ORDER BY (profile.role = 'admin') DESC, configuration.updated_at DESC
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.global_report_table_highlights (
    data_group_id,
    target,
    row_index,
    column_index,
    color,
    updated_by,
    updated_at
)
SELECT
    highlight.data_group_id,
    highlight.target,
    highlight.row_index,
    highlight.column_index,
    highlight.color,
    highlight.user_id,
    highlight.updated_at
FROM public.report_table_highlights AS highlight
JOIN public.global_report_configurations AS configuration
    ON configuration.updated_by = highlight.user_id
ON CONFLICT (data_group_id, target, row_index, column_index) DO NOTHING;

INSERT INTO public.global_report_table_highlights (
    data_group_id,
    target,
    row_index,
    column_index,
    color,
    updated_by,
    updated_at
)
SELECT
    data_group.id,
    rule.item->>'target',
    COALESCE((rule.item->>'rowIndex')::integer, -1),
    COALESCE((rule.item->>'columnIndex')::integer, -1),
    rule.item->>'color',
    configuration.updated_by,
    configuration.updated_at
FROM public.global_report_configurations AS configuration
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(configuration.configuration->'tableHighlights') = 'array'
            THEN configuration.configuration->'tableHighlights'
        ELSE '[]'::jsonb
    END
) AS rule(item)
JOIN public.data_groups AS data_group
    ON data_group.id::text = rule.item->>'groupId'
WHERE rule.item->>'target' IN ('row', 'column', 'cell')
  AND rule.item->>'color' IN ('khaki', 'blue', 'green', 'amber', 'red')
  AND (
      (rule.item->>'target' = 'row' AND COALESCE((rule.item->>'rowIndex')::integer, -1) >= 0)
      OR (rule.item->>'target' = 'column' AND COALESCE((rule.item->>'columnIndex')::integer, -1) >= 0)
      OR (
          rule.item->>'target' = 'cell'
          AND COALESCE((rule.item->>'rowIndex')::integer, -1) >= 0
          AND COALESCE((rule.item->>'columnIndex')::integer, -1) >= 0
      )
  )
ON CONFLICT (data_group_id, target, row_index, column_index) DO NOTHING;

ALTER TABLE public.global_report_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_report_table_highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read global report configuration" ON public.global_report_configurations;
CREATE POLICY "Authenticated users read global report configuration" ON public.global_report_configurations
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins manage global report configuration" ON public.global_report_configurations;
CREATE POLICY "Admins manage global report configuration" ON public.global_report_configurations
FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Authenticated users read global report highlights" ON public.global_report_table_highlights;
CREATE POLICY "Authenticated users read global report highlights" ON public.global_report_table_highlights
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins manage global report highlights" ON public.global_report_table_highlights;
CREATE POLICY "Admins manage global report highlights" ON public.global_report_table_highlights
FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

COMMENT ON TABLE public.global_report_configurations IS
'Singleton general-report model read by all authenticated users and managed by administrators.';

COMMENT ON TABLE public.global_report_table_highlights IS
'Global table color rules included in the administrator-defined general-report model.';
