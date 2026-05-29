-- Stores administrator-defined recurring report e-mail schedules.

CREATE TABLE IF NOT EXISTS public.scheduled_report_emails (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    frequency text NOT NULL DEFAULT 'weekly',
    weekdays smallint[] NOT NULL DEFAULT ARRAY[5]::smallint[],
    day_of_month smallint,
    specific_date date,
    send_time time NOT NULL DEFAULT '08:00:00',
    schedule_timezone text NOT NULL DEFAULT 'America/Maceio',
    recipient_user_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
    recipient_emails text[] NOT NULL DEFAULT ARRAY[]::text[],
    subject text NOT NULL DEFAULT 'Relatório de Indicadores - Sistema Briefing',
    message text NOT NULL DEFAULT '',
    include_global_report_model boolean NOT NULL DEFAULT true,
    include_responsible_summary boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    last_sent_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT scheduled_report_emails_frequency_check
        CHECK (frequency IN ('weekly', 'monthly', 'specific_date')),
    CONSTRAINT scheduled_report_emails_weekdays_check
        CHECK (cardinality(weekdays) > 0 AND weekdays <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]),
    CONSTRAINT scheduled_report_emails_day_of_month_check
        CHECK (day_of_month IS NULL OR (day_of_month BETWEEN 1 AND 31)),
    CONSTRAINT scheduled_report_emails_specific_date_check
        CHECK (frequency <> 'specific_date' OR specific_date IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_report_emails_active
ON public.scheduled_report_emails (is_active, frequency, send_time);

CREATE OR REPLACE FUNCTION public.update_scheduled_report_emails_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_scheduled_report_emails_updated_at ON public.scheduled_report_emails;
CREATE TRIGGER update_scheduled_report_emails_updated_at
BEFORE UPDATE ON public.scheduled_report_emails
FOR EACH ROW EXECUTE FUNCTION public.update_scheduled_report_emails_updated_at();

ALTER TABLE public.scheduled_report_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage scheduled report emails" ON public.scheduled_report_emails;
CREATE POLICY "Admins manage scheduled report emails" ON public.scheduled_report_emails
FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

COMMENT ON TABLE public.scheduled_report_emails IS
'Recurring report e-mail schedules managed by administrators.';
