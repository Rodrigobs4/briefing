import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Token ausente.');
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) throw new Error('JWT inválido.');

        const { data: adminProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
        if (!adminProfile || adminProfile.role !== 'admin') throw new Error('Acesso Negado: Delete requer privilégios máximos.');

        const { userId } = await req.json();

        if (user.id === userId) {
            throw new Error('Ação não permitida: Suicídio no Auth não habilitado. Você não pode deletar a si mesmo.');
        }

        await supabaseAdmin.from('profiles').delete().eq('id', userId);

        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authError) throw authError;

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
