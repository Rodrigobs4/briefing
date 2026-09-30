-- Permite que cada usuário altere apenas o próprio nome.
-- Não liberamos UPDATE direto em profiles: o usuário poderia alterar também role e vínculos.

CREATE OR REPLACE FUNCTION public.update_own_profile_name(new_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    clean_name text := btrim(regexp_replace(coalesce(new_name, ''), '\s+', ' ', 'g'));
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sessão inválida.';
    END IF;

    IF char_length(clean_name) < 3 OR char_length(clean_name) > 120 THEN
        RAISE EXCEPTION 'O nome deve ter entre 3 e 120 caracteres.';
    END IF;

    UPDATE public.profiles
    SET name = clean_name
    WHERE id = auth.uid();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Perfil não encontrado.';
    END IF;

    RETURN clean_name;
END;
$$;

REVOKE ALL ON FUNCTION public.update_own_profile_name(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_own_profile_name(text) TO authenticated;
