-- Replaces one-off update deadlines with an automatic weekly schedule.
-- Day numbers follow PostgreSQL/JavaScript convention: 0 Sunday through 6 Saturday.

ALTER TABLE public.unit_update_alert_rules
ADD COLUMN IF NOT EXISTS weekdays smallint[] NOT NULL DEFAULT ARRAY[5]::smallint[],
ADD COLUMN IF NOT EXISTS deadline_time time NOT NULL DEFAULT '18:00:00',
ADD COLUMN IF NOT EXISTS schedule_timezone text NOT NULL DEFAULT 'America/Maceio';

UPDATE public.unit_update_alert_rules
SET
    weekdays = ARRAY[EXTRACT(DOW FROM due_at AT TIME ZONE schedule_timezone)::smallint],
    deadline_time = (due_at AT TIME ZONE schedule_timezone)::time
WHERE due_at IS NOT NULL;

ALTER TABLE public.unit_update_alert_rules
DROP CONSTRAINT IF EXISTS unit_update_alert_rules_dates_check;

ALTER TABLE public.unit_update_alert_rules
ALTER COLUMN due_at DROP NOT NULL;

ALTER TABLE public.unit_update_alert_rules
DROP CONSTRAINT IF EXISTS unit_update_alert_rules_weekdays_check;

ALTER TABLE public.unit_update_alert_rules
ADD CONSTRAINT unit_update_alert_rules_weekdays_check CHECK (
    cardinality(weekdays) > 0
    AND weekdays <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]
);

COMMENT ON COLUMN public.unit_update_alert_rules.starts_at IS
'Date when recurring monitoring was enabled; cycles before this moment are ignored.';

COMMENT ON COLUMN public.unit_update_alert_rules.due_at IS
'Legacy one-off deadline retained for migration history; recurring rules use weekdays and deadline_time.';

COMMENT ON COLUMN public.unit_update_alert_rules.weekdays IS
'Recurring delivery weekdays: 0 Sunday through 6 Saturday.';

COMMENT ON COLUMN public.unit_update_alert_rules.deadline_time IS
'Local deadline time applied on each selected weekday.';

COMMENT ON COLUMN public.unit_update_alert_rules.schedule_timezone IS
'Time zone used to interpret the recurring deadline schedule.';
