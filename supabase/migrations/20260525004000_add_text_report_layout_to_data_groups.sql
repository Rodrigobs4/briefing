-- Allows snapshot sections to render as a free-text note instead of a metric table.

ALTER TABLE public.data_groups
ADD COLUMN IF NOT EXISTS report_layout text NOT NULL DEFAULT 'table';

ALTER TABLE public.data_groups
DROP CONSTRAINT IF EXISTS data_groups_report_layout_check;

ALTER TABLE public.data_groups
ADD CONSTRAINT data_groups_report_layout_check
CHECK (report_layout IN ('table', 'text'));

COMMENT ON COLUMN public.data_groups.report_layout IS
'table renders indicator/value columns; text renders snapshot content as a free-text section.';
