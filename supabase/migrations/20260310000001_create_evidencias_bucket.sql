-- ==============================================================================
-- CRIAÇÃO DO BUCKET 'evidencias' PARA UPLOADS DO SISTEMA
-- ==============================================================================
--
-- Este bucket armazena:
-- - Evidências fotográficas dos usuários (unidade/grupo/campo/*.png)
-- - Identidade visual do sistema (system/logo.*, system/background.*)
--
-- IMPORTANTE: Execute esta migration ANTES da 20260310000000_fix_system_uploads_policies.sql
-- ==============================================================================

-- Insere o bucket 'evidencias' se ainda não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidencias',
  'evidencias',
  true, -- Bucket público para permitir acesso às imagens
  5242880, -- 5MB em bytes (5 * 1024 * 1024)
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

-- Habilita RLS no bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- NOTAS:
-- 1. O bucket é público (public = true) para permitir URLs públicas das imagens
-- 2. Limite de 5MB por arquivo (adequado para fotos de evidência e backgrounds)
-- 3. Apenas formatos de imagem permitidos (segurança)
-- 4. ON CONFLICT garante que se o bucket já existir, apenas atualiza configurações
-- ==============================================================================
