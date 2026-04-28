-- ==============================================================================
-- CORREÇÃO DE RLS PARA SUPORTE A MÚLTIPLOS TÓPICOS/UNIDADES
-- ==============================================================================

-- 1. DATA_GROUP_ENTRIES (Snapshots)
-- Remove policies antigas para evitar conflitos
DROP POLICY IF EXISTS "Enable read access for all users" ON public.data_group_entries;
DROP POLICY IF EXISTS "Enable insert for users based on unit_id" ON public.data_group_entries;
DROP POLICY IF EXISTS "Enable update for users based on unit_id" ON public.data_group_entries;
DROP POLICY IF EXISTS "Editors can insert entries for their units" ON public.data_group_entries;
DROP POLICY IF EXISTS "Editors can update entries for their units" ON public.data_group_entries;
DROP POLICY IF EXISTS "Users can view entries for their units" ON public.data_group_entries;

-- Policy de LEITURA (SELECT)
CREATE POLICY "RLS_Read_DataGroupEntries" ON public.data_group_entries
FOR SELECT USING (
  -- Admins e Comandantes veem tudo
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'commander')
  OR
  -- Editores veem apenas suas unidades (Legado + Nova Tabela)
  (
    unit_id = (SELECT unit_id FROM public.profiles WHERE id = auth.uid()) -- Legado
    OR
    unit_id IN (SELECT unit_id FROM public.profile_units WHERE profile_id = auth.uid()) -- Novo
  )
);

-- Policy de INSERÇÃO (INSERT)
CREATE POLICY "RLS_Insert_DataGroupEntries" ON public.data_group_entries
FOR INSERT WITH CHECK (
  -- Admin pode inserir em qualquer lugar
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  OR
  -- Editores só inserem nas unidades que possuem vínculo
  (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'editor'
    AND
    (
      unit_id = (SELECT unit_id FROM public.profiles WHERE id = auth.uid())
      OR
      unit_id IN (SELECT unit_id FROM public.profile_units WHERE profile_id = auth.uid())
    )
  )
);

-- Policy de ATUALIZAÇÃO (UPDATE)
CREATE POLICY "RLS_Update_DataGroupEntries" ON public.data_group_entries
FOR UPDATE USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  OR
  (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'editor'
    AND
    (
      unit_id = (SELECT unit_id FROM public.profiles WHERE id = auth.uid())
      OR
      unit_id IN (SELECT unit_id FROM public.profile_units WHERE profile_id = auth.uid())
    )
  )
);


-- 2. COLLECTION_ITEMS (Coleções/Itens Múltiplos)
-- Remove policies antigas
DROP POLICY IF EXISTS "Enable read access for all users" ON public.collection_items;
DROP POLICY IF EXISTS "Enable insert for users based on unit_id" ON public.collection_items;
DROP POLICY IF EXISTS "Enable update for users based on unit_id" ON public.collection_items;
DROP POLICY IF EXISTS "Enable delete for users based on unit_id" ON public.collection_items;

-- Policy de LEITURA
CREATE POLICY "RLS_Read_CollectionItems" ON public.collection_items
FOR SELECT USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'commander')
  OR
  (
    unit_id = (SELECT unit_id FROM public.profiles WHERE id = auth.uid())
    OR
    unit_id IN (SELECT unit_id FROM public.profile_units WHERE profile_id = auth.uid())
  )
);

-- Policy de ESCRITA (INSERT/UPDATE/DELETE)
CREATE POLICY "RLS_Write_CollectionItems" ON public.collection_items
FOR ALL USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  OR
  (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'editor'
    AND
    (
      unit_id = (SELECT unit_id FROM public.profiles WHERE id = auth.uid())
      OR
      unit_id IN (SELECT unit_id FROM public.profile_units WHERE profile_id = auth.uid())
    )
  )
);

-- 3. FIELD_VALUES e COLLECTION_FIELD_VALUES
-- Geralmente herdam acesso ou são abertos para quem tem acesso ao pai, 
-- mas garantimos leitura pública autenticada para simplificar, já que o filtro principal é no Entry/Item.
ALTER TABLE public.field_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "RLS_Access_FieldValues" ON public.field_values FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE public.collection_field_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "RLS_Access_CollectionFieldValues" ON public.collection_field_values FOR ALL USING (auth.role() = 'authenticated');