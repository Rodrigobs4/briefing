ALTER TABLE public.data_groups
ADD COLUMN IF NOT EXISTS category_title text,
ADD COLUMN IF NOT EXISTS category_order integer NOT NULL DEFAULT 999;

CREATE INDEX IF NOT EXISTS idx_data_groups_category_order
ON public.data_groups (unit_id, category_order, order_index);
