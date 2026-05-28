import { supabase } from '../lib/supabase';

export type SendSystemEmailPayload = {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    replyTo?: string;
};

export const sendSystemEmail = async (payload: SendSystemEmailPayload) => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    const token = sessionData.session?.access_token;
    if (!token) throw new Error('Sessão expirada. Entre novamente para enviar e-mails.');

    const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let data: { success?: boolean; id?: string; error?: string } = {};

    if (responseText) {
        try {
            data = JSON.parse(responseText);
        } catch {
            throw new Error(
                'A rota de envio respondeu em formato inválido. Em desenvolvimento local, use "vercel dev" para testar /api/send-email; "npm run dev" roda apenas o frontend.'
            );
        }
    }

    if (!response.ok || data?.error) {
        throw new Error(
            data?.error ||
            'A rota de envio não retornou uma resposta válida. Verifique se /api/send-email está disponível na Vercel.'
        );
    }

    return data as { success: true; id?: string };
};
