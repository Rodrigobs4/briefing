-- ==============================================================================
-- CORREÇÃO DE POLICIES PARA UPLOAD DE IDENTIDADE VISUAL DO SISTEMA
-- ==============================================================================
--
-- ⚠️ IMPORTANTE: Esta migration DEPENDE da migration anterior:
-- 20260310000001_create_evidencias_bucket.sql
-- Certifique-se de que o bucket 'evidencias' existe antes de executar este script.
--
-- PROBLEMA: O upload de logo/background do sistema estava falhando porque:
-- 1. O bucket 'evidencias' não existia em produção (Bucket not found)
-- 2. As policies antigas exigiam que o owner do arquivo fosse o mesmo usuário
-- 3. Admins não conseguiam atualizar arquivos criados por outros admins
--
-- SOLUÇÃO: Criar policies específicas para arquivos do sistema (path 'system/*')
-- que permitem qualquer admin fazer upload/update, mas mantém segurança.
-- ==============================================================================

-- Remove policies antigas que podem causar conflito para arquivos do sistema
-- Mantemos as policies gerais, apenas adicionamos exceções para 'system/*'

-- Policy específica para INSERÇÃO de arquivos do sistema (logo, background)
-- Permite que qualquer admin insira arquivos na pasta 'system/'
CREATE POLICY "Admin Insert System Files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'evidencias'
  AND (name LIKE 'system/%' OR name LIKE 'system\\_%')
  AND (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  )
);

-- Policy específica para ATUALIZAÇÃO de arquivos do sistema
-- Permite que qualquer admin atualize arquivos na pasta 'system/' (não apenas o owner)
CREATE POLICY "Admin Update System Files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'evidencias'
  AND (name LIKE 'system/%' OR name LIKE 'system\\_%')
  AND (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  )
);

-- Policy específica para DELEÇÃO de arquivos do sistema
-- Permite que qualquer admin delete arquivos na pasta 'system/'
CREATE POLICY "Admin Delete System Files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'evidencias'
  AND (name LIKE 'system/%' OR name LIKE 'system\\_%')
  AND (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  )
);

-- Policy de LEITURA pública para arquivos do sistema
-- Permite que todos (até não autenticados) vejam logo e background
CREATE POLICY "Public Read System Files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'evidencias'
  AND (name LIKE 'system/%' OR name LIKE 'system\\_%')
);

-- ==============================================================================
-- NOTAS:
-- 1. Estas policies são específicas para a pasta 'system/' no bucket 'evidencias'
-- 2. As policies existentes para outros arquivos permanecem inalteradas
-- 3. Apenas admins podem fazer upload/update/delete de arquivos do sistema
-- 4. Qualquer pessoa pode visualizar os arquivos do sistema (logo, background)
-- 5. O padrão 'system/%' ou 'system\\_%' garante compatibilidade com diferentes escapings
-- ==============================================================================
