-- Supports administrator-defined single-choice attributes in the general briefing.

ALTER TABLE public.fields
ADD COLUMN IF NOT EXISTS enum_options jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.fields
DROP CONSTRAINT IF EXISTS fields_type_check;

ALTER TABLE public.fields
ADD CONSTRAINT fields_type_check
CHECK (type IN ('text', 'textarea', 'enum', 'number', 'currency', 'percentage', 'image', 'calculated'));

ALTER TABLE public.fields
DROP CONSTRAINT IF EXISTS fields_enum_options_array_check;

ALTER TABLE public.fields
ADD CONSTRAINT fields_enum_options_array_check
CHECK (jsonb_typeof(enum_options) = 'array');

COMMENT ON COLUMN public.fields.enum_options IS
'Ordered options for fields of type enum; selected values are stored as text.';
