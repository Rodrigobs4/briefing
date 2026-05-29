-- Persists notification channel toggles configured by administrators.

ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS notification_channels jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.system_settings.notification_channels IS
'Administrator-configured notification channel toggles, stored as [{ id, enabled }].';
