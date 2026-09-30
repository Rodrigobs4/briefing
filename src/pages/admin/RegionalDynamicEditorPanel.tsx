import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Save,
    CheckCircle2,
    FileText,
    AlertCircle,
    X,
    Hash,
    Percent,
    Loader2,
    ChevronDown,
    MapPinned
} from 'lucide-react';
import { useAuth, type RegionalBriefingSection } from '../../store/AuthContext';
import { supabase } from '../../lib/supabase';
import { compareTextPtBr } from '../../utils/textOrdering';
import { formatBrazilianNumber, formatBrazilianNumericInput, parseBrazilianNumber } from '../../utils/brazilianNumbers';
import { getAccessibleRegionalCommands, userCanAccessRegionalCommand } from '../../utils/regionalCommandAccess';
import {
    loadSelectedRegionalCommandId,
    saveSelectedRegionalCommandId
} from '../regional/regionalCommandSelectionStorage';
import {
    type RegionalUpdateFrequency,
    todayIsoDate,
    currentYearStartIsoDate,
    getReferenceRangeByFrequency
} from '../regional/regionalReportPeriod';
import {
    buildRegionalValuePayload,
    calculateRegionalFieldValue,
    formDataToRegionalValues,
    getRegionalStoredValue
} from '../regional/regionalBriefingFieldUtils';
import { CURRENT_REPORT_YEAR } from '../../utils/reportYears';
import ReferenceYearSelect from '../../components/ReferenceYearSelect';

const CURRENT_REPORT_MONTH = new Date().getMonth() + 1;
const REPORT_MONTHS = Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: new Date(2026, index).toLocaleDateString('pt-BR', { month: 'long' })
}));

const getSectionFrequencyLabel = (section: RegionalBriefingSection) => {
    if (section.mode === 'collection') return 'Coleção';
    if (section.updateFrequency === 'yearly') return 'Anual';
    if (section.updateFrequency === 'monthly') return 'Mensal';
    if (section.updateFrequency === 'weekly') return 'Semanal';
    if (section.updateFrequency === 'semester') return 'Semestral';
    if (section.updateFrequency === 'custom') return 'Personalizado';
    return 'Fixo';
};

export default function RegionalDynamicEditorPanel() {
    const { user, regionalCommands, regionalBriefingSections, regionalBriefingFields, regionalBriefingEntries } = useAuth();

    const accessibleCommands = useMemo(() =>
        getAccessibleRegionalCommands(regionalCommands, user)
            .sort((left, right) => compareTextPtBr(left.name, right.name)),
        [regionalCommands, user]
    );

    const [selectedCommandId, setSelectedCommandId] = useState<string | null>(accessibleCommands[0]?.id ?? null);
    const selectedCommand = useMemo(
        () => accessibleCommands.find(command => command.id === selectedCommandId) ?? null,
        [accessibleCommands, selectedCommandId]
    );

    const mySections = useMemo(() =>
        regionalBriefingSections
            .filter(section => section.isActive)
            .sort((left, right) =>
                left.categoryOrder - right.categoryOrder
                || left.orderIndex - right.orderIndex
                || compareTextPtBr(left.title, right.title)
            ),
        [regionalBriefingSections]
    );

    const [activeSection, setActiveSection] = useState<RegionalBriefingSection | null>(mySections[0] ?? null);
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [referenceYear, setReferenceYear] = useState(CURRENT_REPORT_YEAR);
    const yearsWithData = useMemo(
        () => regionalBriefingEntries
            .filter(entry => entry.regionalCommandId === selectedCommandId && entry.sectionId === activeSection?.id)
            .map(entry => entry.referenceYear ?? (entry.referenceStartDate ? Number(entry.referenceStartDate.slice(0, 4)) : null)),
        [regionalBriefingEntries, selectedCommandId, activeSection?.id]
    );
    const [referenceMonth, setReferenceMonth] = useState(CURRENT_REPORT_MONTH);
    const [periodSemester, setPeriodSemester] = useState<'1' | '2'>('1');
    const [weekStartDate, setWeekStartDate] = useState(todayIsoDate());
    const [customStartDate, setCustomStartDate] = useState(currentYearStartIsoDate());
    const [customEndDate, setCustomEndDate] = useState(todayIsoDate());

    const [errorMess, setErrorMess] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<Date | null>(null);
    const [showSuccessBanner, setShowSuccessBanner] = useState(false);

    const [isCollectionListView, setIsCollectionListView] = useState(true);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [localCollectionItems, setLocalCollectionItems] = useState<Array<{
        id: string;
        createdAt: string;
        updatedAt: string;
    }>>([]);

    const activeFields = useMemo(() =>
        regionalBriefingFields
            .filter(field => field.sectionId === activeSection?.id && field.isActive)
            .sort((left, right) => left.orderIndex - right.orderIndex),
        [regionalBriefingFields, activeSection?.id]
    );

    const sectionFrequency = (activeSection?.updateFrequency ?? 'custom') as RegionalUpdateFrequency;
    const referenceRange = useMemo(() => getReferenceRangeByFrequency(
        sectionFrequency,
        referenceYear,
        referenceMonth,
        periodSemester,
        weekStartDate,
        customStartDate,
        customEndDate
    ), [sectionFrequency, referenceYear, referenceMonth, periodSemester, weekStartDate, customStartDate, customEndDate]);

    const referenceStartDate = referenceRange.startDate;
    const referenceEndDate = referenceRange.endDate;
    const referenceLabel = referenceRange.label;

    useEffect(() => {
        if (accessibleCommands.length === 0) return;
        const savedCommandId = loadSelectedRegionalCommandId();
        const savedCommand = savedCommandId
            ? accessibleCommands.find(command => command.id === savedCommandId)
            : null;
        setSelectedCommandId(current =>
            accessibleCommands.some(command => command.id === current)
                ? current
                : savedCommand?.id ?? accessibleCommands[0]?.id ?? null
        );
    }, [accessibleCommands]);

    useEffect(() => {
        setActiveSection(current =>
            mySections.find(section => section.id === current?.id)
            ?? mySections[0]
            ?? null
        );
    }, [mySections]);

    useEffect(() => {
        if (!activeSection || !selectedCommand) return;
        if (!userCanAccessRegionalCommand(user, selectedCommand.id)) return;

        setIsCollectionListView(true);
        setEditingItemId(null);
        setShowSuccessBanner(false);
        setErrorMess('');

        const loadSnapshotData = async () => {
            try {
                const { data: entry, error: entryError } = await supabase
                    .from('regional_briefing_entries')
                    .select('id, updated_at')
                    .eq('regional_command_id', selectedCommand.id)
                    .eq('section_id', activeSection.id)
                    .eq('reference_start_date', referenceStartDate)
                    .eq('reference_end_date', referenceEndDate)
                    .maybeSingle();

                if (entryError) throw entryError;

                if (entry) {
                    const { data: values, error: valError } = await supabase
                        .from('regional_briefing_values')
                        .select('field_id, value_text, value_number')
                        .eq('entry_id', entry.id);

                    if (valError) throw valError;

                    const prefillData: Record<string, string> = {};
                    for (const valueRow of values || []) {
                        const fieldDef = activeFields.find(field => field.id === valueRow.field_id);
                        if (!fieldDef) continue;
                        prefillData[valueRow.field_id] = getRegionalStoredValue(fieldDef, {
                            valueText: valueRow.value_text,
                            valueNumber: valueRow.value_number
                        });
                    }
                    setFormData(prefillData);
                    setSavedAt(new Date(entry.updated_at));
                } else {
                    setFormData({});
                    setSavedAt(null);
                }
            } catch (err) {
                console.error('Erro ao carregar dados regionais:', err);
            }
        };

        const loadCollectionItems = async () => {
            try {
                const { data, error } = await supabase
                    .from('regional_briefing_collection_items')
                    .select('id, created_at, updated_at')
                    .eq('regional_command_id', selectedCommand.id)
                    .eq('section_id', activeSection.id)
                    .eq('reference_start_date', referenceStartDate)
                    .eq('reference_end_date', referenceEndDate)
                    .eq('status', 'published')
                    .order('created_at', { ascending: false });

                if (error) throw error;

                setLocalCollectionItems((data || []).map(item => ({
                    id: item.id,
                    createdAt: item.created_at,
                    updatedAt: item.updated_at
                })));
            } catch (err) {
                console.error('Erro ao carregar coleção regional:', err);
            }
        };

        if (activeSection.mode === 'snapshot') {
            setIsCollectionListView(false);
            loadSnapshotData();
        } else {
            setIsCollectionListView(true);
            setEditingItemId(null);
            setFormData({});
            setSavedAt(null);
            loadCollectionItems();
        }
    }, [activeSection, selectedCommand, user, activeFields, referenceStartDate, referenceEndDate]);

    useEffect(() => {
        if (!activeSection) return;
        const calculatedFields = activeFields.filter(field => field.fieldType === 'calculated');
        if (calculatedFields.length === 0) return;

        const valuesByFieldId = formDataToRegionalValues(formData, activeFields);
        calculatedFields.forEach(field => {
            const calculatedValue = calculateRegionalFieldValue(field, activeFields, valuesByFieldId);
            const formattedValue = calculatedValue === null ? '' : formatBrazilianNumber(calculatedValue);
            if (calculatedValue !== null && formData[field.id] !== formattedValue) {
                setFormData(prev => ({ ...prev, [field.id]: formattedValue }));
            }
        });
    }, [formData, activeFields, activeSection]);

    const openCollectionItemEdit = async (itemId: string) => {
        setErrorMess('');
        setEditingItemId(itemId);
        setIsCollectionListView(false);

        const { data: itemValues, error } = await supabase
            .from('regional_briefing_collection_values')
            .select('field_id, value_text, value_number')
            .eq('item_id', itemId);

        if (error || !itemValues) return;

        const prefillData: Record<string, string> = {};
        for (const valueRow of itemValues) {
            const fieldDef = activeFields.find(field => field.id === valueRow.field_id);
            if (!fieldDef) continue;
            prefillData[valueRow.field_id] = getRegionalStoredValue(fieldDef, {
                valueText: valueRow.value_text,
                valueNumber: valueRow.value_number
            });
        }
        setFormData(prefillData);
        const item = localCollectionItems.find(entry => entry.id === itemId);
        setSavedAt(item ? new Date(item.createdAt) : null);
    };

    const deleteCollectionItem = async (itemId: string) => {
        if (!confirm('Excluir este item da coleção definitivamente?')) return;
        try {
            const { error } = await supabase
                .from('regional_briefing_collection_items')
                .delete()
                .eq('id', itemId);
            if (error) throw error;
            setLocalCollectionItems(prev => prev.filter(item => item.id !== itemId));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Não foi possível excluir o item.';
            setErrorMess(message);
        }
    };

    const getCollectionItemSummary = useCallback(async (itemId: string) => {
        const { data: itemValues } = await supabase
            .from('regional_briefing_collection_values')
            .select('value_text')
            .eq('item_id', itemId);

        const autoTitle = (itemValues || []).find(value => value.value_text && value.value_text.length > 5)?.value_text;
        return autoTitle ? `${autoTitle.substring(0, 40)}...` : `Registro #${itemId.substring(0, 6)}`;
    }, []);

    if (user?.role === 'editor' && accessibleCommands.length === 0) {
        return (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
                <MapPinned className="w-10 h-10 text-amber-600 mx-auto mb-3" />
                <h3 className="text-lg font-black text-amber-900">Nenhum Comando Regional atribuído</h3>
                <p className="text-sm font-medium text-amber-800 mt-2 max-w-lg mx-auto">
                    Solicite ao administrador o acesso ao Comando Regional responsável pelo seu preenchimento.
                </p>
            </div>
        );
    }

    if (mySections.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl shadow-sm border border-pm-secondary/20 h-96">
                <FileText className="w-16 h-16 text-pm-secondary/30 mb-4" />
                <h2 className="text-xl font-bold text-pm-dark">Nenhum Conjunto de Dados Pendente</h2>
                <p className="text-pm-secondary mt-2 max-w-md">
                    O Comando Geral ainda não configurou métricas ou relatórios para o briefing regional
                    {selectedCommand ? `: ${selectedCommand.name}` : ''}.
                </p>
            </div>
        );
    }

    const handleInputChange = (fieldId: string, value: string) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
        setErrorMess('');
    };

    const handleNumericInputChange = (fieldId: string, value: string, currency = false) => {
        handleInputChange(fieldId, formatBrazilianNumericInput(value, currency));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!activeSection || !user || !selectedCommand) {
            setErrorMess('Erro: Usuário ou comando regional não definidos.');
            return;
        }
        if (!userCanAccessRegionalCommand(user, selectedCommand.id)) {
            setErrorMess('Você não tem permissão para editar este Comando Regional.');
            return;
        }
        if (!referenceStartDate || !referenceEndDate || referenceEndDate < referenceStartDate) {
            setErrorMess('Informe um período válido para o lançamento.');
            return;
        }

        for (const field of activeFields) {
            const val = formData[field.id];
            const isEmpty = val === undefined || val === null || val === '';
            if (field.isRequired && isEmpty) {
                setErrorMess(`Por favor, preencha o campo obrigatório: ${field.label}`);
                return;
            }
            if (!isEmpty && ['number', 'currency', 'percentage'].includes(field.fieldType)) {
                const parsed = parseBrazilianNumber(val);
                if (Number.isNaN(parsed)) {
                    setErrorMess(`O campo "${field.label}" contém um valor numérico inválido.`);
                    return;
                }
            }
        }

        setIsSaving(true);
        setErrorMess('');

        try {
            const fieldsToSave = activeFields.filter(field => field.fieldType !== 'calculated');

            if (activeSection.mode === 'snapshot') {
                const { data: existingEntry, error: findError } = await supabase
                    .from('regional_briefing_entries')
                    .select('id')
                    .eq('regional_command_id', selectedCommand.id)
                    .eq('section_id', activeSection.id)
                    .eq('reference_start_date', referenceStartDate)
                    .eq('reference_end_date', referenceEndDate)
                    .maybeSingle();

                if (findError) throw findError;

                const entryPayload = {
                    regional_command_id: selectedCommand.id,
                    section_id: activeSection.id,
                    reference_label: referenceLabel,
                    reference_start_date: referenceStartDate,
                    reference_end_date: referenceEndDate,
                    updated_by: user.id
                };

                const { data: entry, error: entryError } = existingEntry
                    ? await supabase.from('regional_briefing_entries').update(entryPayload).eq('id', existingEntry.id).select('id').single()
                    : await supabase.from('regional_briefing_entries').insert(entryPayload).select('id').single();

                if (entryError) throw entryError;

                const { data: existingValues } = await supabase
                    .from('regional_briefing_values')
                    .select('id, field_id')
                    .eq('entry_id', entry.id);

                const upsertPromises = fieldsToSave.map(field => {
                    const payload = {
                        entry_id: entry.id,
                        ...buildRegionalValuePayload(field, formData[field.id] ?? '')
                    };
                    const existingVal = existingValues?.find(value => value.field_id === field.id);
                    if (existingVal) {
                        return supabase.from('regional_briefing_values').update(payload).eq('id', existingVal.id);
                    }
                    return supabase.from('regional_briefing_values').insert(payload);
                });

                await Promise.all(upsertPromises);
            } else {
                let itemId = editingItemId;

                if (editingItemId) {
                    await supabase.from('regional_briefing_collection_items')
                        .update({ updated_at: new Date().toISOString(), updated_by: user.id })
                        .eq('id', editingItemId);
                } else {
                    const { data: newItem, error: createError } = await supabase
                        .from('regional_briefing_collection_items')
                        .insert({
                            regional_command_id: selectedCommand.id,
                            section_id: activeSection.id,
                            reference_label: referenceLabel,
                            reference_start_date: referenceStartDate,
                            reference_end_date: referenceEndDate,
                            created_by: user.id,
                            updated_by: user.id,
                            status: 'published'
                        })
                        .select('id')
                        .single();
                    if (createError) throw createError;
                    itemId = newItem.id;
                }

                const { data: existingColValues } = await supabase
                    .from('regional_briefing_collection_values')
                    .select('id, field_id')
                    .eq('item_id', itemId);

                const colPromises = fieldsToSave.map(field => {
                    const existingVal = existingColValues?.find(value => value.field_id === field.id);
                    const payload = {
                        item_id: itemId,
                        ...buildRegionalValuePayload(field, formData[field.id] ?? '')
                    };
                    if (existingVal) {
                        return supabase.from('regional_briefing_collection_values').update(payload).eq('id', existingVal.id);
                    }
                    return supabase.from('regional_briefing_collection_values').insert(payload);
                });
                await Promise.all(colPromises);
            }

            setSavedAt(new Date());
            setShowSuccessBanner(true);

            setTimeout(async () => {
                setShowSuccessBanner(false);
                if (activeSection.mode === 'collection') {
                    setIsCollectionListView(true);
                    setEditingItemId(null);
                    setFormData({});
                    const { data } = await supabase
                        .from('regional_briefing_collection_items')
                        .select('id, created_at, updated_at')
                        .eq('regional_command_id', selectedCommand.id)
                        .eq('section_id', activeSection.id)
                        .eq('reference_start_date', referenceStartDate)
                        .eq('reference_end_date', referenceEndDate)
                        .eq('status', 'published')
                        .order('created_at', { ascending: false });
                    setLocalCollectionItems((data || []).map(item => ({
                        id: item.id,
                        createdAt: item.created_at,
                        updatedAt: item.updated_at
                    })));
                }
            }, 3000);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Falha ao salvar relatórios no Supabase.';
            setErrorMess(message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCommandChange = (commandId: string) => {
        setSelectedCommandId(commandId);
        saveSelectedRegionalCommandId(commandId);
    };

    const renderPeriodControls = () => {
        if (activeSection?.mode !== 'snapshot' && activeSection?.mode !== 'collection') return null;
        if (sectionFrequency === 'fixed') return null;

        return (
            <div className="rounded-xl border border-pm-primary/20 bg-pm-primary/5 p-4">
                <div className={`grid gap-3 ${
                    sectionFrequency === 'monthly' || sectionFrequency === 'custom'
                        ? 'sm:grid-cols-2'
                        : sectionFrequency === 'weekly'
                            ? 'sm:grid-cols-2'
                            : 'grid-cols-1'
                }`}>
                    {['monthly', 'semester', 'yearly'].includes(sectionFrequency) && (
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-pm-secondary mb-2">Ano de referência</label>
                            <ReferenceYearSelect
                                value={referenceYear}
                                onChange={setReferenceYear}
                                yearsWithData={yearsWithData}
                                className="w-full border border-pm-secondary/30 rounded-lg px-4 py-3 text-sm font-bold bg-white focus:ring-2 focus:ring-pm-primary outline-none"
                            />
                        </div>
                    )}
                    {sectionFrequency === 'monthly' && (
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-pm-secondary mb-2">Mês de referência</label>
                            <select
                                value={referenceMonth}
                                onChange={event => setReferenceMonth(Number(event.target.value))}
                                className="w-full border border-pm-secondary/30 rounded-lg px-4 py-3 text-sm font-bold bg-white focus:ring-2 focus:ring-pm-primary outline-none capitalize"
                            >
                                {REPORT_MONTHS.map(month => <option key={month.value} value={month.value}>{month.label}</option>)}
                            </select>
                        </div>
                    )}
                    {sectionFrequency === 'semester' && (
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-pm-secondary mb-2">Semestre</label>
                            <select
                                value={periodSemester}
                                onChange={event => setPeriodSemester(event.target.value as '1' | '2')}
                                className="w-full border border-pm-secondary/30 rounded-lg px-4 py-3 text-sm font-bold bg-white focus:ring-2 focus:ring-pm-primary outline-none"
                            >
                                <option value="1">1º Semestre</option>
                                <option value="2">2º Semestre</option>
                            </select>
                        </div>
                    )}
                    {sectionFrequency === 'weekly' && (
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-pm-secondary mb-2">Início da semana</label>
                            <input
                                type="date"
                                value={weekStartDate}
                                onChange={event => setWeekStartDate(event.target.value)}
                                className="w-full border border-pm-secondary/30 rounded-lg px-4 py-3 text-sm font-bold bg-white focus:ring-2 focus:ring-pm-primary outline-none"
                            />
                        </div>
                    )}
                    {sectionFrequency === 'custom' && (
                        <>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-pm-secondary mb-2">Data inicial</label>
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={event => setCustomStartDate(event.target.value)}
                                    className="w-full border border-pm-secondary/30 rounded-lg px-4 py-3 text-sm font-bold bg-white focus:ring-2 focus:ring-pm-primary outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-pm-secondary mb-2">Data final</label>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={event => setCustomEndDate(event.target.value)}
                                    className="w-full border border-pm-secondary/30 rounded-lg px-4 py-3 text-sm font-bold bg-white focus:ring-2 focus:ring-pm-primary outline-none"
                                />
                            </div>
                        </>
                    )}
                </div>
                <p className="text-xs text-pm-secondary mt-2">
                    Período selecionado: <strong className="text-pm-dark">{referenceLabel}</strong>
                </p>
            </div>
        );
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 space-y-3">
                {accessibleCommands.length > 1 && (
                    <div className="mb-4 px-1">
                        <label className="text-[10px] font-bold text-pm-secondary uppercase tracking-wider mb-1.5 block">Comando Regional</label>
                        <div className="relative">
                            <select
                                value={selectedCommandId || ''}
                                onChange={event => handleCommandChange(event.target.value)}
                                className="w-full appearance-none bg-white border border-pm-secondary/30 text-pm-dark text-sm rounded-xl pl-4 pr-10 py-3 focus:ring-2 focus:ring-pm-primary outline-none font-bold shadow-sm transition-all hover:border-pm-primary/50"
                            >
                                {accessibleCommands.map(command => (
                                    <option key={command.id} value={command.id}>{command.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="w-4 h-4 text-pm-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>
                )}

                <h3 className="font-bold text-pm-dark px-2 border-l-4 border-pm-primary">Seções na ordem do briefing</h3>
                <div className="flex flex-col gap-2">
                    {mySections.map((section, index) => (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section)}
                            className={`text-left p-4 rounded-xl border transition-all text-sm font-medium shadow-sm file-tab
                                ${activeSection?.id === section.id
                                    ? 'bg-pm-primary text-pm-dark border-pm-primary scale-[1.02]'
                                    : 'bg-white border-pm-secondary/20 hover:border-pm-primary/40 text-pm-secondary hover:text-pm-dark'}`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${activeSection?.id === section.id ? 'bg-pm-dark/15 text-pm-dark' : 'bg-pm-light text-pm-secondary'}`}>
                                    {index + 1}
                                </span>
                                <FileText className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{section.title}</span>
                            </div>
                            <span className={`ml-7 text-[10px] font-black uppercase tracking-wider ${activeSection?.id === section.id ? 'text-pm-dark/70' : 'text-pm-secondary/60'}`}>
                                {section.mode === 'collection' ? 'Coleção' : 'Snapshot'}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="lg:col-span-3">
                {activeSection ? (
                    <div className="bg-white rounded-xl shadow-sm border border-pm-secondary/20 overflow-hidden">
                        <div className="bg-pm-light px-6 py-5 border-b border-pm-secondary/10 flex justify-between items-center">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-bold text-pm-dark">{activeSection.title}</h2>
                                    <span className="text-[10px] font-bold text-pm-secondary uppercase border border-pm-secondary/30 px-1.5 py-0.5 rounded-full">
                                        {getSectionFrequencyLabel(activeSection)}
                                    </span>
                                </div>
                                <p className="text-sm text-pm-secondary">Preenchimento Oficial • {selectedCommand?.name || 'Selecione um Comando Regional'}</p>
                            </div>

                            {activeSection.mode === 'collection' && !isCollectionListView && (
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

                        {activeSection.mode === 'collection' && isCollectionListView ? (
                            <div className="p-6 space-y-6">
                                {renderPeriodControls()}

                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold text-pm-dark">Itens Registrados</h3>
                                    <button
                                        onClick={() => { setIsCollectionListView(false); setEditingItemId(null); setFormData({}); }}
                                        className="bg-pm-dark text-pm-light px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-pm-dark/90 transition-colors"
                                    >
                                        + Registrar Nova Entrada
                                    </button>
                                </div>

                                {localCollectionItems.length === 0 ? (
                                    <p className="text-center text-sm text-pm-secondary p-8 bg-pm-light/50 rounded-xl border border-pm-secondary/20">Ainda não existem registros arquivados aqui. Clique no botão acima para submeter a primeira.</p>
                                ) : (
                                    <CollectionItemsTable
                                        items={localCollectionItems}
                                        onOpen={openCollectionItemEdit}
                                        onDelete={deleteCollectionItem}
                                        getSummary={getCollectionItemSummary}
                                    />
                                )}
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                                {renderPeriodControls()}

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
                                            {field.label}
                                            {field.isRequired && <span className="text-red-500">*</span>}
                                        </label>

                                        {field.fieldType === 'text' && (
                                            <input
                                                type="text"
                                                value={formData[field.id] || ''}
                                                onChange={event => handleInputChange(field.id, event.target.value)}
                                                className="w-full border border-pm-secondary/30 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-pm-primary outline-none"
                                                placeholder="Resposta curta"
                                            />
                                        )}

                                        {field.fieldType === 'textarea' && (
                                            <textarea
                                                value={formData[field.id] || ''}
                                                onChange={event => handleInputChange(field.id, event.target.value)}
                                                className="w-full border border-pm-secondary/30 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-pm-primary outline-none min-h-[120px]"
                                                placeholder="Providencie os fatos ou relatos..."
                                            />
                                        )}

                                        {field.fieldType === 'date' && (
                                            <input
                                                type="date"
                                                value={formData[field.id] || ''}
                                                onChange={event => handleInputChange(field.id, event.target.value)}
                                                className="w-full border border-pm-secondary/30 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-pm-primary outline-none"
                                            />
                                        )}

                                        {field.fieldType === 'number' && (
                                            <div className="relative">
                                                <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-pm-secondary" />
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={formData[field.id] !== undefined ? formData[field.id] : ''}
                                                    onChange={event => handleNumericInputChange(field.id, event.target.value)}
                                                    className="w-full border border-pm-secondary/30 rounded-lg pl-9 pr-4 py-3 text-sm focus:ring-2 focus:ring-pm-primary outline-none"
                                                    placeholder="0"
                                                />
                                            </div>
                                        )}

                                        {field.fieldType === 'currency' && (
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={formData[field.id] !== undefined ? formData[field.id] : ''}
                                                onChange={event => handleNumericInputChange(field.id, event.target.value, true)}
                                                className="w-full border border-pm-secondary/30 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-pm-primary outline-none"
                                                placeholder="R$ 0,00"
                                            />
                                        )}

                                        {field.fieldType === 'percentage' && (
                                            <div className="relative">
                                                <Percent className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-pm-secondary" />
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={formData[field.id] !== undefined ? formData[field.id] : ''}
                                                    onChange={event => handleNumericInputChange(field.id, event.target.value)}
                                                    className="w-full border border-pm-secondary/30 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-pm-primary outline-none"
                                                    placeholder="Ex: 15,5%"
                                                />
                                            </div>
                                        )}

                                        {field.fieldType === 'calculated' && (
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
                                                {field.calculationConfig && (
                                                    <p className="text-[10px] text-pm-secondary pl-1">
                                                        Operação: {field.calculationConfig.operation === 'sum' ? 'Soma' : 'Subtração'} de {resolveRegionalCalculationSourceCount(field.calculationConfig)} campos.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <div className="pt-6 border-t border-pm-secondary/10 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={activeFields.length === 0 || isSaving}
                                        className={`bg-pm-primary text-pm-light px-6 py-3 rounded-xl font-bold shadow-md flex items-center gap-2 transition-all ${activeFields.length === 0 || isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-pm-primary/90 hover:scale-[1.02]'}`}
                                    >
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />}
                                        {isSaving ? 'Salvando...' : (activeSection.mode === 'collection' && editingItemId ? 'Salvar Edições da Matéria' : 'Assinar Matrícula e Imputar Dados')}
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

function resolveRegionalCalculationSourceCount(config: unknown) {
    if (!config || typeof config !== 'object') return 0;
    const record = config as Record<string, unknown>;
    if (Array.isArray(record.sourceFieldIds)) return record.sourceFieldIds.length;
    if (Array.isArray(record.fields)) return record.fields.length;
    return 0;
}

function CollectionItemsTable({
    items,
    onOpen,
    onDelete,
    getSummary
}: {
    items: Array<{ id: string; createdAt: string }>;
    onOpen: (itemId: string) => void;
    onDelete: (itemId: string) => void;
    getSummary: (itemId: string) => Promise<string>;
}) {
    const [summaries, setSummaries] = useState<Record<string, string>>({});

    useEffect(() => {
        let cancelled = false;
        items.forEach(item => {
            getSummary(item.id).then(summary => {
                if (!cancelled) {
                    setSummaries(prev => ({ ...prev, [item.id]: summary }));
                }
            });
        });
        return () => { cancelled = true; };
    }, [items, getSummary]);

    return (
        <div className="border border-pm-secondary/20 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-sm text-pm-dark min-w-[600px]">
                <thead className="bg-pm-light border-b border-pm-secondary/20">
                    <tr>
                        <th className="px-4 py-3 font-bold">Data Criação</th>
                        <th className="px-4 py-3 font-bold">Resumo Val.(Auto)</th>
                        <th className="px-4 py-3 font-bold text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-pm-secondary/10">
                    {items.map(item => (
                        <tr key={item.id} className="hover:bg-pm-light/30 transition-colors">
                            <td className="px-4 py-3 text-pm-secondary">{new Date(item.createdAt).toLocaleDateString('pt-BR')}</td>
                            <td className="px-4 py-3 font-medium truncate max-w-[200px]">{summaries[item.id] || 'Carregando...'}</td>
                            <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <button type="button" onClick={() => onOpen(item.id)} className="text-sm font-bold text-pm-secondary hover:text-pm-primary transition-colors">ABRIR</button>
                                    <button type="button" onClick={() => onDelete(item.id)} className="text-sm font-bold text-red-500 hover:text-red-700 transition-colors ml-2">EXCLUIR</button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
