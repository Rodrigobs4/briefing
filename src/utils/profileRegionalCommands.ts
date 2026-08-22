import { supabase } from '../lib/supabase';

export type ProfileRegionalCommandLink = {
    profile_id: string;
    regional_command_id: string;
};

export async function fetchProfileRegionalCommandLinks(): Promise<ProfileRegionalCommandLink[]> {
    const { data, error } = await supabase
        .from('profile_regional_commands')
        .select('profile_id, regional_command_id');

    if (error) {
        throw new Error(`Erro ao carregar comandos regionais: ${error.message}`);
    }

    return data ?? [];
}

export async function syncProfileRegionalCommands(
    profileId: string,
    regionalCommandIds: string[]
): Promise<void> {
    const { error: deleteError } = await supabase
        .from('profile_regional_commands')
        .delete()
        .eq('profile_id', profileId);

    if (deleteError) {
        throw new Error(`Erro ao limpar comandos regionais: ${deleteError.message}`);
    }

    const uniqueIds = [...new Set(regionalCommandIds.filter(Boolean))];
    if (uniqueIds.length === 0) return;

    const { error: insertError } = await supabase
        .from('profile_regional_commands')
        .insert(uniqueIds.map(regional_command_id => ({
            profile_id: profileId,
            regional_command_id
        })));

    if (insertError) {
        throw new Error(`Erro ao salvar comandos regionais: ${insertError.message}`);
    }
}
