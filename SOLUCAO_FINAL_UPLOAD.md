# 🎯 SOLUÇÃO FINAL - Upload de Identidade Visual

## ✅ SITUAÇÃO RESOLVIDA

**Mudamos para usar o bucket `uploads` que já existe em produção!**

### Por que esta abordagem?

Em produção, descobrimos que:
- ✅ Existe o bucket **`uploads`** (com 8 policies)
- ❌ NÃO existe o bucket `evidencias`

**Decisão:** Usar o bucket existente para evitar criar novo bucket e garantir zero downtime.

---

## 📝 ALTERAÇÕES REALIZADAS

### 1. Frontend ✅

**[src/config/storage.ts](src/config/storage.ts)**
```typescript
// Antes:
export const STORAGE_BUCKET_UPLOADS = "evidencias";

// Depois:
export const STORAGE_BUCKET_UPLOADS = "uploads";
```

**[src/pages/admin/SettingsPanel.tsx](src/pages/admin/SettingsPanel.tsx)**
- Já usa `STORAGE_BUCKET_UPLOADS` (constante)
- Não precisa de alteração adicional

### 2. Backend (SQL Migration) ✅

**[supabase/migrations/20260310000002_fix_uploads_bucket_system_files.sql](supabase/migrations/20260310000002_fix_uploads_bucket_system_files.sql)** (NOVO)

Adiciona 3 policies específicas para arquivos `system/*`:
- `Admin Insert System Files in uploads`
- `Admin Update System Files in uploads` ⭐ (permite upsert por qualquer admin)
- `Admin Delete System Files in uploads`

---

## 🚀 DEPLOY EM PRODUÇÃO - PASSO A PASSO

### ⚠️ ORDEM DE EXECUÇÃO

1. **SQL primeiro** (criar policies)
2. **Frontend depois** (usar bucket correto)

---

### 🔴 PASSO 1: APLICAR POLICIES NO SUPABASE

Acesse: [Supabase Dashboard](https://app.supabase.com/) → Seu projeto → **SQL Editor**

Cole e execute este SQL:

```sql
-- POLICIES PARA ARQUIVOS DO SISTEMA (system/*) NO BUCKET 'uploads'

-- Permite admins inserir arquivos do sistema
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

-- Permite admins atualizar arquivos do sistema (QUALQUER admin, não apenas owner)
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

-- Permite admins deletar arquivos do sistema
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
```

✅ **Verificar:**
- Vá em **Authentication** → **Policies**
- Filtre por `storage.objects`
- Deve ver as 3 novas policies listadas

---

### 🟢 PASSO 2: DEPLOY DO FRONTEND

```bash
# Commit e push
git add .
git commit -m "fix: usa bucket uploads existente para identidade visual"
git push
```

O Vercel fará deploy automático em ~2 minutos.

**OU** force redeploy:
- [Vercel Dashboard](https://vercel.com/) → Seu projeto → "Redeploy"

---

## ✅ TESTE APÓS DEPLOY

### 1. Verificar Policies no Supabase
- Supabase > Authentication > Policies > `storage.objects`
- **Esperado:** Ver 3 policies novas com "system" no nome

### 2. Testar Upload de Logo
1. Acesse seu sistema em produção
2. Login como **admin**
3. **Configurações** > **Parâmetros Gerais**
4. Seção "Logomarca do Sistema"
5. Clique **"Fazer Upload"**
6. Selecione uma imagem PNG/JPG
7. **Esperado:**
   - ✅ Upload completa
   - ✅ Mensagem verde: "Logo atualizada com sucesso!"
   - ✅ Preview aparece
   - ❌ SEM erro "Bucket not found"

### 3. Testar Upload de Background
1. Na mesma tela, role até "Imagem de Fundo (Login)"
2. Faça upload de uma imagem
3. **Esperado:**
   - ✅ Upload funciona
   - ✅ Preview do background aparece

### 4. Verificar no Storage
1. Supabase > Storage > `uploads`
2. Deve existir uma pasta `system/`
3. Dentro dela: `logo.png` e/ou `background.jpg`

### 5. Testar Upsert
1. Faça upload da logo novamente
2. **Esperado:**
   - ✅ Arquivo substituído (upsert funciona)
   - ✅ Sem erro de permissão

---

## 🔐 SEGURANÇA

| Ação | Quem pode? | Onde? |
|------|------------|-------|
| **Upload** | ✅ Apenas admins | `uploads/system/*` |
| **Update** | ✅ Qualquer admin | `uploads/system/*` |
| **Delete** | ✅ Apenas admins | `uploads/system/*` |
| **Read** | ✅ Todos (público) | `uploads/system/*` (já existia) |

**Outros arquivos no bucket `uploads`:**
- Mantêm policies originais
- Não são afetados
- Continua exigindo `owner = auth.uid()` para update/delete

---

## 📊 COMPARAÇÃO

| Item | Antes | Depois |
|------|-------|--------|
| **Bucket usado** | ❌ `'evidencias'` (hardcoded, não existe) | ✅ `'uploads'` (via constante, existe) |
| **Erro** | ❌ "Bucket not found" | ✅ Sem erro |
| **Upload** | ❌ Falha | ✅ Funciona |
| **Upsert** | ❌ Falha (owner check) | ✅ Funciona (qualquer admin) |
| **Build** | ✅ OK | ✅ OK |
| **Downtime** | - | ✅ Zero |

---

## ❓ TROUBLESHOOTING

### Ainda vejo "Bucket not found"
**Improvável**, pois o bucket `uploads` existe. Mas se ocorrer:
- Verifique que o deploy do frontend completou
- Limpe cache do navegador
- Verifique que `src/config/storage.ts` tem `"uploads"` (não `"evidencias"`)

### Erro: "new row violates row-level security policy"
- **Causa:** Policies não foram criadas ou usuário não é admin
- **Solução:**
  1. Verifique que as 3 policies foram criadas no Supabase
  2. Confirme que você está logado como admin (`role = 'admin'` na tabela `profiles`)

### Erro: "The resource already exists" ao executar SQL
- **Causa:** Policies já foram criadas antes
- **Solução:** Ignore o erro, está tudo certo! As policies já existem.

### Upload funciona mas imagem não aparece
- **Causa:** Bucket não é público
- **Solução:**
  1. Supabase > Storage > `uploads` > Settings
  2. Verifique que "Public bucket" = **ON**

---

## 📦 ARQUIVOS MODIFICADOS

1. ✅ `src/config/storage.ts` - Mudou para `"uploads"`
2. ✅ `supabase/migrations/20260310000002_fix_uploads_bucket_system_files.sql` - Policies criadas

**ARQUIVOS OBSOLETOS** (podem ser ignorados ou removidos):
- ❌ `supabase/migrations/20260310000001_create_evidencias_bucket.sql`
- ❌ `supabase/migrations/20260310000000_fix_system_uploads_policies.sql`
- ⚠️ `CORRECAO_UPLOAD_IDENTIDADE_VISUAL.md` (contém solução antiga)

---

## ✨ RESULTADO FINAL

Após aplicar a solução:

✅ **Upload de logo funciona**
✅ **Upload de background funciona**
✅ **Upsert (atualização) funciona**
✅ **Imagens aparecem no sistema**
✅ **Zero downtime**
✅ **Usa bucket existente**
✅ **Segurança mantida (apenas admins)**
✅ **Build passa sem erros**

---

**🎯 Status:** ✅ PRONTO PARA PRODUÇÃO
**Data:** 2026-03-10
**Bucket usado:** `uploads` (existente)
**Downtime:** Zero
