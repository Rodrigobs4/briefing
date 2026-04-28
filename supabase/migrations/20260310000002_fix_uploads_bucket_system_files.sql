-- ==============================================================================
-- CORREÇÃO: POLICIES PARA UPLOAD DE IDENTIDADE VISUAL NO BUCKET 'uploads'
-- ==============================================================================
--
-- CONTEXTO: Em produção existe apenas o bucket 'uploads', não 'evidencias'
-- PROBLEMA: As policies existentes impedem admins de fazer upsert de arquivos do sistema
-- SOLUÇÃO: Adicionar policies específicas para arquivos system/* que permitem qualquer admin
--
-- ==============================================================================

-- Policy específica para INSERÇÃO de arquivos do sistema (logo, background)
-- Permite que qualquer admin insira arquivos na pasta 'system/'
CREATE POLICY "Admin Insert System Files in uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'uploads'
  AND (name LIKE 'system/%' OR name LIKE 'system\\_%')
  AND (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  )
);

-- Policy específica para ATUALIZAÇÃO de arquivos do sistema
-- Permite que qualquer admin atualize arquivos na pasta 'system/' (não apenas o owner)
-- Esta policy tem PRIORIDADE sobre a "Authenticated Update for uploads"
CREATE POLICY "Admin Update System Files in uploads"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'uploads'
  AND (name LIKE 'system/%' OR name LIKE 'system\\_%')
  AND (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  )
);

-- Policy específica para DELEÇÃO de arquivos do sistema
-- Permite que qualquer admin delete arquivos na pasta 'system/'
CREATE POLICY "Admin Delete System Files in uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'uploads'
  AND (name LIKE 'system/%' OR name LIKE 'system\\_%')
  AND (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  )
);

-- ==============================================================================
-- NOTAS:
-- 1. Estas policies são específicas para a pasta 'system/' no bucket 'uploads'
-- 2. As policies existentes permanecem ativas para outros arquivos
-- 3. Apenas admins podem fazer upload/update/delete de arquivos do sistema
-- 4. A leitura pública já é permitida pela policy "Public Access for uploads"
-- 5. O Postgres aplica policies com OR lógico, então essas policies complementam as existentes
-- ==============================================================================
