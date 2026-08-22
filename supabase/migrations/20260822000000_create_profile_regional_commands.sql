-- Vincula usuários (profiles) a Comandos Regionais, espelhando profile_units do briefing geral.

CREATE TABLE IF NOT EXISTS public.profile_regional_commands (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    regional_command_id uuid NOT NULL REFERENCES public.regional_commands(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (profile_id, regional_command_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_regional_commands_profile
ON public.profile_regional_commands (profile_id);

CREATE INDEX IF NOT EXISTS idx_profile_regional_commands_command
ON public.profile_regional_commands (regional_command_id);

ALTER TABLE public.profile_regional_commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read profile regional commands" ON public.profile_regional_commands;
CREATE POLICY "Authenticated users can read profile regional commands" ON public.profile_regional_commands
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can write profile regional commands" ON public.profile_regional_commands;
CREATE POLICY "Admins can write profile regional commands" ON public.profile_regional_commands
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Helper para RLS nas tabelas de lançamento regional.
CREATE OR REPLACE FUNCTION public.user_has_regional_command_access(command_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'commander')
    )
    OR EXISTS (
        SELECT 1 FROM public.profile_regional_commands
        WHERE profile_id = auth.uid() AND regional_command_id = command_id
    );
$$;

-- Restringe escrita de lançamentos regionais ao comando atribuído (admin/comandante: todos).
DROP POLICY IF EXISTS "Regional briefing entries write" ON public.regional_briefing_entries;
CREATE POLICY "Regional briefing entries write" ON public.regional_briefing_entries
FOR ALL USING (public.user_has_regional_command_access(regional_command_id))
WITH CHECK (public.user_has_regional_command_access(regional_command_id));

DROP POLICY IF EXISTS "Regional briefing values write" ON public.regional_briefing_values;
CREATE POLICY "Regional briefing values write" ON public.regional_briefing_values
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.regional_briefing_entries entry
        WHERE entry.id = entry_id
          AND public.user_has_regional_command_access(entry.regional_command_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.regional_briefing_entries entry
        WHERE entry.id = entry_id
          AND public.user_has_regional_command_access(entry.regional_command_id)
    )
);

DROP POLICY IF EXISTS "Regional briefing collection items write" ON public.regional_briefing_collection_items;
CREATE POLICY "Regional briefing collection items write" ON public.regional_briefing_collection_items
FOR ALL USING (public.user_has_regional_command_access(regional_command_id))
WITH CHECK (public.user_has_regional_command_access(regional_command_id));

DROP POLICY IF EXISTS "Regional briefing collection values write" ON public.regional_briefing_collection_values;
CREATE POLICY "Regional briefing collection values write" ON public.regional_briefing_collection_values
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.regional_briefing_collection_items item
        WHERE item.id = item_id
          AND public.user_has_regional_command_access(item.regional_command_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.regional_briefing_collection_items item
        WHERE item.id = item_id
          AND public.user_has_regional_command_access(item.regional_command_id)
    )
);

COMMENT ON TABLE public.profile_regional_commands IS
'Vincula editores a Comandos Regionais para o briefing regional (paridade com profile_units no briefing geral).';
