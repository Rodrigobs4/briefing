-- Adds monthly comparison support to snapshot sections in the general briefing.

ALTER TABLE public.data_groups
DROP CONSTRAINT IF EXISTS data_groups_update_frequency_check;

ALTER TABLE public.data_groups
ADD CONSTRAINT data_groups_update_frequency_check
CHECK (update_frequency IN ('fixed', 'monthly', 'yearly'));

ALTER TABLE public.data_group_entries
ADD COLUMN IF NOT EXISTS reference_month integer;

ALTER TABLE public.data_group_entries
DROP CONSTRAINT IF EXISTS data_group_entries_reference_month_check;

ALTER TABLE public.data_group_entries
ADD CONSTRAINT data_group_entries_reference_month_check
CHECK (reference_month IS NULL OR reference_month BETWEEN 1 AND 12);

DROP INDEX IF EXISTS idx_data_group_entries_fixed_unique;
DROP INDEX IF EXISTS idx_data_group_entries_yearly_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_group_entries_fixed_unique
ON public.data_group_entries (unit_id, data_group_id)
WHERE reference_year IS NULL AND reference_month IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_group_entries_yearly_unique
ON public.data_group_entries (unit_id, data_group_id, reference_year)
WHERE reference_year IS NOT NULL AND reference_month IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_group_entries_monthly_unique
ON public.data_group_entries (unit_id, data_group_id, reference_year, reference_month)
WHERE reference_year IS NOT NULL AND reference_month IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_group_entries_reference_month
ON public.data_group_entries (data_group_id, unit_id, reference_year, reference_month);

COMMENT ON COLUMN public.data_groups.update_frequency IS
'fixed for a single current record; monthly or yearly for comparable records by reference period.';

COMMENT ON COLUMN public.data_groups.show_total IS
'Whether a monthly or annual comparison table displays its calculated Total column.';

COMMENT ON COLUMN public.data_group_entries.reference_month IS
'Reference month (1-12) for monthly sections. NULL identifies fixed or annual entries.';
