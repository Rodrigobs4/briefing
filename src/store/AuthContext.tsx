import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export type Role = 'admin' | 'editor' | 'commander';

export type FieldType = 'text' | 'textarea' | 'number' | 'percentage' | 'image' | 'calculated';

export type CalculationOperation = 'sum' | 'subtract';

export interface Unit {
    id: string;
    name: string;
    full_name?: string | null;
    order_index?: number;
    description: string;
    createdAt: string;
}

export interface DataGroup {
    id: string;
    unitId: string;
    title: string;
    order: number;
    mode: 'snapshot' | 'collection';
    categoryTitle?: string | null;
    categoryOrder?: number;
}

export interface Field {
    id: string;
    dataGroupId: string;
    name: string;
    type: FieldType;
    required: boolean;
    order: number;
    isActive: boolean;
    calculationConfig?: CalculationConfig | null;
}

export interface DataGroupEntry {
    id: string;
    unitId: string;
    dataGroupId: string;
    updatedAt: string;
    updatedBy: string;
}

export interface FieldValue {
    id: string;
    entryId: string;
    fieldId: string;
    value: any;
}

export interface CollectionItem {
    id: string;
    unitId: string;
    dataGroupId: string;
    createdBy: string;
    updatedBy: string;
    isFeatured: boolean;
    status: string;
    createdAt: string;
    updatedAt: string;
}

export interface CollectionFieldValue {
    id: string;
    itemId: string;
    fieldId: string;
    valueText: string | null;
    valueNumber: number | null;
    valueJson: any | null;
    updatedAt: string;
}

export interface CalculationConfig {
    operation: CalculationOperation;
    sourceFieldIds: string[];
}

export interface Notification {
    id: string;
    title: string;
    content: string;
    type: 'info' | 'warning' | 'success' | 'error';
    target_role: 'all' | Role;
    isActive: boolean;
    createdAt: string;
    createdBy: string;
}

export interface User {
    id: string;
    name: string;
    email: string;
    role: Role;
    unitId?: string;      // legado: primeiro tópico vinculado
    unitIds?: string[];   // múltiplos tópicos vinculados
    isActive?: boolean;
}

interface DatabaseContextType {
    user: User | null;
    login: (email: string, pass: string) => Promise<void>;
    logout: () => Promise<void>;
    updateUserPassword: (password: string) => Promise<any>;
    updateUserEmail: (email: string) => Promise<any>;
    isAuthenticated: boolean;
    sessionLoading: boolean;

    units: Unit[];
    dataGroups: DataGroup[];
    fields: Field[];
    entries: DataGroupEntry[];
    fieldValues: FieldValue[];
    collectionItems: CollectionItem[];
    collectionFieldValues: CollectionFieldValue[];
    users: User[];
    notifications: Notification[];

    addUnit: (unit: Unit) => Promise<void>;
    deleteUnit: (id: string) => Promise<void>;
    addDataGroup: (group: DataGroup) => Promise<void>;
    updateDataGroup: (id: string, updates: Partial<Omit<DataGroup, 'id'>>) => Promise<void>;
    updateUnit: (id: string, updates: Partial<Omit<Unit, 'id' | 'createdAt'>>) => Promise<void>;
    deleteDataGroup: (id: string) => Promise<void>;
    addField: (field: Field) => Promise<void>;
    updateField: (id: string, updates: Partial<Field>) => Promise<void>;
    deleteField: (id: string, softDelete: boolean) => Promise<void>;

    upsertDataGroupEntry: (unitId: string, dataGroupId: string, userId: string, values: Record<string, any>) => Promise<void>;
    getEntryForGroup: (unitId: string, dataGroupId: string) => DataGroupEntry | undefined;
    getValuesForEntry: (entryId: string) => FieldValue[];
    getLatestFieldValue: (fieldId: string) => { value: any, updatedAt: string, updatedBy: string } | undefined;

    addCollectionItem: (unitId: string, dataGroupId: string, userId: string, values: Record<string, any>) => Promise<void>;
    updateCollectionItem: (itemId: string, userId: string, updates: { isFeatured?: boolean; status?: string; values?: Record<string, any> }) => Promise<void>;
    deleteCollectionItem: (itemId: string) => Promise<void>;
    getItemsForCollection: (dataGroupId: string, unitId?: string) => CollectionItem[];
    getValuesForItem: (itemId: string) => CollectionFieldValue[];

    addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'createdBy'>) => Promise<void>;
    updateNotification: (id: string, updates: Partial<Notification>) => Promise<void>;
    deleteNotification: (id: string) => Promise<void>;
}

const AuthContext = createContext<DatabaseContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [sessionLoading, setSessionLoading] = useState(true);

    const [units, setUnits] = useState<Unit[]>([]);
    const [dataGroups, setDataGroups] = useState<DataGroup[]>([]);
    const [fields, setFields] = useState<Field[]>([]);
    const [entries, setEntries] = useState<DataGroupEntry[]>([]);
    const [fieldValues, setFieldValues] = useState<FieldValue[]>([]);
    const [collectionItems, setCollectionItems] = useState<CollectionItem[]>([]);
    const [collectionFieldValues, setCollectionFieldValues] = useState<CollectionFieldValue[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                fetchUserProfile(session.user.id, session.user.email, false);
            } else {
                setSessionLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                // Eventos como USER_UPDATED (ex: troca de email) são em background e não devem congelar a tela
                const isBackground = event !== 'INITIAL_SESSION' && event !== 'SIGNED_IN';
                fetchUserProfile(session.user.id, session.user.email, isBackground);
            } else {
                setUser(null);
                clearData();
                setSessionLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchUserProfile = async (authUserId: string, authEmail?: string, isBackground = false) => {
        if (!isBackground) setSessionLoading(true);
        try {
            const { data, error } = await supabase.from('profiles').select('*').eq('id', authUserId).single();
            if (data && !error) {
                // Guard: Bloqueio sumário para inativos
                if (data.is_active === false) {
                    console.error("Usuário desativado pelo Administrador.");
                    await supabase.auth.signOut();
                    setUser(null);
                    return;
                }

                // Buscar tópicos vinculados via profile_units
                const { data: puData } = await supabase
                    .from('profile_units')
                    .select('unit_id')
                    .eq('profile_id', authUserId);

                const unitIds = puData?.map(r => r.unit_id) ?? [];

                setUser({
                    id: data.id,
                    name: data.name,
                    email: authEmail || '',
                    role: data.role as Role,
                    unitId: unitIds[0] || data.unit_id || undefined,
                    unitIds,
                    isActive: data.is_active
                });

                // Não bloqueamos mais o carregamento da sessão esperando TODOS os dados
                // Isso torna o login muito mais rápido
                if (!isBackground) setSessionLoading(false);
                
                // Busca os demais dados em "segundo plano" ou logo após liberar a UI
                await fetchAllData();
            } else {
                console.error("Falha ao buscar Profile:", error);
                setUser(null);
                if (!isBackground) setSessionLoading(false);
            }
        } catch (err) {
            console.error("Erro inesperado no fetchUserProfile:", err);
            if (!isBackground) setSessionLoading(false);
        }
    };

    const clearData = () => {
        setUnits([]); setDataGroups([]); setFields([]); setEntries([]); setFieldValues([]); setCollectionItems([]); setCollectionFieldValues([]); setUsers([]); setNotifications([]);
    };

    const fetchAllData = async () => {
        console.time('fetchAllData');
        try {
            const [u, dg, f, e, fv, ci, cfv, p, n] = await Promise.all([
                supabase.from('units').select('*'),
                supabase.from('data_groups').select('*').order('order_index', { ascending: true }),
                supabase.from('fields').select('*').order('order_index', { ascending: true }),
                supabase.from('data_group_entries').select('*'),
                supabase.from('field_values').select('*'),
                supabase.from('collection_items').select('*').order('created_at', { ascending: false }),
                supabase.from('collection_field_values').select('*'),
                supabase.from('profiles').select('*'),
                supabase.from('notifications').select('*').order('created_at', { ascending: false })
            ]);

            if (u.data) setUnits(u.data.map(d => ({ id: d.id, name: d.name, full_name: d.full_name ?? null, order_index: d.order_index ?? 999, description: d.description, createdAt: d.created_at })));
            if (dg.data) setDataGroups(dg.data.map(d => ({ id: d.id, unitId: d.unit_id, title: d.title, order: d.order_index, mode: d.mode as any, categoryTitle: d.category_title ?? null, categoryOrder: d.category_order ?? 999 })));
            if (f.data) setFields(f.data.map(d => ({ id: d.id, dataGroupId: d.data_group_id, name: d.name, type: d.type as FieldType, required: d.required, order: d.order_index, isActive: d.is_active, calculationConfig: d.calculation_config })));
            if (e.data) setEntries(e.data.map(d => ({ id: d.id, unitId: d.unit_id, dataGroupId: d.data_group_id, updatedAt: d.updated_at, updatedBy: d.updated_by })));
            if (fv.data) setFieldValues(fv.data.map(d => ({ id: d.id, entryId: d.entry_id, fieldId: d.field_id, value: d.value })));
            if (ci.data) setCollectionItems(ci.data.map(d => ({ id: d.id, unitId: d.unit_id, dataGroupId: d.data_group_id, createdBy: d.created_by, updatedBy: d.updated_by, isFeatured: d.is_featured, status: d.status, createdAt: d.created_at, updatedAt: d.updated_at })));
            if (cfv.data) setCollectionFieldValues(cfv.data.map(d => ({ id: d.id, itemId: d.item_id, fieldId: d.field_id, valueText: d.value_text, valueNumber: d.value_number, valueJson: d.value_json, updatedAt: d.updated_at })));
            if (p.data) setUsers(p.data.map(d => ({ id: d.id, name: d.name, email: 'Protegido por Regras Internas', role: d.role as Role, unitId: d.unit_id, isActive: d.is_active })));
            if (n.data) setNotifications(n.data.map(d => ({
                id: d.id,
                title: d.title,
                content: d.content,
                type: d.type as any,
                target_role: d.target_role as any,
                isActive: d.is_active,
                createdAt: d.created_at,
                createdBy: d.created_by
            })));
        } catch (error) {
            console.error("Erro ao carregar dados do banco:", error);
        } finally {
            console.timeEnd('fetchAllData');
        }
    };

    const login = async (email: string, pass: string) => {
        setSessionLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) {
            setSessionLoading(false);
            throw error;
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
    };

    const updateUserPassword = async (password: string) => {
        const { data, error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        return data;
    };

    const updateUserEmail = async (email: string) => {
        const { data, error } = await supabase.auth.updateUser({ email });
        if (error) throw error;
        return data;
    };
    const addUnit = async (u: Omit<Unit, 'createdAt'>) => {
        const { error } = await supabase.from('units').insert({
            id: u.id,
            name: u.name,
            full_name: u.full_name,
            order_index: u.order_index ?? 999,
            description: u.description
        });
        if (!error) fetchAllData();
    };

    const updateUnit = async (id: string, updates: Partial<Omit<Unit, 'id' | 'createdAt'>>) => {
        const payload: any = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.full_name !== undefined) payload.full_name = updates.full_name;
        if (updates.order_index !== undefined) payload.order_index = updates.order_index;
        if (updates.description !== undefined) payload.description = updates.description;

        const { error, data } = await supabase.from('units').update(payload).eq('id', id).select();
        if (error) {
            console.error("ERRO NO SUPABASE UPDATE UNIT:", error, payload);
            alert(`Falha ao salvar a Unidade: ${error.message}`);
        } else {
            console.log("UPDATE UNIT SUCESSO:", data);
        }
        if (!error) fetchAllData();
    };

    const deleteUnit = async (id: string) => {
        const { error } = await supabase.from('units').delete().eq('id', id);
        if (error) {
            console.error("ERRO AO DELETAR UNIDADE:", error);
            alert(`Falha ao deletar a Unidade: ${error.message}`);
        } else {
            await fetchAllData();
        }
    };

    const addDataGroup = async (group: DataGroup) => {
        const { error } = await supabase.from('data_groups').insert({ id: group.id, unit_id: group.unitId, title: group.title, order_index: group.order, mode: group.mode, category_title: group.categoryTitle ?? null, category_order: group.categoryOrder ?? 999 });
        if (error) console.error("Erro ao adicionar DataGroup:", error);
        await fetchAllData();
    };

    const updateDataGroup = async (id: string, updates: Partial<Omit<DataGroup, 'id'>>) => {
        const payload: any = {};
        if (updates.title) payload.title = updates.title;
        if (updates.order !== undefined) payload.order_index = updates.order;
        if (updates.categoryTitle !== undefined) payload.category_title = updates.categoryTitle;
        if (updates.categoryOrder !== undefined) payload.category_order = updates.categoryOrder;
        await supabase.from('data_groups').update(payload).eq('id', id);
        await fetchAllData();
    };

    const deleteDataGroup = async (id: string) => {
        await supabase.from('data_groups').delete().eq('id', id);
        await fetchAllData();
    };

    const addField = async (field: Field) => {
        const { error } = await supabase.from('fields').insert({ id: field.id, data_group_id: field.dataGroupId, name: field.name, type: field.type, required: field.required, order_index: field.order, is_active: field.isActive });
        if (error) console.error("Erro ao adicionar Field:", error);
        await fetchAllData();
    };

    const updateField = async (id: string, updates: Partial<Field>) => {
        const payload: any = {};
        if (updates.name) payload.name = updates.name;
        if (updates.type) payload.type = updates.type;
        if (updates.required !== undefined) payload.required = updates.required;
        if (updates.order !== undefined) payload.order_index = updates.order;
        if (updates.isActive !== undefined) payload.is_active = updates.isActive;
        if (updates.calculationConfig !== undefined) payload.calculation_config = updates.calculationConfig;
        await supabase.from('fields').update(payload).eq('id', id);
        await fetchAllData();
    };

    const deleteField = async (id: string, softDelete: boolean) => {
        if (softDelete) {
            await supabase.from('fields').update({ is_active: false }).eq('id', id);
        } else {
            await supabase.from('fields').delete().eq('id', id);
        }
        await fetchAllData();
    };

    const upsertDataGroupEntry = async (unitId: string, dataGroupId: string, userId: string, values: Record<string, any>) => {
        const { data: entry, error: entryErr } = await supabase.from('data_group_entries').upsert({
            unit_id: unitId,
            data_group_id: dataGroupId,
            updated_by: userId,
            updated_at: new Date().toISOString()
        }, { onConflict: 'unit_id, data_group_id' }).select().single();

        if (entry && !entryErr) {
            const fvPayload = Object.entries(values).map(([fieldId, val]) => ({
                entry_id: entry.id,
                field_id: fieldId,
                value: typeof val === 'object' ? JSON.stringify(val) : String(val)
            }));

            if (fvPayload.length > 0) {
                await supabase.from('field_values').upsert(fvPayload, { onConflict: 'entry_id, field_id' });
            }
            await fetchAllData();
        } else if (entryErr) {
            console.error(entryErr);
        }
    };

    const addCollectionItem = async (unitId: string, dataGroupId: string, userId: string, values: Record<string, any>) => {
        const { data: item, error: itemErr } = await supabase.from('collection_items').insert({
            unit_id: unitId,
            data_group_id: dataGroupId,
            created_by: userId,
            updated_by: userId
        }).select().single();

        if (item && !itemErr) {
            const cfvPayload = Object.entries(values).map(([fieldId, val]) => {
                const field = fields.find(f => f.id === fieldId);
                return {
                    item_id: item.id,
                    field_id: fieldId,
                    value_text: field?.type === 'text' || field?.type === 'textarea' ? String(val) : null,
                    value_number: field?.type === 'number' || field?.type === 'percentage' ? Number(val) : null,
                    value_json: field?.type === 'image' ? val : null
                };
            });
            if (cfvPayload.length > 0) {
                await supabase.from('collection_field_values').upsert(cfvPayload, { onConflict: 'item_id, field_id' });
            }
            await fetchAllData();
        } else if (itemErr) {
            throw itemErr;
        }
    };

    const updateCollectionItem = async (itemId: string, userId: string, updates: { isFeatured?: boolean; status?: string; values?: Record<string, any> }) => {
        const itemPayload: any = { updated_by: userId };
        if (updates.isFeatured !== undefined) itemPayload.is_featured = updates.isFeatured;
        if (updates.status !== undefined) itemPayload.status = updates.status;

        const { error: itemErr } = await supabase.from('collection_items').update(itemPayload).eq('id', itemId);
        if (itemErr) throw itemErr;

        if (updates.values) {
            // Need to merge updates
            const cfvPayload = Object.entries(updates.values).map(([fieldId, val]) => {
                const field = fields.find(f => f.id === fieldId);
                return {
                    item_id: itemId,
                    field_id: fieldId,
                    value_text: field?.type === 'text' || field?.type === 'textarea' ? String(val) : null,
                    value_number: field?.type === 'number' || field?.type === 'percentage' ? Number(val) : null,
                    value_json: field?.type === 'image' ? val : null
                };
            });
            if (cfvPayload.length > 0) {
                await supabase.from('collection_field_values').upsert(cfvPayload, { onConflict: 'item_id, field_id' });
            }
        }
        await fetchAllData();
    };

    const deleteCollectionItem = async (itemId: string) => {
        await supabase.from('collection_items').delete().eq('id', itemId);
        await fetchAllData();
    };

    const getEntryForGroup = (unitId: string, dataGroupId: string) => {
        return entries.find(e => e.unitId === unitId && e.dataGroupId === dataGroupId);
    };

    const getValuesForEntry = (entryId: string) => {
        return fieldValues.filter(fv => fv.entryId === entryId);
    };

    const getLatestFieldValue = (fieldId: string) => {
        const field = fields.find(f => f.id === fieldId);
        if (!field) return undefined;
        const groupEntries = entries.filter(e => e.dataGroupId === field.dataGroupId);
        if (groupEntries.length === 0) return undefined;

        let latestEntry: DataGroupEntry | null = null;
        let latestFv: FieldValue | null = null;
        const sortedEntries = groupEntries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        for (const entry of sortedEntries) {
            const fv = fieldValues.find(v => v.entryId === entry.id && v.fieldId === fieldId);
            if (fv) {
                latestEntry = entry;
                latestFv = fv;
                break;
            }
        }
        if (!latestFv || !latestEntry) return undefined;
        return {
            value: latestFv.value,
            updatedAt: latestEntry.updatedAt,
            updatedBy: latestEntry.updatedBy
        };
    };

    const getItemsForCollection = (dataGroupId: string, unitId?: string) => {
        let items = collectionItems.filter(i => i.dataGroupId === dataGroupId);
        if (unitId) items = items.filter(i => i.unitId === unitId);
        return items;
    };

    const getValuesForItem = (itemId: string) => {
        return collectionFieldValues.filter(v => v.itemId === itemId);
    };

    const addNotification = async (n: Omit<Notification, 'id' | 'createdAt' | 'createdBy'>) => {
        const { error } = await supabase.from('notifications').insert({
            title: n.title,
            content: n.content,
            type: n.type,
            target_role: n.target_role,
            is_active: n.isActive,
            created_by: user?.id
        });
        if (!error) fetchAllData();
        else console.error("Error adding notification:", error);
    };

    const updateNotification = async (id: string, updates: Partial<Notification>) => {
        const payload: any = {};
        if (updates.title !== undefined) payload.title = updates.title;
        if (updates.content !== undefined) payload.content = updates.content;
        if (updates.type !== undefined) payload.type = updates.type;
        if (updates.target_role !== undefined) payload.target_role = updates.target_role;
        if (updates.isActive !== undefined) payload.is_active = updates.isActive;

        const { error } = await supabase.from('notifications').update(payload).eq('id', id);
        if (!error) fetchAllData();
        else console.error("Error updating notification:", error);
    };

    const deleteNotification = async (id: string) => {
        const { error } = await supabase.from('notifications').delete().eq('id', id);
        if (!error) fetchAllData();
        else console.error("Error deleting notification:", error);
    };

    return (
        <AuthContext.Provider value={{
            user, login, logout, isAuthenticated: !!user, sessionLoading,
            updateUserEmail, updateUserPassword,
            units, dataGroups, fields, entries, fieldValues, collectionItems, collectionFieldValues, users, notifications,
            addUnit, updateUnit, deleteUnit, addDataGroup, updateDataGroup, deleteDataGroup,
            addField, updateField, deleteField,
            upsertDataGroupEntry, getEntryForGroup, getValuesForEntry, getLatestFieldValue,
            addCollectionItem, updateCollectionItem, deleteCollectionItem, getItemsForCollection, getValuesForItem,
            addNotification, updateNotification, deleteNotification
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export function calculateFieldValue(
    field: Field,
    formData: Record<string, any>,
    allFields: Field[]
): number | null {
    if (field.type !== 'calculated' || !field.calculationConfig) {
        return null;
    }

    const { operation, sourceFieldIds } = field.calculationConfig;
    if (!sourceFieldIds || sourceFieldIds.length === 0) {
        return null;
    }

    const parseNumericInput = (val: any): number => {
        if (typeof val === 'number') return val;
        if (val === null || val === undefined || val === '') return 0; // Tratar vazio como 0 para o cálculo
        let cleaned = String(val).trim().replace(/%/g, '').replace(/\s/g, '').replace(/,/g, '.');
        if (!/^-?\d*\.?\d*$/.test(cleaned) || cleaned === '.' || cleaned === '-.') return 0;
        return Number(cleaned);
    };

    const sourceValues = sourceFieldIds.map(id => {
        const sourceField = allFields.find(f => f.id === id);
        // Permite que campos calculados dependam de outros campos calculados, numéricos ou percentuais
        if (!sourceField || !['number', 'percentage', 'calculated'].includes(sourceField.type)) {
            return 0; // Ignora campos não-numéricos na soma/subtração
        }
        return parseNumericInput(formData[id]);
    });

    if (operation === 'sum') {
        return sourceValues.reduce((acc, val) => acc + val, 0);
    }

    if (operation === 'subtract') {
        if (sourceValues.length === 0) return 0;
        return sourceValues.slice(1).reduce((acc, val) => acc - val, sourceValues[0]);
    }

    return null;
}
