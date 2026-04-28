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
        if (!authHeader) throw new Error('Token JWT ausente.');
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) throw new Error('JWT inválido.');

        const { data: adminProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
        if (!adminProfile || adminProfile.role !== 'admin') throw new Error('Acesso Negado: Apenas Admins.');

        const { userId, fullName, role, unitIds } = await req.json();

        if (user.id === userId && role !== 'admin') {
            throw new Error('Ação não permitida: Você não pode remover seu próprio acesso de Admin.');
        }

        const { error: profileError } = await supabaseAdmin.from('profiles').update({
            name: fullName,
            role: role,
            unit_id: null
        }).eq('id', userId);

        if (profileError) throw profileError;

        const { error: deleteError } = await supabaseAdmin
            .from('profile_units')
            .delete()
            .eq('profile_id', userId);

        if (deleteError) throw deleteError;

        const safeUnitIds: string[] = Array.isArray(unitIds) ? unitIds : [];
        if (safeUnitIds.length > 0) {
            const links = safeUnitIds.map((uid: string) => ({ profile_id: userId, unit_id: uid }));
            const { error: linkError } = await supabaseAdmin.from('profile_units').insert(links);
            if (linkError) throw linkError;
        }

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
