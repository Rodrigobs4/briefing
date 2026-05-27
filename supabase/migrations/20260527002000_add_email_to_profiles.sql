-- Exposes user e-mail to administrator screens without querying auth.users from the client.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email text;

CREATE INDEX IF NOT EXISTS idx_profiles_email
ON public.profiles (email);

UPDATE public.profiles AS profile
SET email = auth_user.email
FROM auth.users AS auth_user
WHERE profile.id = auth_user.id
  AND NULLIF(BTRIM(profile.email), '') IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), ''),
        NEW.email,
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'app_role'
                  AND e.enumlabel = 'commander'
            )
            THEN 'commander'::public.app_role
            ELSE 'viewer'::public.app_role
        END
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email
    WHERE public.profiles.email IS NULL
       OR public.profiles.email = '';
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles
    SET email = NEW.email
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

COMMENT ON COLUMN public.profiles.email IS
'Authentication e-mail copied at user creation for administrator selection lists.';
