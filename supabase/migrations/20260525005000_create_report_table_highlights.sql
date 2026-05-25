-- Stores table color highlights separately from the user's overall report layout.

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
    CONSTRAINT report_table_highlights_location_unique
        UNIQUE (user_id, data_group_id, target, row_index, column_index)
);

CREATE INDEX IF NOT EXISTS idx_report_table_highlights_user_group
ON public.report_table_highlights (user_id, data_group_id);

ALTER TABLE public.report_table_highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own report table highlights" ON public.report_table_highlights;
CREATE POLICY "Users manage own report table highlights" ON public.report_table_highlights
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.report_table_highlights IS
'Personal table color rules applied to technical reports by section, row and column position.';
