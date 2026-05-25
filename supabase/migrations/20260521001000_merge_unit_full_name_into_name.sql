UPDATE public.units
SET name = full_name
WHERE NULLIF(BTRIM(full_name), '') IS NOT NULL;

ALTER TABLE public.units
DROP COLUMN IF EXISTS full_name;
