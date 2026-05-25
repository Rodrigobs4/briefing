-- ==============================================================================
-- CORRECAO DO TRIGGER DE CRIACAO DE USUARIO
-- ==============================================================================
-- Se o Auth mostrar "Database error saving new user", normalmente o problema esta
-- no trigger que cria o profile automaticamente.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role public.app_role;
BEGIN
    SELECT e.enumlabel::public.app_role
    INTO v_role
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role'
      AND e.enumlabel IN ('commander', 'viewer')
    ORDER BY CASE e.enumlabel WHEN 'commander' THEN 1 ELSE 2 END
    LIMIT 1;

    INSERT INTO public.profiles (id, name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), ''),
        v_role
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
EXCEPTION WHEN others THEN
    RAISE WARNING 'handle_new_user failed for auth user %. Error: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT role::text
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1
$$;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
FOR SELECT USING (
    id = auth.uid()
    OR public.current_user_role() IN ('admin', 'commander')
);

DROP POLICY IF EXISTS "Admins can write profiles" ON public.profiles;
CREATE POLICY "Admins can write profiles" ON public.profiles
FOR ALL USING (public.current_user_role() = 'admin')
WITH CHECK (public.current_user_role() = 'admin');
