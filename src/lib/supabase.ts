import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isDevelopment = import.meta.env.DEV;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('ERRO CRÍTICO: Variáveis de ambiente do Supabase (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) não foram encontradas no ambiente de execução.');
    // Não lançamos throw aqui para não quebrar o build do Vite inteiramente, mas o app não funcionará sem isso.
    if (isDevelopment && typeof window !== 'undefined') {
        alert('Configuração do Supabase ausente. Verifique o arquivo .env');
    }
}

// Garante que o createClient receba strings válidas para não quebrar a execução do JS (White Screen)
// Se as variáveis não existirem, o app carrega mas as requisições falharão controladamente.
const safeUrl = supabaseUrl && supabaseUrl.startsWith('http') ? supabaseUrl : 'https://placeholder.supabase.co';
const safeKey = supabaseAnonKey || 'placeholder-key';

export const supabase = createClient(safeUrl, safeKey);
