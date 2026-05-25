-- A report category identifies a topic, not each individual section.
-- Legacy section categories remain available for transitional reads.

ALTER TABLE public.units
ADD COLUMN IF NOT EXISTS report_category_title text,
ADD COLUMN IF NOT EXISTS report_category_order integer NOT NULL DEFAULT 999;

WITH preferred_category AS (
    SELECT DISTINCT ON (unit_id)
        unit_id,
        category_title,
        category_order
    FROM public.data_groups
    WHERE NULLIF(BTRIM(category_title), '') IS NOT NULL
    ORDER BY unit_id, category_order, order_index
)
UPDATE public.units AS unit
SET
    report_category_title = preferred.category_title,
    report_category_order = preferred.category_order
FROM preferred_category AS preferred
WHERE preferred.unit_id = unit.id
  AND NULLIF(BTRIM(unit.report_category_title), '') IS NULL;

CREATE INDEX IF NOT EXISTS idx_units_report_category_order
ON public.units (report_category_order, order_index);

COMMENT ON COLUMN public.units.report_category_title IS
'Report category assigned to the full topic and all of its sections.';

COMMENT ON COLUMN public.units.report_category_order IS
'Default ordering of topics by report category.';
