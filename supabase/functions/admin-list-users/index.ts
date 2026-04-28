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

        // Validação de Admin
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Token JWT ausente.');
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) throw new Error('JWT inválido.');

        const { data: adminProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
        if (!adminProfile || adminProfile.role !== 'admin') throw new Error('Acesso Negado: Apenas Admins.');

        // Buscar lista de usuários do Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
        if (authError) throw authError;

        // Buscar todos os perfis
        const { data: profiles, error: profError } = await supabaseAdmin
            .from('profiles')
            .select('id, name, role, is_active');
        if (profError) throw profError;

        // Buscar todos os vínculos de tópicos com join na tabela units
        const { data: profileUnits, error: puError } = await supabaseAdmin
            .from('profile_units')
            .select('profile_id, unit_id, units(id, name)');
        if (puError) throw puError;

        // Mesclar identidades
        const mergedUsers = authData.users.map(u => {
            const p = profiles?.find(pr => pr.id === u.id);
            const links = profileUnits?.filter(pu => pu.profile_id === u.id) ?? [];
            const unitIds = links.map(l => l.unit_id);
            const unitNames = links.map(l => (l.units as any)?.name).filter(Boolean);

            return {
                id: u.id,
                email: u.email,
                created_at: u.created_at,
                full_name: p?.name || '---',
                role: p?.role || 'commander',
                unit_ids: unitIds,
                unit_names: unitNames,
                unit_name: unitNames.length > 0 ? unitNames.join(', ') : 'Sem Tópico',
                is_active: p?.is_active ?? true
            };
        });

        return new Response(JSON.stringify({ users: mergedUsers }), {
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
