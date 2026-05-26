-- Assigns one editor responsible for updating each general briefing topic.

ALTER TABLE public.units
ADD COLUMN IF NOT EXISTS responsible_updater_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'units_responsible_updater_id_fkey'
          AND conrelid = 'public.units'::regclass
    ) THEN
        ALTER TABLE public.units
        ADD CONSTRAINT units_responsible_updater_id_fkey
        FOREIGN KEY (responsible_updater_id)
        REFERENCES public.profiles(id)
        ON DELETE SET NULL;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_units_responsible_updater
ON public.units (responsible_updater_id);

COMMENT ON COLUMN public.units.responsible_updater_id IS
'Editor designated to keep the indicators and records of this topic updated.';
