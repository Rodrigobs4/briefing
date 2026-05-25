ALTER TABLE public.units
ADD COLUMN IF NOT EXISTS responsible_sector text;

CREATE INDEX IF NOT EXISTS idx_units_responsible_sector
ON public.units (responsible_sector);
