-- Separates general briefing topics from legacy regional command rows stored in units.
-- Regional commands are authored through public.regional_commands, not public.units.

ALTER TABLE public.units
ADD COLUMN IF NOT EXISTS unit_type text NOT NULL DEFAULT 'general_topic';

ALTER TABLE public.units
DROP CONSTRAINT IF EXISTS units_unit_type_check;

ALTER TABLE public.units
ADD CONSTRAINT units_unit_type_check
CHECK (unit_type IN ('general_topic', 'regional_command'));

UPDATE public.units AS unit
SET unit_type = 'regional_command'
WHERE unit.unit_type = 'general_topic'
  AND EXISTS (
      SELECT 1
      FROM public.regional_commands AS command
      WHERE UPPER(
          TRANSLATE(BTRIM(unit.name), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')
      ) = UPPER(
          TRANSLATE(BTRIM(command.name), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')
      )
      OR UPPER(
          TRANSLATE(BTRIM(unit.name), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')
      ) = UPPER(
          TRANSLATE(BTRIM(command.code), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')
      )
  );

CREATE INDEX IF NOT EXISTS idx_units_type_order
ON public.units (unit_type, order_index, name);

COMMENT ON COLUMN public.units.unit_type IS
'general_topic for briefing topics; regional_command marks legacy rows excluded from general topic screens.';
