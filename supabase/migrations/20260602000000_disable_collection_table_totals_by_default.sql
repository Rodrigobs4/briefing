-- Collection tables should opt in to the calculated Total column.

UPDATE public.data_groups
SET show_total = false
WHERE mode = 'collection'
  AND collection_layout = 'table';

COMMENT ON COLUMN public.data_groups.show_total IS
'Whether comparison tables or collection column tables display their calculated Total column.';
