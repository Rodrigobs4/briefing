-- System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_singleton BOOLEAN UNIQUE DEFAULT true, -- Garantir que exista apenas 1 linha se usar constraints genéricas
    name TEXT NOT NULL DEFAULT 'Gestão Estratégica PMBA',
    logo_path TEXT,
    bg_path TEXT,
    bg_size TEXT DEFAULT 'cover',
    bg_position TEXT DEFAULT 'center',
    timezone TEXT DEFAULT 'Brasília (BRT) - UTC-3',
    language TEXT DEFAULT 'Português (Brasil)',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id)
);

-- Habilitar RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policy 1: Todos podem ler (inclusive não logados, para tela de Login)
CREATE POLICY "Public can read system settings" ON public.system_settings
    FOR SELECT USING (true);

-- Policy 2: Apenas admin pode atualizar
CREATE POLICY "Admins can update system settings" ON public.system_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Inserir linha padrão inicial se não houver
INSERT INTO public.system_settings (id, is_singleton, name)
VALUES ('00000000-0000-0000-0000-000000000001', true, 'Gestão Estratégica PMBA')
ON CONFLICT DO NOTHING;
