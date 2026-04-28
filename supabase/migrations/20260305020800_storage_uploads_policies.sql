-- Permitir que qualquer pessoa visualize arquivos no bucket 'uploads'
CREATE POLICY "Public Access for uploads" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'uploads' );

-- Permitir que usuários autenticados insiram arquivos no bucket 'uploads'
CREATE POLICY "Authenticated Insert for uploads" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK ( bucket_id = 'uploads' );

-- Permitir que usuários autenticados atualizem SEUS PRÓPRIOS arquivos (opcional, mas boa prática)
CREATE POLICY "Authenticated Update for uploads" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING ( bucket_id = 'uploads' AND owner = auth.uid() );

-- Permitir que usuários autenticados apaguem SEUS PRÓPRIOS arquivos
CREATE POLICY "Authenticated Delete for uploads" 
ON storage.objects FOR DELETE 
TO authenticated 
USING ( bucket_id = 'uploads' AND owner = auth.uid() );
