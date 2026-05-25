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

        const { data: adminProfile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError) throw profileError;
        if (!adminProfile || adminProfile.role !== 'admin') {
            throw new Error('Acesso Negado: Apenas Admins.');
        }

        const { name, email, password, role, unitIds } = await req.json();

        if (!name || !email || !password || !role) {
            throw new Error('Nome, e-mail, senha e perfil são obrigatórios.');
        }

        const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name }
        });

        if (createError) throw createError;
        if (!created.user) throw new Error('Usuário não foi criado no Auth.');

        const { error: upsertProfileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: created.user.id,
                name,
                role,
                unit_id: null,
                is_active: true
            }, { onConflict: 'id' });

        if (upsertProfileError) throw upsertProfileError;

        const safeUnitIds: string[] = Array.isArray(unitIds) ? unitIds : [];
        if (safeUnitIds.length > 0) {
            const links = safeUnitIds.map((unitId: string) => ({
                profile_id: created.user!.id,
                unit_id: unitId
            }));

            const { error: linkError } = await supabaseAdmin
                .from('profile_units')
                .insert(links);

            if (linkError) throw linkError;
        }

        return new Response(JSON.stringify({ success: true, userId: created.user.id }), {
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
