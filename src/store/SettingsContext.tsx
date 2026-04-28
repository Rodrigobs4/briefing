import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export interface SystemSettings {
    id: string;
    name: string;
    logo_path: string | null;
    bg_path: string | null;
    bg_size: string;
    bg_position: string;
    timezone: string;
    language: string;
    smtp_server?: string;
    smtp_port?: number;
    smtp_user?: string;
    smtp_pass?: string;
    smtp_from?: string;
    notification_deadlines?: any[];
    notification_channels?: any[];
}

interface SettingsContextType {
    settings: SystemSettings | null;
    loading: boolean;
    refreshSettings: () => Promise<void>;
    updateSettings: (updates: Partial<SystemSettings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchSettings = async () => {
        setLoading(true);
        // Temos um id fixo garantido pela migration
        const { data, error } = await supabase
            .from('system_settings')
            .select('*')
            .eq('id', '00000000-0000-0000-0000-000000000001')
            .single();

        if (data && !error) {
            setSettings(data as SystemSettings);
        } else {
            console.error('Falha ao carregar system_settings', error);
            // Fallback object in case DB fails
            setSettings({
                id: '00000000-0000-0000-0000-000000000001',
                name: 'Gestão Estratégica PMBA',
                logo_path: null,
                bg_path: null,
                bg_size: 'cover',
                bg_position: 'center',
                timezone: 'Brasília (BRT) - UTC-3',
                language: 'Português (Brasil)',
                smtp_server: '',
                smtp_port: 587,
                smtp_user: '',
                smtp_pass: '',
                smtp_from: 'noreply@pmba.gov.br',
                notification_deadlines: [],
                notification_channels: []
            });
        }
        setLoading(false);
    };

    const updateSettings = async (updates: Partial<SystemSettings>) => {
        const { error } = await supabase
            .from('system_settings')
            .update(updates)
            .eq('id', '00000000-0000-0000-0000-000000000001');

        if (error) {
            console.error('Erro ao atualizar configurações:', error);
            throw error;
        }

        // Atualiza estado local imediatamente após sucesso
        setSettings(prev => prev ? { ...prev, ...updates } : null);
    };

    useEffect(() => {
        fetchSettings();

        // Escuta mudanças em tempo real se a subscription estiver ativa (opcional, pode ser util)
        const channel = supabase
            .channel('public:system_settings')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'system_settings' },
                (payload) => {
                    setSettings(payload.new as SystemSettings);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return (
        <SettingsContext.Provider value={{ settings, loading, refreshSettings: fetchSettings, updateSettings }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings deve ser usado dentro de um SettingsProvider');
    }
    return context;
}
