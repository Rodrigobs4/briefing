import { createClient } from '@supabase/supabase-js';

type SendEmailPayload = {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    replyTo?: string;
};

type VercelRequest = {
    method?: string;
    headers: Record<string, string | string[] | undefined>;
    body?: SendEmailPayload;
};

type VercelResponse = {
    status: (statusCode: number) => VercelResponse;
    json: (body: unknown) => void;
    setHeader: (name: string, value: string) => void;
    end: () => void;
};

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const getHeader = (req: VercelRequest, name: string) => {
    const value = req.headers[name] || req.headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Método não permitido.' });
        return;
    }

    try {
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        const resendApiKey = process.env.RESEND_API_KEY;
        const from = process.env.RESEND_FROM_EMAIL || 'Sistema Briefing <noreply@briefing.pmdabahia.com.br>';

        if (!supabaseUrl) throw new Error('SUPABASE_URL não configurada na Vercel.');
        if (!supabaseAnonKey) throw new Error('SUPABASE_ANON_KEY não configurada na Vercel.');
        if (!resendApiKey) throw new Error('RESEND_API_KEY não configurada na Vercel.');

        const authHeader = getHeader(req, 'authorization');
        if (!authHeader) throw new Error('Token JWT ausente.');

        const token = authHeader.replace('Bearer ', '');
        const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
        });

        const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser(token);
        if (userError || !user) throw new Error('JWT inválido.');

        const { data: profile, error: profileError } = await supabaseUserClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError) throw profileError;
        if (!profile || profile.role !== 'admin') {
            throw new Error('Acesso Negado: Apenas administradores podem enviar e-mails do sistema.');
        }

        const payload = (req.body || {}) as Partial<SendEmailPayload>;
        const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];

        if (recipients.length === 0 || recipients.length > 10 || recipients.some(email => typeof email !== 'string')) {
            throw new Error('Informe de 1 a 10 destinatários.');
        }
        if (recipients.some(email => !isValidEmail(email))) {
            throw new Error('Há destinatários com e-mail inválido.');
        }
        if (!payload.subject?.trim()) {
            throw new Error('O assunto do e-mail é obrigatório.');
        }
        if (!payload.text?.trim() && !payload.html?.trim()) {
            throw new Error('Informe o conteúdo do e-mail em texto ou HTML.');
        }
        if (payload.replyTo && !isValidEmail(payload.replyTo)) {
            throw new Error('O e-mail de resposta é inválido.');
        }

        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from,
                to: recipients,
                subject: payload.subject.trim(),
                text: payload.text,
                html: payload.html,
                reply_to: payload.replyTo,
            }),
        });

        const result = await resendResponse.json();
        if (!resendResponse.ok) {
            throw new Error(result?.message || result?.error || 'Falha ao enviar e-mail pelo Resend.');
        }

        res.status(200).json({ success: true, id: result.id });
    } catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : 'Erro ao enviar e-mail.',
        });
    }
}
