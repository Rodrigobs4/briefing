import { useState, ChangeEvent, useEffect, useMemo } from 'react';
import { useAuth, type DataGroup, calculateFieldValue } from '../../store/AuthContext';
import { Save, UploadCloud, CheckCircle2, FileText, AlertCircle, X, Hash, Percent, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { STORAGE_BUCKET_UPLOADS } from '../../config/storage';
import { compareTextPtBr } from '../../utils/textOrdering';
import { isGeneralBriefingUnit } from '../../utils/generalBriefingUnits';
import { formatBrazilianNumber, formatBrazilianNumericInput, formatStoredNumericValue, parseBrazilianNumber } from '../../utils/brazilianNumbers';

const FIRST_REPORT_YEAR = 2023;
const CURRENT_REPORT_YEAR = Math.max(FIRST_REPORT_YEAR, new Date().getFullYear());
const REPORT_YEARS = Array.from({ length: CURRENT_REPORT_YEAR - FIRST_REPORT_YEAR + 1 }, (_, index) => CURRENT_REPORT_YEAR - index);

export default function DynamicEditorPanel() {
    const { user, units, regionalCommands, dataGroups, fields, deleteCollectionItem, getValuesForItem } = useAuth();

    // Tópicos e seções seguem a mesma sequência definida na arquitetura do briefing.
    const userUnits = useMemo(() => {
        const userUnitIds = (user?.unitIds && user.unitIds.length > 0)
            ? user.unitIds
            : (user?.unitId ? [user.unitId] : []);

        return units
            .filter(unit => userUnitIds.includes(unit.id) && isGeneralBriefingUnit(unit, regionalCommands))
            .sort((left, right) =>
                (left.order_index ?? 999) - (right.order_index ?? 999)
                || compareTextPtBr(left.name, right.name)
            );
    }, [units, regionalCommands, user?.unitId, user?.unitIds]);

    // Estado para o tópico selecionado
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(userUnits[0]?.id || null);
    const userUnit = useMemo(() => units.find(u => u.id === selectedUnitId), [units, selectedUnitId]);

    const myGroups = useMemo(() => dataGroups
        .filter(group => group.unitId === selectedUnitId)
        .sort((left, right) =>
            left.order - right.order
            || compareTextPtBr(left.title, right.title)
        ), [dataGroups, selectedUnitId]);

    const [activeGroup, setActiveGroup] = useState<DataGroup | null>(myGroups[0] || null);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [imagePreviews, setImagePreviews] = useState<Record<string, string[]>>({});
    const [referenceYear, setReferenceYear] = useState(CURRENT_REPORT_YEAR);

    const [errorMess, setErrorMess] = useState('');

    const [isSaving, setIsSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<Date | null>(null);
    const [showSuccessBanner, setShowSuccessBanner] = useState(false);

    // Collection State
    const [isCollectionListView, setIsCollectionListView] = useState(true);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [localCollectionItems, setLocalCollectionItems] = useState<any[]>([]);

    const activeFields = fields.filter(f => f.dataGroupId === activeGroup?.id && f.isActive).sort((a, b) => a.order - b.order);

    useEffect(() => {
        setSelectedUnitId(current =>
            userUnits.some(unit => unit.id === current)
                ? current
                : userUnits[0]?.id ?? null
        );
    }, [userUnits]);

    useEffect(() => {
        setActiveGroup(current =>
            myGroups.find(group => group.id === current?.id)
            ?? myGroups[0]
            ?? null
        );
    }, [myGroups]);

    useEffect(() => {
        if (!activeGroup || !userUnit || activeGroup.unitId !== userUnit.id) return;

        setIsCollectionListView(true);
        setEditingItemId(null);
        setShowSuccessBanner(false);
        setErrorMess('');

        const loadSnapshotData = async () => {
            try {
                // 1. Buscar Entry (Snapshot) diretamente do banco
                let entryQuery = supabase
                    .from('data_group_entries')
                    .select('id, updated_at')
                    .eq('unit_id', userUnit.id)
                    .eq('data_group_id', activeGroup.id);
                entryQuery = activeGroup.updateFrequency === 'yearly'
                    ? entryQuery.eq('reference_year', referenceYear)
                    : entryQuery.is('reference_year', null);
                let { data: entry, error: entryError } = await entryQuery.maybeSingle();

                if (entryError) throw entryError;

                // Se uma seção existente foi convertida para anual, preserva o cadastro
                // anterior como dado do ano atual até que ele seja salvo com referência.
                if (!entry && activeGroup.updateFrequency === 'yearly' && referenceYear === CURRENT_REPORT_YEAR) {
                    const { data: legacyEntry, error: legacyError } = await supabase
                        .from('data_group_entries')
                        .select('id, updated_at')
                        .eq('unit_id', userUnit.id)
                        .eq('data_group_id', activeGroup.id)
                        .is('reference_year', null)
                        .maybeSingle();
                    if (legacyError) throw legacyError;
                    entry = legacyEntry;
                }

                if (entry) {
                    // 2. Buscar Valores
                    const { data: values, error: valError } = await supabase
                        .from('field_values')
                        .select('field_id, value')
                        .eq('entry_id', entry.id);

                    if (valError) throw valError;

                    const prefillData: Record<string, any> = {};
                    const previews: Record<string, string[]> = {};

                    for (const fv of (values || [])) {
                        const fieldDef = activeFields.find(f => f.id === fv.field_id);
                        if (fieldDef?.type === 'image') {
                            try {
                                const paths = JSON.parse(fv.value) as string[];
                                prefillData[fv.field_id] = paths;

                                const signedUrls = [];
                                for (const path of paths) {
                                    const { data } = await supabase.storage.from('evidencias').createSignedUrl(path, 60 * 60);
                                    if (data?.signedUrl) signedUrls.push(data.signedUrl);
                                }
                                previews[fv.field_id] = signedUrls;
                            } catch (e) { }
                        } else {
                            prefillData[fv.field_id] = ['number', 'currency', 'percentage'].includes(fieldDef?.type || '')
                                ? formatStoredNumericValue(fv.value, fieldDef?.type === 'currency')
                                : fv.value;
                        }
                    }
                    setFormData(prefillData);
                    setImagePreviews(previews);
                    setSavedAt(new Date(entry.updated_at));
                } else {
                    setFormData({});
                    setImagePreviews({});
                    setSavedAt(null);
                }
            } catch (err) {
                console.error("Erro ao carregar dados:", err);
            }
        };

        const loadCollectionItems = async () => {
            try {
                const { data, error } = await supabase
                    .from('collection_items')
                    .select('*')
                    .eq('unit_id', userUnit.id)
                    .eq('data_group_id', activeGroup.id)
                    .eq('status', 'published') // Assumindo status published
                    .order('order_index', { ascending: true })
                    .order('created_at', { ascending: false });

                if (error) throw error;

                // Mapeia os dados do banco para o formato esperado pelo componente
                const mappedData = (data || []).map(item => ({
                    id: item.id,
                    unitId: item.unit_id,
                    dataGroupId: item.data_group_id,
                    orderIndex: item.order_index ?? 999,
                    createdBy: item.created_by,
                    updatedBy: item.updated_by,
                    isFeatured: item.is_featured,
                    status: item.status,
                    createdAt: item.created_at,
                    updatedAt: item.updated_at
                }));
                setLocalCollectionItems(mappedData);
            } catch (err) {
                console.error("Erro ao carregar coleção:", err);
            }
        };

        if (activeGroup.mode === 'snapshot') {
            setIsCollectionListView(false);
            loadSnapshotData();
        } else {
            setIsCollectionListView(true);
            setEditingItemId(null);
            setFormData({});
            setImagePreviews({});
            setSavedAt(null);
            loadCollectionItems();
        }

    }, [activeGroup, userUnit, fields, referenceYear]);

    const openCollectionItemEdit = async (itemId: string) => {
        setErrorMess('');
        setEditingItemId(itemId);
        setIsCollectionListView(false);

        // Fetch fresh values for item
        const { data: itemValues, error } = await supabase
            .from('collection_field_values')
            .select('*')
            .eq('item_id', itemId);

        if (error || !itemValues) return;

        const prefillData: Record<string, any> = {};
        const previews: Record<string, string[]> = {};

        for (const fv of itemValues) {
            const fieldDef = activeFields.find(f => f.id === fv.field_id);
            if (fieldDef?.type === 'image' && fv.value_json) {
                try {
                    const paths = fv.value_json as string[];
                    prefillData[fv.field_id] = paths;
                    const signedUrls = [];
                    for (const path of paths) {
                        const { data } = await supabase.storage.from('evidencias').createSignedUrl(path, 60 * 60);
                        if (data?.signedUrl) signedUrls.push(data.signedUrl);
                    }
                    previews[fv.field_id] = signedUrls;
                } catch (e) { }
            } else {
                let val = fv.value_text;
                if (fieldDef && ['number', 'currency', 'percentage', 'calculated'].includes(fieldDef.type)) {
                    val = fv.value_number === null || fv.value_number === undefined
                        ? ''
                        : formatBrazilianNumber(Number(fv.value_number), fieldDef.type === 'currency');
                }
                prefillData[fv.field_id] = val;
            }
        }
        setFormData(prefillData);
        setImagePreviews(previews);
        const item = localCollectionItems.find(i => i.id === itemId);
        setSavedAt(item ? new Date(item.created_at) : null);
    };

    const toggleFeatured = async (itemId: string, currentFeatured: boolean) => {
        if (!user) return;
        try {
            await supabase.from('collection_items').update({ is_featured: !currentFeatured }).eq('id', itemId);
            // Atualiza localmente para feedback rápido
            setLocalCollectionItems(prev => prev.map(i => i.id === itemId ? { ...i, is_featured: !currentFeatured } : i));
        } catch (err: any) {
            console.error("Failed to toggle featured", err);
        }
    };

    const moveCollectionItem = async (itemId: string, direction: 'up' | 'down') => {
        const itemIndex = localCollectionItems.findIndex(item => item.id === itemId);
        if (itemIndex < 0) return;

        const targetIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1;
        if (targetIndex < 0 || targetIndex >= localCollectionItems.length) return;

        const currentItem = localCollectionItems[itemIndex];
        const targetItem = localCollectionItems[targetIndex];
        const reorderedItems = [...localCollectionItems];
        reorderedItems[itemIndex] = { ...targetItem, orderIndex: currentItem.orderIndex };
        reorderedItems[targetIndex] = { ...currentItem, orderIndex: targetItem.orderIndex };
        setLocalCollectionItems(reorderedItems);

        const [{ error: currentError }, { error: targetError }] = await Promise.all([
            supabase.from('collection_items').update({ order_index: targetItem.orderIndex }).eq('id', currentItem.id),
            supabase.from('collection_items').update({ order_index: currentItem.orderIndex }).eq('id', targetItem.id),
        ]);

        if (currentError || targetError) {
            setLocalCollectionItems(localCollectionItems);
            setErrorMess('Não foi possível alterar a ordem dos itens. Verifique se a migration de ordenação foi aplicada.');
        }
    };

    const parseNumericInput = (val: any): number => {
        return parseBrazilianNumber(val);
    };

    // Auto-calculate fields effect
    useEffect(() => {
        if (!activeGroup) return;
        const calculatedFields = activeFields.filter(f => f.type === 'calculated');
        if (calculatedFields.length === 0) return;

        calculatedFields.forEach(field => {
            const calculatedValue = calculateFieldValue(field, formData, activeFields);
            const formattedValue = calculatedValue === null ? '' : formatBrazilianNumber(calculatedValue);
            if (calculatedValue !== null && formData[field.id] !== formattedValue) {
                setFormData(prev => ({ ...prev, [field.id]: formattedValue }));
            }
        });
    }, [formData, activeFields, activeGroup]);

    if (myGroups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl shadow-sm border border-pm-secondary/20 h-96">
                <FileText className="w-16 h-16 text-pm-secondary/30 mb-4" />
                <h2 className="text-xl font-bold text-pm-dark">Nenhum Conjunto de Dados Pendente</h2>
                <p className="text-pm-secondary mt-2 max-w-md">O Comando Geral ainda não configurou métricas ou relatórios para a unidade: <strong>{userUnit?.name || 'Desconhecida'}</strong>.</p>
            </div>
        );
    }

    const handleInputChange = (fieldId: string, value: any) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
        setErrorMess('');
    };

    const handleNumericInputChange = (fieldId: string, value: string, currency = false) => {
        handleInputChange(fieldId, formatBrazilianNumericInput(value, currency));
    };

    const handleImageUpload = (e: ChangeEvent<HTMLInputElement>, fieldId: string) => {
        const files = Array.from(e.target.files || []);
        setErrorMess('');

        // Limite lógico original: 3 maximo global
        const currentPaths = formData[fieldId] || [];
        if (currentPaths.length + files.length > 3) {
            setErrorMess('Atenção: É permitido no máximo 3 imagens por campo.');
            return;
        }

        const validFiles = files.filter(f => f.size <= 1048576);
        if (validFiles.length < files.length) {
            setErrorMess('Atenção: Algumas imagens foram bloqueadas pois excedem o tamanho máximo de 1MB.');
            return;
        }

        const promises = validFiles.map(file => {
            return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });
        });

        Promise.all(promises).then(base64Images => {
            // Guarda ambos na tela (Preview vs Real Dados subindo)
            setFormData(prev => ({ ...prev, [fieldId]: [...(prev[fieldId] || []), ...base64Images] }));
            setImagePreviews(prev => ({ ...prev, [fieldId]: [...(prev[fieldId] || []), ...base64Images] }));
        });
    };

    const removeImage = (fieldId: string, indexToRemove: number) => {
        setFormData(prev => {
            const newImgs = (prev[fieldId] || []).filter((_: any, i: number) => i !== indexToRemove);
            return { ...prev, [fieldId]: newImgs };
        });
        setImagePreviews(prev => {
            const newPreviews = (prev[fieldId] || []).filter((_: any, i: number) => i !== indexToRemove);
            return { ...prev, [fieldId]: newPreviews };
        });
    };

    // Helper p/ Blob
    const dataURLtoBlob = (dataurl: string) => {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)![1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeGroup || !user || !userUnit) {
            setErrorMess('Erro: Usuário ou unidade de trabalho não definidos.');
            return;
        }

        for (const field of activeFields) {
            const val = formData[field.id];
            const isEmpty = val === undefined || val === null || val === '';
            if (field.required && isEmpty && field.type !== 'image') {
                setErrorMess(`Por favor, preencha o campo obrigatório: ${field.name}`);
                return;
            }
            if (field.required && field.type === 'image' && (!val || val.length === 0)) {
                setErrorMess(`Por favor, envie ao menos uma foto em: ${field.name}`);
                return;
            }
            if (!isEmpty && ['number', 'currency', 'percentage'].includes(field.type)) {
                const parsed = parseNumericInput(val);
                if (Number.isNaN(parsed)) {
                    setErrorMess(`O campo "${field.name}" contém um valor numérico inválido.`);
                    return;
                }
            }
            if (!isEmpty && field.type === 'enum' && !(field.enumOptions ?? []).includes(String(val))) {
                setErrorMess(`Selecione uma opção válida para o campo "${field.name}".`);
                return;
            }
        }

        setIsSaving(true);
        setErrorMess('');

        try {
            const valuesToUpsert: Record<string, any> = {};

            for (const fieldId of Object.keys(formData)) {
                const field = fields.find(f => f.id === fieldId);
                let finalValue = formData[fieldId];

                // Numerics
                if (field && ['number', 'currency', 'percentage', 'calculated'].includes(field.type)) {
                    if (finalValue !== undefined && finalValue !== null && finalValue !== '') {
                        finalValue = parseNumericInput(finalValue);
                    }
                }

                // Supabase Storage Cloud Uploads
                if (field?.type === 'image' && Array.isArray(finalValue)) {
                    const finalPaths = [];
                    for (let i = 0; i < finalValue.length; i++) {
                        const item = finalValue[i];
                        if (item.startsWith('data:image')) {
                            // Validação de segurança proativa (RLS do Supabase)
                            const { data: { session } } = await supabase.auth.getSession();
                            if (!session) {
                                throw new Error("Sem permissão para enviar imagem — sessão expirada. Contate o administrador.");
                            }

                            const blob = dataURLtoBlob(item);
                            const path = `${userUnit.id}/${activeGroup.id}/${fieldId}_${Date.now()}_${i}.png`;
                            const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET_UPLOADS).upload(path, blob, {
                                contentType: blob.type
                            });
                            if (uploadError) throw new Error("Falha no upload da imagem para a nuvem segura. " + uploadError.message);
                            finalPaths.push(path);
                        } else {
                            // Se nao e data:image, ja e um path anterior do banco de dados (preservar)
                            finalPaths.push(item);
                        }
                    }
                    finalValue = finalPaths; // Array de Paths na Bucket
                }

                valuesToUpsert[fieldId] = finalValue;
            }

            if (activeGroup.mode === 'snapshot') {
                // 1. Garantir Entry Pai
                let entryId = null;
                const entryReferenceYear = activeGroup.updateFrequency === 'yearly' ? referenceYear : null;

                let existingEntryQuery = supabase
                    .from('data_group_entries')
                    .select('id')
                    .eq('unit_id', userUnit.id)
                    .eq('data_group_id', activeGroup.id);
                existingEntryQuery = entryReferenceYear === null
                    ? existingEntryQuery.is('reference_year', null)
                    : existingEntryQuery.eq('reference_year', entryReferenceYear);
                let { data: existingEntry, error: existingEntryError } = await existingEntryQuery.maybeSingle();
                if (existingEntryError) throw existingEntryError;

                let isLegacyAnnualEntry = false;
                if (!existingEntry && activeGroup.updateFrequency === 'yearly' && entryReferenceYear === CURRENT_REPORT_YEAR) {
                    const { data: legacyEntry, error: legacyError } = await supabase
                        .from('data_group_entries')
                        .select('id')
                        .eq('unit_id', userUnit.id)
                        .eq('data_group_id', activeGroup.id)
                        .is('reference_year', null)
                        .maybeSingle();
                    if (legacyError) throw legacyError;
                    existingEntry = legacyEntry;
                    isLegacyAnnualEntry = !!legacyEntry;
                }

                if (existingEntry) {
                    entryId = existingEntry.id;
                    const entryUpdates: Record<string, any> = {
                        updated_at: new Date().toISOString(),
                        updated_by: user.id
                    };
                    if (isLegacyAnnualEntry) entryUpdates.reference_year = entryReferenceYear;
                    const { error: updateError } = await supabase.from('data_group_entries')
                        .update(entryUpdates)
                        .eq('id', entryId);
                    if (updateError) throw updateError;
                } else {
                    const { data: newEntry, error: createError } = await supabase
                        .from('data_group_entries')
                        .insert({
                            unit_id: userUnit.id,
                            data_group_id: activeGroup.id,
                            reference_year: entryReferenceYear,
                            updated_by: user.id
                        })
                        .select('id')
                        .single();

                    if (createError) throw createError;
                    entryId = newEntry.id;
                }

                // 2. Upsert Values (Estratégia segura: Busca IDs existentes para fazer update, ou insert se novo)
                // Isso evita depender de constraints únicas compostas que podem não existir
                const { data: existingValues } = await supabase
                    .from('field_values')
                    .select('id, field_id')
                    .eq('entry_id', entryId);

                const upsertPromises = Object.entries(valuesToUpsert).map(([fieldId, value]) => {
                    const existingVal = existingValues?.find(ev => ev.field_id === fieldId);
                    const payload = {
                        entry_id: entryId,
                        field_id: fieldId,
                        value: typeof value === 'object' ? JSON.stringify(value) : String(value) // Força string para tabela field_values
                    };

                    if (existingVal) {
                        return supabase.from('field_values').update(payload).eq('id', existingVal.id);
                    } else {
                        return supabase.from('field_values').insert(payload);
                    }
                });

                await Promise.all(upsertPromises);

            } else {
                // COLLECTION MODE
                let itemId = editingItemId;

                if (editingItemId) {
                    await supabase.from('collection_items')
                        .update({ updated_at: new Date().toISOString(), updated_by: user.id })
                        .eq('id', editingItemId);
                } else {
                    const { data: newItem, error: createError } = await supabase
                        .from('collection_items')
                        .insert({
                            unit_id: userUnit.id,
                            data_group_id: activeGroup.id,
                            order_index: localCollectionItems.reduce((highest, item) => Math.max(highest, item.orderIndex ?? 0), 0) + 1,
                            created_by: user.id,
                            updated_by: user.id,
                            status: 'published'
                        })
                        .select('id')
                        .single();
                    if (createError) throw createError;
                    itemId = newItem.id;
                }

                // Upsert Collection Values
                const { data: existingColValues } = await supabase
                    .from('collection_field_values')
                    .select('id, field_id')
                    .eq('item_id', itemId);

                const colPromises = Object.entries(valuesToUpsert).map(([fieldId, val]) => {
                    const fieldDef = fields.find(f => f.id === fieldId);
                    const existingVal = existingColValues?.find(ev => ev.field_id === fieldId);

                    const payload: any = { item_id: itemId, field_id: fieldId };
                    if (fieldDef && ['number', 'currency', 'percentage', 'calculated'].includes(fieldDef.type)) payload.value_number = val === '' ? null : Number(val);
                    else if (fieldDef?.type === 'image') payload.value_json = val; // Array
                    else payload.value_text = String(val);

                    if (existingVal) return supabase.from('collection_field_values').update(payload).eq('id', existingVal.id);
                    else return supabase.from('collection_field_values').insert(payload);
                });
                await Promise.all(colPromises);
            }

            setSavedAt(new Date());
            setShowSuccessBanner(true);

            setTimeout(async () => {
                setShowSuccessBanner(false);
                if (activeGroup.mode === 'collection') {
                    setIsCollectionListView(true);
                    setEditingItemId(null);
                    setFormData({});
                    setImagePreviews({});
                    // Recarrega a lista com mapping correto
                    const { data } = await supabase
                        .from('collection_items')
                        .select('*')
                        .eq('unit_id', userUnit.id)
                        .eq('data_group_id', activeGroup.id)
                        .eq('status', 'published')
                        .order('order_index', { ascending: true })
                        .order('created_at', { ascending: false });

                    // Mapeia os dados do banco para o formato esperado
                    const mappedData = (data || []).map(item => ({
                        id: item.id,
                        unitId: item.unit_id,
                        dataGroupId: item.data_group_id,
                        orderIndex: item.order_index ?? 999,
                        createdBy: item.created_by,
                        updatedBy: item.updated_by,
                        isFeatured: item.is_featured,
                        status: item.status,
                        createdAt: item.created_at,
                        updatedAt: item.updated_at
                    }));
                    setLocalCollectionItems(mappedData);
                } else {
                    // Recarrega snapshot para garantir consistência visual
                    // (Opcional, pois formData já está atualizado, mas bom para confirmar persistência)
                }
            }, 3000);

        } catch (err: any) {
            setErrorMess(err.message || 'Falha ao salvar relatórios no Supabase.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 space-y-3">
                {/* Seletor de Unidade (Apenas se houver mais de uma) */}
                {userUnits.length > 1 && (
                    <div className="mb-4 px-1">
                        <label className="text-[10px] font-bold text-pm-secondary uppercase tracking-wider mb-1.5 block">Unidade de Trabalho</label>
                        <div className="relative">
                            <select
                                value={selectedUnitId || ''}
                                onChange={(e) => setSelectedUnitId(e.target.value)}
                                className="w-full appearance-none bg-white border border-pm-secondary/30 text-pm-dark text-sm rounded-xl pl-4 pr-10 py-3 focus:ring-2 focus:ring-pm-primary outline-none font-bold shadow-sm transition-all hover:border-pm-primary/50"
                            >
                                {userUnits.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="w-4 h-4 text-pm-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>
                )}

                <h3 className="font-bold text-pm-dark px-2 border-l-4 border-pm-primary">Seções na ordem do briefing</h3>
                <div className="flex flex-col gap-2">
                    {myGroups.map((group, index) => (
                        <button
                            key={group.id}
                            onClick={() => { setActiveGroup(group); }}
                            className={`text-left p-4 rounded-xl border transition-all text-sm font-medium shadow-sm file-tab
                ${activeGroup?.id === group.id
                                    ? 'bg-pm-primary text-pm-dark border-pm-primary scale-[1.02]'
                                    : 'bg-white border-pm-secondary/20 hover:border-pm-primary/40 text-pm-secondary hover:text-pm-dark'}`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${activeGroup?.id === group.id ? 'bg-pm-dark/15 text-pm-dark' : 'bg-pm-light text-pm-secondary'}`}>
                                    {index + 1}
                                </span>
                                <FileText className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{group.title}</span>
                            </div>
                            <span className={`ml-7 text-[10px] font-black uppercase tracking-wider ${activeGroup?.id === group.id ? 'text-pm-dark/70' : 'text-pm-secondary/60'}`}>
                                {group.mode === 'collection' ? 'Coleção' : 'Snapshot'}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="lg:col-span-3">
                {activeGroup ? (
                    <div className="bg-white rounded-xl shadow-sm border border-pm-secondary/20 overflow-hidden">
                        <div className="bg-pm-light px-6 py-5 border-b border-pm-secondary/10 flex justify-between items-center">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-bold text-pm-dark">{activeGroup.title}</h2>
                                    <span className="text-[10px] font-bold text-pm-secondary uppercase border border-pm-secondary/30 px-1.5 py-0.5 rounded-full">
                                        {activeGroup.mode === 'collection' ? 'Coleção' : activeGroup.reportLayout === 'text' ? 'Observações' : activeGroup.updateFrequency === 'yearly' ? 'Anual' : 'Fixo'}
                                    </span>
                                </div>
                                <p className="text-sm text-pm-secondary">Preenchimento Oficial • {userUnit?.name || 'Selecione uma Unidade'}</p>
                            </div>

                            {activeGroup.mode === 'collection' && !isCollectionListView && (
                                <button
                                    onClick={() => setIsCollectionListView(true)}
                                    className="text-sm font-medium bg-white border border-pm-secondary/30 text-pm-dark hover:text-pm-primary px-4 py-2 rounded-lg transition-colors"
                                >
                                    VOLTAR PARA LISTA
                                </button>
                            )}
                        </div>

                        {showSuccessBanner && (
                            <div className="mx-6 mt-6 bg-green-50/80 backdrop-blur text-green-800 p-4 rounded-xl flex items-center justify-between border border-green-200 shadow-sm animate-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">Dados atualizados com sucesso.</p>
                                        {savedAt && <p className="text-xs text-green-700/80 mt-0.5">Atualizado em {savedAt.toLocaleDateString('pt-BR')} às {savedAt.toLocaleTimeString('pt-BR')}</p>}
                                    </div>
                                </div>
                                <button onClick={() => setShowSuccessBanner(false)} className="p-1 opacity-50 hover:opacity-100 transition-opacity bg-green-200/50 rounded hover:bg-green-200">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {activeGroup.mode === 'collection' && isCollectionListView ? (
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-bold text-pm-dark">Itens Registrados</h3>
                                    <button
                                        onClick={() => { setIsCollectionListView(false); setEditingItemId(null); setFormData({}); setImagePreviews({}); }}
                                        className="bg-pm-dark text-pm-light px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-pm-dark/90 transition-colors"
                                    >
                                        + Registrar Nova Entrada
                                    </button>
                                </div>

                                {localCollectionItems.length === 0 ? (
                                    <p className="text-center text-sm text-pm-secondary p-8 bg-pm-light/50 rounded-xl border border-pm-secondary/20">Ainda não existem registros arquivados aqui. Clique no botão acima para submeter a primeira.</p>
                                ) : (
                                    <div className="border border-pm-secondary/20 rounded-xl overflow-x-auto">
                                        <table className="w-full text-left text-sm text-pm-dark min-w-[600px]">
                                            <thead className="bg-pm-light border-b border-pm-secondary/20">
                                                <tr>
                                                    <th className="px-4 py-3 font-bold text-center w-20">Ordem</th>
                                                    <th className="px-4 py-3 font-bold">Data Criação</th>
                                                    <th className="px-4 py-3 font-bold">Resumo Val.(Auto)</th>
                                                    <th className="px-4 py-3 font-bold text-center">Destaque</th>
                                                    <th className="px-4 py-3 font-bold text-right">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-pm-secondary/10">
                                                {localCollectionItems.map((item, itemIndex) => {
                                                    const fv = getValuesForItem(item.id);
                                                    const autoTitleFv = fv.find(v => v.valueText && v.valueText.length > 5);
                                                    const autoTitle = autoTitleFv?.valueText?.substring(0, 40) + '...' || 'Registro #' + item.id.substring(0, 6);

                                                    return (
                                                        <tr key={item.id} className="hover:bg-pm-light/30 transition-colors">
                                                            <td className="px-2 py-3">
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => moveCollectionItem(item.id, 'up')}
                                                                        disabled={itemIndex === 0}
                                                                        title="Mover item para cima"
                                                                        className="rounded p-1 text-pm-secondary hover:bg-pm-light hover:text-pm-primary disabled:cursor-not-allowed disabled:opacity-20"
                                                                    >
                                                                        <ChevronUp className="h-4 w-4" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => moveCollectionItem(item.id, 'down')}
                                                                        disabled={itemIndex === localCollectionItems.length - 1}
                                                                        title="Mover item para baixo"
                                                                        className="rounded p-1 text-pm-secondary hover:bg-pm-light hover:text-pm-primary disabled:cursor-not-allowed disabled:opacity-20"
                                                                    >
                                                                        <ChevronDown className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-pm-secondary">{new Date(item.createdAt).toLocaleDateString('pt-BR')}</td>
                                                            <td className="px-4 py-3 font-medium truncate max-w-[200px]">{autoTitle}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={item.isFeatured}
                                                                    onChange={() => toggleFeatured(item.id, item.isFeatured)}
                                                                    className="cursor-pointer w-4 h-4 text-pm-primary rounded border-pm-secondary/30"
                                                                    title="Marcar como Destaque"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <button onClick={() => openCollectionItemEdit(item.id)} className="text-sm font-bold text-pm-secondary hover:text-pm-primary transition-colors">ABRIR</button>
                                                                    <button onClick={async () => { if (confirm('Excluir este item da coleção definitivamente?')) { await deleteCollectionItem(item.id); setLocalCollectionItems(prev => prev.filter(i => i.id !== item.id)); } }} className="text-sm font-bold text-red-500 hover:text-red-700 transition-colors ml-2">EXCLUIR</button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="p-6 space-y-6">

                                {activeGroup.mode === 'snapshot' && activeGroup.updateFrequency === 'yearly' && (
                                    <div className="rounded-xl border border-pm-primary/20 bg-pm-primary/5 p-4">
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-pm-secondary mb-2">Ano de referência</label>
                                        <select
                                            value={referenceYear}
                                            onChange={e => setReferenceYear(Number(e.target.value))}
                                            className="w-full border border-pm-secondary/30 rounded-lg px-4 py-3 text-sm font-bold bg-white focus:ring-2 focus:ring-pm-primary outline-none"
                                        >
                                            {REPORT_YEARS.map(year => <option key={year} value={year}>{year}</option>)}
                                        </select>
                                        <p className="text-xs text-pm-secondary mt-2">Cada ano armazena um lançamento próprio para gerar o comparativo no relatório.</p>
                                    </div>
                                )}

                                {errorMess && (
                                    <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-3 border border-red-200">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                        <div>
                                            <p className="font-bold text-sm">Falha ao atualizar os dados. Tente novamente.</p>
                                            <p className="text-xs font-medium opacity-80 mt-0.5">{errorMess}</p>
                                        </div>
                                    </div>
                                )}

                                {activeFields.length === 0 ? (
                                    <p className="text-sm text-pm-secondary p-4 bg-pm-light/50 rounded-lg text-center">Nenhum campo foi configurado pelo Administrador para este conjunto.</p>
                                ) : activeFields.map(field => (
                                    <div key={field.id} className="space-y-2">
                                        <label className="flex items-center gap-1 font-semibold text-sm text-pm-dark">
                                            {field.name}
                                            {field.required && <span className="text-red-500">*</span>}
                                        </label>

                                        {field.type === 'text' && (
                                            <input
                                                type="text"
                                                value={formData[field.id] || ''}
                                                onChange={e => handleInputChange(field.id, e.target.value)}
                                                className="w-full border border-pm-secondary/30 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-pm-primary outline-none"
                                                placeholder="Resposta curta"
                                            />
                                        )}

                                        {field.type === 'textarea' && (
                                            <textarea
                                                value={formData[field.id] || ''}
                                                onChange={e => handleInputChange(field.id, e.target.value)}
                                                className="w-full border border-pm-secondary/30 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-pm-primary outline-none min-h-[120px]"
                                                placeholder="Providencie os fatos ou relatos..."
                                            />
                                        )}

                                        {field.type === 'enum' && (
                                            <div className="relative">
                                                <select
                                                    value={formData[field.id] || ''}
                                                    onChange={e => handleInputChange(field.id, e.target.value)}
                                                    className="w-full appearance-none border border-pm-secondary/30 rounded-lg pl-4 pr-10 py-3 text-sm bg-white focus:ring-2 focus:ring-pm-primary outline-none"
                                                >
                                                    <option value="">Selecione uma opção</option>
                                                    {formData[field.id] && !(field.enumOptions ?? []).includes(String(formData[field.id])) && (
                                                        <option value={formData[field.id]}>{formData[field.id]} (opção removida)</option>
                                                    )}
                                                    {(field.enumOptions ?? []).map(option => (
                                                        <option key={option} value={option}>{option}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-pm-secondary" />
                                            </div>
                                        )}

                                        {field.type === 'number' && (
                                            <div className="relative">
                                                <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-pm-secondary" />
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={formData[field.id] !== undefined ? formData[field.id] : ''}
                                                    onChange={e => handleNumericInputChange(field.id, e.target.value)}
                                                    className="w-full border border-pm-secondary/30 rounded-lg pl-9 pr-4 py-3 text-sm focus:ring-2 focus:ring-pm-primary outline-none"
                                                    placeholder="0"
                                                />
                                            </div>
                                        )}

                                        {field.type === 'currency' && (
                                            <div>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={formData[field.id] !== undefined ? formData[field.id] : ''}
                                                    onChange={e => handleNumericInputChange(field.id, e.target.value, true)}
                                                    className="w-full border border-pm-secondary/30 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-pm-primary outline-none"
                                                    placeholder="R$ 0,00"
                                                />
                                            </div>
                                        )}

                                        {field.type === 'percentage' && (
                                            <div className="relative">
                                                <Percent className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-pm-secondary" />
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={formData[field.id] !== undefined ? formData[field.id] : ''}
                                                    onChange={e => handleNumericInputChange(field.id, e.target.value)}
                                                    className="w-full border border-pm-secondary/30 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-pm-primary outline-none"
                                                    placeholder="Ex: 15,5%"
                                                />
                                            </div>
                                        )}

                                        {field.type === 'calculated' && (
                                            <div className="space-y-1">
                                                <div className="relative">
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase pointer-events-none">
                                                        Calculado
                                                    </span>
                                                    <input
                                                        type="text"
                                                        value={formData[field.id] !== undefined ? formData[field.id] : ''}
                                                        readOnly
                                                        className="w-full border border-pm-secondary/30 rounded-lg px-4 py-3 text-sm bg-slate-50 text-slate-600 font-bold focus:ring-0 outline-none cursor-not-allowed"
                                                        placeholder="Será calculado automaticamente..."
                                                    />
                                                </div>
                                                {field.calculationConfig && <p className="text-[10px] text-pm-secondary pl-1">Operação: {field.calculationConfig.operation === 'sum' ? 'Soma' : 'Subtração'} de {field.calculationConfig.sourceFieldIds.length} campos.</p>}
                                            </div>
                                        )}

                                        {field.type === 'image' && (
                                            <div className="border-2 border-dashed border-pm-secondary/30 rounded-xl p-6 bg-pm-light/30 transition-colors hover:border-pm-primary/50 text-center relative group">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    multiple
                                                    onChange={e => handleImageUpload(e, field.id)}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                />
                                                <div className="flex flex-col items-center justify-center pointer-events-none">
                                                    <UploadCloud className="w-8 h-8 text-pm-secondary mb-2 group-hover:text-pm-primary transition-colors" />
                                                    <span className="text-sm font-semibold text-pm-dark group-hover:text-pm-primary transition-colors">Arraste Fotografias ou Clique</span>
                                                    <span className="text-[10px] text-pm-secondary mt-1">Sincroniza automático com Supabase Auth. Format. aceitos: Imagem. Estritamente até 3 arquivos de 1MB.</span>
                                                </div>

                                                {imagePreviews[field.id] && imagePreviews[field.id].length > 0 && (
                                                    <div className="mt-4 flex gap-4 overflow-x-auto p-2 relative z-20">
                                                        {(imagePreviews[field.id] as string[]).map((imgUrl, i) => (
                                                            <div key={i} className="relative w-24 h-24 rounded-lg border border-pm-secondary/20 shadow-sm flex-shrink-0 group/img">
                                                                <img src={imgUrl} alt={`Foto ${i}`} className="w-full h-full object-cover rounded-lg" />
                                                                <button
                                                                    type="button"
                                                                    onClick={e => { e.preventDefault(); removeImage(field.id, i); }}
                                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover/img:opacity-100 transition-opacity shadow-md z-30 pointer-events-auto"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <div className="pt-6 border-t border-pm-secondary/10 flex justify-end">
                                    <button type="submit" disabled={activeFields.length === 0 || isSaving} className={`bg-pm-primary text-pm-light px-6 py-3 rounded-xl font-bold shadow-md flex items-center gap-2 transition-all ${activeFields.length === 0 || isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-pm-primary/90 hover:scale-[1.02]'}`}>
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />}
                                        {isSaving ? "Salvando..." : (activeGroup.mode === 'collection' && editingItemId ? "Salvar Edições da Matéria" : "Assinar Matrícula e Imputar Dados")}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
