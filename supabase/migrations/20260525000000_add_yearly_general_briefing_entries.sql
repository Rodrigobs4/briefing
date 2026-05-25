-- Adds explicit annual comparison support to the general briefing.
-- Existing sections and entries remain fixed (reference_year NULL).

ALTER TABLE public.data_groups
ADD COLUMN IF NOT EXISTS update_frequency text NOT NULL DEFAULT 'fixed';

ALTER TABLE public.data_groups
ADD COLUMN IF NOT EXISTS show_total boolean NOT NULL DEFAULT true;

ALTER TABLE public.data_groups
ADD COLUMN IF NOT EXISTS collection_layout text NOT NULL DEFAULT 'narrative';

ALTER TABLE public.data_groups
DROP CONSTRAINT IF EXISTS data_groups_collection_layout_check;

ALTER TABLE public.data_groups
ADD CONSTRAINT data_groups_collection_layout_check
CHECK (collection_layout IN ('narrative', 'table'));

ALTER TABLE public.data_groups
DROP CONSTRAINT IF EXISTS data_groups_update_frequency_check;

ALTER TABLE public.data_groups
ADD CONSTRAINT data_groups_update_frequency_check
CHECK (update_frequency IN ('fixed', 'yearly'));

ALTER TABLE public.data_group_entries
ADD COLUMN IF NOT EXISTS reference_year integer;

ALTER TABLE public.data_group_entries
DROP CONSTRAINT IF EXISTS data_group_entries_unit_id_data_group_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_group_entries_fixed_unique
ON public.data_group_entries (unit_id, data_group_id)
WHERE reference_year IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_group_entries_yearly_unique
ON public.data_group_entries (unit_id, data_group_id, reference_year)
WHERE reference_year IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_group_entries_reference_year
ON public.data_group_entries (data_group_id, unit_id, reference_year);

COMMENT ON COLUMN public.data_groups.update_frequency IS
'fixed for a single current record; yearly for one comparable record per reference year.';

COMMENT ON COLUMN public.data_groups.show_total IS
'Whether an annual comparison table displays its calculated Total column.';

COMMENT ON COLUMN public.data_groups.collection_layout IS
'narrative for the current summary table; table for one column per collection field.';

COMMENT ON COLUMN public.data_group_entries.reference_year IS
'Reference year for annual sections. NULL identifies fixed legacy/current entries.';
