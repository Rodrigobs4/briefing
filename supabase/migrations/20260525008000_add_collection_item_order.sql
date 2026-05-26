-- Allows collection records to be manually arranged within each briefing section.

ALTER TABLE public.collection_items
ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 999;

WITH ranked_items AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY unit_id, data_group_id
            ORDER BY created_at DESC, id
        ) AS position
    FROM public.collection_items
)
UPDATE public.collection_items AS item
SET order_index = ranked.position
FROM ranked_items AS ranked
WHERE ranked.id = item.id
  AND item.order_index = 999;

CREATE INDEX IF NOT EXISTS idx_collection_items_group_order
ON public.collection_items (unit_id, data_group_id, order_index, created_at DESC);

COMMENT ON COLUMN public.collection_items.order_index IS
'Manual display order of collection records inside a general briefing section.';
