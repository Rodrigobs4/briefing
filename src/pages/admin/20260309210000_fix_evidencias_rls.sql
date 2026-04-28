-- ==============================================================================
-- CORREÇÃO DE RLS PARA O BUCKET 'evidencias'
-- ==============================================================================

-- 1. Habilitar RLS no bucket 'evidencias' (se ainda não estiver)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas para evitar conflitos
-- (Ajuste os nomes das políticas se forem diferentes no seu ambiente)
-- Nota: As políticas de 'uploads' não devem ser removidas aqui, apenas as específicas de 'evidencias' se existirem.
-- Se não houver políticas específicas para 'evidencias', as DROP POLICY abaixo podem ser omitidas ou ajustadas.
DROP POLICY IF EXISTS "Public Access for evidencias" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Insert for evidencias" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update for evidencias" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete for evidencias" ON storage.objects;

-- 3. Novas Políticas RLS para o bucket 'evidencias'

-- Policy de LEITURA (SELECT)
-- Admins e Comandantes podem visualizar todos os arquivos.
-- Editores podem visualizar arquivos apenas se o unit_id no caminho do objeto
-- corresponder a uma de suas unidades atribuídas (via profile_units).
CREATE POLICY "RLS_Read_Evidencias" ON storage.objects
FOR SELECT USING (
  bucket_id = 'evidencias'
  AND (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'commander')
    OR
    (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'editor'
      AND split_part(name, '/', 1) IN (SELECT unit_id FROM public.profile_units WHERE profile_id = auth.uid())
    )
  )
);

-- Policy de INSERÇÃO (INSERT)
-- Admins podem inserir em qualquer lugar.
-- Editores podem inserir apenas se o unit_id no caminho do objeto
-- corresponder a uma de suas unidades atribuídas.
CREATE POLICY "RLS_Insert_Evidencias" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'evidencias'
  AND (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR
    (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'editor'
      AND split_part(name, '/', 1) IN (SELECT unit_id FROM public.profile_units WHERE profile_id = auth.uid())
    )
  )
);

-- Policy de ATUALIZAÇÃO (UPDATE)
-- Admins podem atualizar em qualquer lugar.
-- Editores podem atualizar apenas seus próprios arquivos dentro de suas unidades atribuídas.
CREATE POLICY "RLS_Update_Evidencias" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'evidencias'
  AND (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR
    (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'editor'
      AND owner = auth.uid()
      AND split_part(name, '/', 1) IN (SELECT unit_id FROM public.profile_units WHERE profile_id = auth.uid())
    )
  )
);

-- Policy de EXCLUSÃO (DELETE)
-- Admins podem excluir em qualquer lugar.
-- Editores podem excluir apenas seus próprios arquivos dentro de suas unidades atribuídas.
CREATE POLICY "RLS_Delete_Evidencias" ON storage.objects
FOR DELETE USING (
  bucket_id = 'evidencias'
  AND (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR
    (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'editor'
      AND owner = auth.uid()
      AND split_part(name, '/', 1) IN (SELECT unit_id FROM public.profile_units WHERE profile_id = auth.uid())
    )
  )
);