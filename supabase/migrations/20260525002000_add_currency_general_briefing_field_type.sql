-- Supports Brazilian currency input in general briefing attributes.

ALTER TABLE public.fields
DROP CONSTRAINT IF EXISTS fields_type_check;

ALTER TABLE public.fields
ADD CONSTRAINT fields_type_check
CHECK (type IN ('text', 'textarea', 'number', 'currency', 'percentage', 'image', 'calculated'));
