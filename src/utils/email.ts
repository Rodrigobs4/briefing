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

    const data = await response.json();
    if (!response.ok || data?.error) {
        throw new Error(data?.error || 'Erro ao enviar e-mail.');
    }

    return data as { success: true; id?: string };
};
