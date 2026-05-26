import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../store/AuthContext';
import {
    ArrowDown,
    ArrowUp,
    Building2,
    CheckSquare,
    ChevronDown,
    ChevronRight,
    ClipboardCheck,
    Eye,
    FileText,
    Filter,
    Layers3,
    ListChecks,
    Loader2,
    Plus,
    Printer,
    Save,
    Search,
    SlidersHorizontal,
    Square,
    X
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import ReportPdfRenderer from './ReportPdfRenderer';
import { supabase } from '../../../lib/supabase';
import { compareTextPtBr, sortByTextPtBr } from '../../../utils/textOrdering';
import { isGeneralBriefingUnit } from '../../../utils/generalBriefingUnits';

type ReportHighlightTarget = 'row' | 'column' | 'cell';
type ReportHighlightColor = 'khaki' | 'blue' | 'green' | 'amber' | 'red';
type ReportTableHighlightRule = {
    id: string;
    groupId: string;
    target: ReportHighlightTarget;
    rowIndex?: number;
    columnIndex?: number;
    color: ReportHighlightColor;
};

type SavedReportConfiguration = {
    selectedUnits: string[];
    selectedGroups: string[];
    customCategories: string[];
    categoryOrder: string[];
    unitOrder: string[];
    groupOrder: string[];
    fieldOrder: Record<string, string[]>;
    groupAssignments: Record<string, string>;
    fontSize: 'standard' | 'large';
    technicalSections: {
        showExecutiveSummary: boolean;
        showSubjectMap: boolean;
    };
    tableHighlights?: ReportTableHighlightRule[];
};

const getStringArray = (value: unknown) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const REPORT_HIGHLIGHT_COLORS: Array<{ value: ReportHighlightColor; label: string; swatch: string }> = [
    { value: 'khaki', label: 'Dourado suave', swatch: 'bg-[#eee7bf]' },
    { value: 'blue', label: 'Azul', swatch: 'bg-blue-100' },
    { value: 'green', label: 'Verde', swatch: 'bg-emerald-100' },
    { value: 'amber', label: 'Amarelo', swatch: 'bg-amber-100' },
    { value: 'red', label: 'Vermelho', swatch: 'bg-red-100' }
];
const REPORT_HIGHLIGHT_TARGET_LABELS: Record<ReportHighlightTarget, string> = {
    row: 'Linha',
    column: 'Coluna',
    cell: 'Célula'
};
const isReportHighlightTarget = (value: unknown): value is ReportHighlightTarget =>
    value === 'row' || value === 'column' || value === 'cell';
const isReportHighlightColor = (value: unknown): value is ReportHighlightColor =>
    REPORT_HIGHLIGHT_COLORS.some(color => color.value === value);
const GLOBAL_REPORT_CONFIGURATION_ID = 'general';

export default function ReportBuilderModal({ onClose }: { onClose: () => void }) {
    const { units: allUnits, regionalCommands, dataGroups, fields, user } = useAuth();
    const reportUnits = sortByTextPtBr(allUnits.filter(unit => isGeneralBriefingUnit(unit, regionalCommands)), unit => unit.name);
    const editorUnitIds = user?.unitIds && user.unitIds.length > 0
        ? user.unitIds
        : user?.unitId
            ? [user.unitId]
            : [];
    const units = user?.role === 'editor' ? reportUnits.filter(unit => editorUnitIds.includes(unit.id)) : reportUnits;
    const visibleUnitIds = units.map(unit => unit.id);
    const visibleDataGroups = dataGroups.filter(group => visibleUnitIds.includes(group.unitId));
    const canManageGlobalModel = user?.role === 'admin';

    const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [expandedUnits, setExpandedUnits] = useState<string[]>([]);
    const [collapsedCategories, setCollapsedCategories] = useState<string[]>([]);
    const [customCategories, setCustomCategories] = useState<string[]>([]);
    const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
    const [unitOrder, setUnitOrder] = useState<string[]>([]);
    const [groupOrder, setGroupOrder] = useState<string[]>([]);
    const [fieldOrder, setFieldOrder] = useState<Record<string, string[]>>({});
    const [groupAssignments, setGroupAssignments] = useState<Record<string, string>>({});
    const [newCategoryName, setNewCategoryName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [reportMode, setReportMode] = useState<'builder' | 'preview'>('builder');
    const [fontSize, setFontSize] = useState<'standard' | 'large'>('standard');
    const [technicalSections, setTechnicalSections] = useState({
        showExecutiveSummary: true,
        showSubjectMap: true
    });
    const [tableHighlights, setTableHighlights] = useState<ReportTableHighlightRule[]>([]);
    const [highlightEditingGroupId, setHighlightEditingGroupId] = useState('');
    const [highlightTarget, setHighlightTarget] = useState<ReportHighlightTarget>('row');
    const [highlightRow, setHighlightRow] = useState(1);
    const [highlightColumn, setHighlightColumn] = useState(1);
    const [highlightColor, setHighlightColor] = useState<ReportHighlightColor>('khaki');
    const [isSavingHighlight, setIsSavingHighlight] = useState(false);
    const [isLoadingSavedModel, setIsLoadingSavedModel] = useState(false);
    const [isSavingModel, setIsSavingModel] = useState(false);
    const [modelMessage, setModelMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [modelReloadRequest, setModelReloadRequest] = useState(0);

    const printRef = useRef<HTMLDivElement>(null);
    const loadedConfigurationUserId = useRef<string | null>(null);

    useEffect(() => {
        let isActive = true;

        const loadSavedConfiguration = async () => {
            if (!user?.id) {
                loadedConfigurationUserId.current = null;
                if (isActive) setIsLoadingSavedModel(false);
                return;
            }
            if (loadedConfigurationUserId.current === user.id) return;
            if (allUnits.length === 0 || dataGroups.length === 0) {
                setIsLoadingSavedModel(false);
                return;
            }

            setIsLoadingSavedModel(true);
            setModelMessage(null);
            let timeoutId: ReturnType<typeof setTimeout> | undefined;
            try {
                const [configurationResult, highlightResult] = await Promise.race([
                    Promise.all([
                        supabase
                            .from('global_report_configurations')
                            .select('configuration')
                            .eq('id', GLOBAL_REPORT_CONFIGURATION_ID)
                            .maybeSingle(),
                        supabase
                            .from('global_report_table_highlights')
                            .select('id, data_group_id, target, row_index, column_index, color')
                    ]),
                    new Promise<never>((_, reject) => {
                        timeoutId = setTimeout(() => reject(new Error('Tempo excedido ao carregar modelo.')), 10000);
                    })
                ]);

                if (!isActive) return;
                if (configurationResult.error) throw configurationResult.error;
                if (highlightResult.error) throw highlightResult.error;

                loadedConfigurationUserId.current = user.id;
                const data = configurationResult.data;
                const configuration = (data?.configuration || {}) as Partial<SavedReportConfiguration>;
                const allowedUnitIds = new Set(visibleUnitIds);
                const allowedGroupIds = new Set(visibleDataGroups.map(group => group.id));
                const restoredUnits = getStringArray(configuration.selectedUnits).filter(id => allowedUnitIds.has(id));
                const restoredGroups = getStringArray(configuration.selectedGroups).filter(id => allowedGroupIds.has(id));
                const assignments = configuration.groupAssignments && typeof configuration.groupAssignments === 'object'
                    ? Object.fromEntries(
                        Object.entries(configuration.groupAssignments)
                            .filter(([unitId, category]) => allowedUnitIds.has(unitId) && typeof category === 'string')
                    )
                    : {};
                const restoredFieldOrder = configuration.fieldOrder && typeof configuration.fieldOrder === 'object'
                    ? Object.fromEntries(
                        Object.entries(configuration.fieldOrder)
                            .filter(([groupId, order]) => allowedGroupIds.has(groupId) && Array.isArray(order))
                            .map(([groupId, order]) => {
                                const allowedFieldIds = new Set(fields
                                    .filter(field => field.dataGroupId === groupId && field.isActive && field.type !== 'image')
                                    .map(field => field.id));
                                return [groupId, getStringArray(order).filter(id => allowedFieldIds.has(id))];
                            })
                    )
                    : {};

                setSelectedUnits(restoredUnits);
                setSelectedGroups(restoredGroups);
                setCustomCategories(getStringArray(configuration.customCategories));
                setCategoryOrder(getStringArray(configuration.categoryOrder));
                setUnitOrder(getStringArray(configuration.unitOrder).filter(id => restoredUnits.includes(id)));
                setGroupOrder(getStringArray(configuration.groupOrder).filter(id => restoredGroups.includes(id)));
                setFieldOrder(restoredFieldOrder);
                setGroupAssignments(assignments);
                setExpandedUnits(restoredUnits);
                setFontSize(configuration.fontSize === 'large' ? 'large' : 'standard');
                setTechnicalSections({
                    showExecutiveSummary: configuration.technicalSections?.showExecutiveSummary !== false,
                    showSubjectMap: configuration.technicalSections?.showSubjectMap !== false
                });
                const persistedHighlights = (highlightResult.data || [])
                    .filter(rule => allowedGroupIds.has(rule.data_group_id) && isReportHighlightTarget(rule.target) && isReportHighlightColor(rule.color))
                    .map(rule => ({
                        id: rule.id,
                        groupId: rule.data_group_id,
                        target: rule.target as ReportHighlightTarget,
                        rowIndex: rule.row_index >= 0 ? rule.row_index : undefined,
                        columnIndex: rule.column_index >= 0 ? rule.column_index : undefined,
                        color: rule.color as ReportHighlightColor
                    }));
                setTableHighlights(persistedHighlights);
                setModelMessage(data?.configuration
                    ? { type: 'success', text: 'Modelo global carregado.' }
                    : { type: 'success', text: canManageGlobalModel ? 'Nenhum modelo global encontrado. Monte o relatório e publique o modelo.' : 'Nenhum modelo global foi publicado pelo administrador.' });
            } catch (error) {
                if (!isActive) return;
                loadedConfigurationUserId.current = null;
                console.error('Falha ao carregar modelo de relatório:', error);
                setModelMessage({ type: 'error', text: 'Não foi possível carregar o modelo salvo. Tente recarregar.' });
            } finally {
                if (timeoutId) clearTimeout(timeoutId);
                if (isActive) setIsLoadingSavedModel(false);
            }
        };

        loadSavedConfiguration();
        return () => {
            isActive = false;
        };
    }, [user?.id, allUnits.length, dataGroups.length, fields, modelReloadRequest, canManageGlobalModel]);

    const reloadSavedModel = () => {
        loadedConfigurationUserId.current = null;
        setModelReloadRequest(previous => previous + 1);
    };

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Briefing Geral PMBA - ${new Date().toISOString().split('T')[0]}`
    });

    const appendGroupsToOrder = (groupIds: string[]) => {
        setGroupOrder(prev => [...prev, ...groupIds.filter(id => !prev.includes(id))]);
    };

    const appendUnitToOrder = (unitId: string) => {
        setUnitOrder(prev => prev.includes(unitId) ? prev : [...prev, unitId]);
    };

    const removeUnitFromOrder = (unitId: string) => {
        setUnitOrder(prev => prev.filter(id => id !== unitId));
    };

    const removeGroupsFromOrder = (groupIds: string[]) => {
        setGroupOrder(prev => prev.filter(id => !groupIds.includes(id)));
    };

    const toggleUnit = (unitId: string) => {
        const unitGroups = visibleDataGroups.filter(g => g.unitId === unitId).map(g => g.id);

        if (selectedUnits.includes(unitId)) {
            setSelectedUnits(prev => prev.filter(id => id !== unitId));
            setSelectedGroups(prev => prev.filter(id => !unitGroups.includes(id)));
            removeUnitFromOrder(unitId);
            removeGroupsFromOrder(unitGroups);
            return;
        }

        setSelectedUnits(prev => [...prev, unitId]);
        setSelectedGroups(prev => Array.from(new Set([...prev, ...unitGroups])));
        appendUnitToOrder(unitId);
        appendGroupsToOrder(unitGroups);
        setExpandedUnits(prev => prev.includes(unitId) ? prev : [...prev, unitId]);
    };

    const addFullTopicFromSection = (unitId: string) => {
        if (!selectedUnits.includes(unitId)) {
            toggleUnit(unitId);
        }
    };

    const toggleExpandUnit = (unitId: string) => {
        setExpandedUnits(prev =>
            prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]
        );
    };

    const toggleCategoryCollapse = (category: string) => {
        setCollapsedCategories(prev =>
            prev.includes(category) ? prev.filter(item => item !== category) : [...prev, category]
        );
    };

    const handleSelectAll = () => {
        const groupIds = visibleDataGroups.map(g => g.id);
        const unitIds = units.map(u => u.id);
        setSelectedUnits(unitIds);
        setSelectedGroups(groupIds);
        setUnitOrder(unitIds);
        setGroupOrder(groupIds);
        setExpandedUnits(units.map(u => u.id));
    };

    const handleClearAll = () => {
        setSelectedUnits([]);
        setSelectedGroups([]);
        setUnitOrder([]);
        setGroupOrder([]);
        setGroupAssignments({});
    };

    const getLegacyCategory = (unitId: string) => visibleDataGroups
        .filter(group => group.unitId === unitId && group.categoryTitle?.trim())
        .sort((a, b) => (a.categoryOrder ?? 999) - (b.categoryOrder ?? 999) || a.order - b.order)[0]?.categoryTitle?.trim();
    const getTopicCategory = (unitId: string) => {
        const unit = units.find(item => item.id === unitId);
        return groupAssignments[unitId] || unit?.reportCategoryTitle?.trim() || getLegacyCategory(unitId) || 'Geral';
    };

    const getGroupOrderIndex = (groupId: string) => {
        const index = groupOrder.indexOf(groupId);
        return index >= 0 ? index : 9999;
    };

    const selectedGroupObjects = visibleDataGroups
        .filter(group => selectedGroups.includes(group.id))
        .sort((a, b) => getGroupOrderIndex(a.id) - getGroupOrderIndex(b.id) || a.order - b.order);

    useEffect(() => {
        if (highlightEditingGroupId && !selectedGroups.includes(highlightEditingGroupId)) {
            setHighlightEditingGroupId('');
        }
    }, [highlightEditingGroupId, selectedGroups]);

    const getUnitOrderIndex = (unitId: string) => {
        const index = unitOrder.indexOf(unitId);
        return index >= 0 ? index : 9999;
    };

    const getGroupsForUnit = (unitId: string) => selectedGroupObjects
        .filter(group => group.unitId === unitId)
        .sort((a, b) => getGroupOrderIndex(a.id) - getGroupOrderIndex(b.id) || a.order - b.order);

    const getFieldsForGroup = (groupId: string) => {
        const configuredOrder = fieldOrder[groupId] ?? [];
        const getConfiguredIndex = (fieldId: string) => {
            const index = configuredOrder.indexOf(fieldId);
            return index >= 0 ? index : 9999;
        };

        return fields
            .filter(field => field.dataGroupId === groupId && field.isActive && field.type !== 'image')
            .sort((a, b) => getConfiguredIndex(a.id) - getConfiguredIndex(b.id) || a.order - b.order);
    };

    const moveField = (groupId: string, fieldId: string, direction: 'up' | 'down') => {
        const orderedFieldIds = getFieldsForGroup(groupId).map(field => field.id);
        const index = orderedFieldIds.indexOf(fieldId);
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (index < 0 || targetIndex < 0 || targetIndex >= orderedFieldIds.length) return;

        [orderedFieldIds[index], orderedFieldIds[targetIndex]] = [orderedFieldIds[targetIndex], orderedFieldIds[index]];
        setFieldOrder(previous => ({ ...previous, [groupId]: orderedFieldIds }));
    };

    const selectedUnitObjects = units
        .filter(unit => selectedUnits.includes(unit.id) && getGroupsForUnit(unit.id).length > 0)
        .sort((a, b) => getUnitOrderIndex(a.id) - getUnitOrderIndex(b.id) || (a.order_index ?? 999) - (b.order_index ?? 999));

    const baseReportCategories = Array.from(new Set([
        ...selectedUnitObjects.map(unit => getTopicCategory(unit.id)),
        ...customCategories
    ].filter(Boolean)));

    const reportCategories = [
        ...categoryOrder.filter(category => baseReportCategories.includes(category)),
        ...baseReportCategories.filter(category => !categoryOrder.includes(category))
    ];

    const topicsByCategory = reportCategories.map(category => ({
        category,
        topics: selectedUnitObjects.filter(unit => getTopicCategory(unit.id) === category)
    }));

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filteredUnits = units
        .map(unit => ({
            unit,
            groups: visibleDataGroups.filter(group => {
                if (group.unitId !== unit.id) return false;
                if (!normalizedSearch) return true;
                const haystack = `${unit.name} ${group.title} ${getTopicCategory(unit.id)}`.toLowerCase();
                return haystack.includes(normalizedSearch);
            }).sort((a, b) => compareTextPtBr(a.title, b.title))
        }))
        .filter(item => !normalizedSearch || item.groups.length > 0 || item.unit.name.toLowerCase().includes(normalizedSearch))
        .sort((a, b) => compareTextPtBr(a.unit.name, b.unit.name));

    const addCategory = () => {
        const category = newCategoryName.trim();
        if (!category || reportCategories.includes(category)) return;
        setCustomCategories(prev => [...prev, category]);
        setCategoryOrder(prev => [...prev, category]);
        setNewCategoryName('');
    };

    const removeEmptyCategory = (category: string) => {
        setCustomCategories(prev => prev.filter(item => item !== category));
        setCategoryOrder(prev => prev.filter(item => item !== category));
    };

    const moveCategory = (category: string, direction: 'up' | 'down') => {
        const idx = reportCategories.indexOf(category);
        if (idx < 0) return;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= reportCategories.length) return;
        const next = [...reportCategories];
        [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
        setCategoryOrder(next);
    };

    const rebuildGroupOrderFromUnits = (orderedUnitIds: string[]) => {
        const nextGroupOrder = orderedUnitIds.flatMap(unitId => {
            const unitGroups = visibleDataGroups
                .filter(group => group.unitId === unitId && selectedGroups.includes(group.id))
                .sort((a, b) => a.order - b.order);
            return unitGroups.map(group => group.id);
        });

        setGroupOrder(nextGroupOrder);
    };

    const moveTopic = (unitId: string, categoryTopics: { id: string }[], direction: 'up' | 'down') => {
        const categoryIndex = categoryTopics.findIndex(unit => unit.id === unitId);
        const targetCategoryIndex = direction === 'up' ? categoryIndex - 1 : categoryIndex + 1;
        if (categoryIndex < 0 || targetCategoryIndex < 0 || targetCategoryIndex >= categoryTopics.length) return;

        const orderedIds = selectedUnitObjects.map(unit => unit.id);
        const currentGlobalIndex = orderedIds.indexOf(unitId);
        const targetGlobalIndex = orderedIds.indexOf(categoryTopics[targetCategoryIndex].id);
        if (currentGlobalIndex < 0 || targetGlobalIndex < 0) return;

        [orderedIds[currentGlobalIndex], orderedIds[targetGlobalIndex]] = [orderedIds[targetGlobalIndex], orderedIds[currentGlobalIndex]];
        setUnitOrder(orderedIds);
        rebuildGroupOrderFromUnits(orderedIds);
    };

    const assignTopicCategory = (unitId: string, category: string) => {
        setGroupAssignments(prev => ({
            ...prev,
            [unitId]: category
        }));
        setCategoryOrder(prev => prev.includes(category) ? prev : [...prev, category]);
    };

    const selectedCategoryCount = topicsByCategory.filter(item => item.topics.length > 0).length;
    const collectionCount = selectedGroupObjects.filter(group => group.mode === 'collection').length;
    const snapshotCount = selectedGroupObjects.length - collectionCount;
    const isPrintable = selectedUnits.length > 0 && selectedGroups.length > 0;
    const sharedReportConfig = {
        groupAssignments,
        categoryOrder: reportCategories,
        unitOrder,
        groupOrder,
        fieldOrder,
        tableHighlights: tableHighlights.filter(rule => selectedGroups.includes(rule.groupId))
    };
    const toggleTechnicalSection = (section: keyof typeof technicalSections) => {
        setTechnicalSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const addTableHighlight = async (groupId: string) => {
        if (!user?.id || !canManageGlobalModel) {
            setModelMessage({ type: 'error', text: 'Somente administradores podem alterar o modelo global.' });
            return;
        }

        const rowIndex = highlightTarget === 'column' ? undefined : Math.max(0, highlightRow - 1);
        const columnIndex = highlightTarget === 'row' ? undefined : Math.max(0, highlightColumn - 1);
        setIsSavingHighlight(true);
        setModelMessage(null);
        try {
            const { data, error } = await supabase
                .from('global_report_table_highlights')
                .upsert({
                    data_group_id: groupId,
                    target: highlightTarget,
                    row_index: rowIndex ?? -1,
                    column_index: columnIndex ?? -1,
                    color: highlightColor,
                    updated_by: user.id,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'data_group_id,target,row_index,column_index' })
                .select('id')
                .single();

            if (error) throw error;
            const rule: ReportTableHighlightRule = {
                id: data.id,
                groupId,
                target: highlightTarget,
                rowIndex,
                columnIndex,
                color: highlightColor
            };
            setTableHighlights(previous => [
                ...previous.filter(item => !(
                    item.groupId === rule.groupId
                    && item.target === rule.target
                    && item.rowIndex === rule.rowIndex
                    && item.columnIndex === rule.columnIndex
                )),
                rule
            ]);
            setModelMessage({ type: 'success', text: 'Cor da tabela salva.' });
        } catch (error) {
            console.error('Falha ao salvar cor do relatório:', error);
            setModelMessage({ type: 'error', text: 'Não foi possível salvar a cor da tabela.' });
        } finally {
            setIsSavingHighlight(false);
        }
    };

    const removeTableHighlight = async (ruleId: string) => {
        if (!user?.id || !canManageGlobalModel) return;

        setIsSavingHighlight(true);
        setModelMessage(null);
        try {
            const { error } = await supabase
                .from('global_report_table_highlights')
                .delete()
                .eq('id', ruleId)
            if (error) throw error;
            setTableHighlights(previous => previous.filter(rule => rule.id !== ruleId));
            setModelMessage({ type: 'success', text: 'Cor removida.' });
        } catch (error) {
            console.error('Falha ao remover cor do relatório:', error);
            setModelMessage({ type: 'error', text: 'Não foi possível remover a cor da tabela.' });
        } finally {
            setIsSavingHighlight(false);
        }
    };

    const saveReportConfiguration = async () => {
        if (!user?.id || !canManageGlobalModel) {
            setModelMessage({ type: 'error', text: 'Somente administradores podem publicar o modelo global.' });
            return;
        }

        const configuration: SavedReportConfiguration = {
            selectedUnits: selectedUnits.filter(id => visibleUnitIds.includes(id)),
            selectedGroups: selectedGroups.filter(id => visibleDataGroups.some(group => group.id === id)),
            customCategories,
            categoryOrder: reportCategories,
            unitOrder: unitOrder.filter(id => selectedUnits.includes(id)),
            groupOrder: groupOrder.filter(id => selectedGroups.includes(id)),
            fieldOrder: Object.fromEntries(
                selectedGroups.map(groupId => [groupId, getFieldsForGroup(groupId).map(field => field.id)])
            ),
            groupAssignments: Object.fromEntries(
                Object.entries(groupAssignments).filter(([unitId]) => visibleUnitIds.includes(unitId))
            ),
            fontSize,
            technicalSections
        };

        setIsSavingModel(true);
        setModelMessage(null);
        try {
            const { error } = await supabase
                .from('global_report_configurations')
                .upsert({
                    id: GLOBAL_REPORT_CONFIGURATION_ID,
                    configuration,
                    updated_by: user.id,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'id' });

            setModelMessage(error
                ? { type: 'error', text: 'Falha ao publicar o modelo global.' }
                : { type: 'success', text: 'Modelo global publicado para todos os usuários.' });
        } finally {
            setIsSavingModel(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-pm-dark/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4">
            <div className="bg-[#f8f7f2] rounded-2xl shadow-2xl w-full max-w-[96vw] h-[94vh] border border-white/70 flex flex-col overflow-hidden">
                <div className="bg-white px-5 py-4 border-b border-pm-secondary/15 shrink-0">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-pm-secondary">
                                <Printer className="w-4 h-4 text-pm-primary" />
                                Impressão executiva
                            </div>
                            <h2 className="text-2xl font-black text-pm-dark tracking-tight mt-1">
                                Gerenciador do Briefing Geral
                            </h2>
                            <p className="text-sm text-pm-secondary mt-1">
                                Monte apenas o briefing geral por categorias, ordem de leitura e seções selecionadas.
                            </p>
                        </div>
                        <button onClick={onClose} className="text-pm-secondary hover:text-pm-dark p-2 hover:bg-pm-light rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex flex-col lg:flex-row lg:flex-wrap 2xl:flex-nowrap lg:items-end justify-between gap-4 mt-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 flex-1">
                        <div className="bg-[#ede7d2] border border-[#d7ca9a] rounded-lg px-3 py-2.5">
                            <span className="text-[10px] uppercase tracking-widest font-black text-pm-secondary flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5" /> Tópicos
                            </span>
                            <strong className="text-lg text-pm-dark leading-none mt-1 block">{selectedUnits.length}</strong>
                        </div>
                        <div className="bg-white border border-pm-secondary/15 rounded-lg px-3 py-2.5">
                            <span className="text-[10px] uppercase tracking-widest font-black text-pm-secondary flex items-center gap-1.5">
                                <Layers3 className="w-3.5 h-3.5" /> Categorias
                            </span>
                            <strong className="text-lg text-pm-dark leading-none mt-1 block">{selectedCategoryCount}</strong>
                        </div>
                        <div className="bg-white border border-pm-secondary/15 rounded-lg px-3 py-2.5">
                            <span className="text-[10px] uppercase tracking-widest font-black text-pm-secondary flex items-center gap-1.5">
                                <ListChecks className="w-3.5 h-3.5" /> Seções
                            </span>
                            <strong className="text-lg text-pm-dark leading-none mt-1 block">{selectedGroups.length}</strong>
                        </div>
                        <div className="bg-white border border-pm-secondary/15 rounded-lg px-3 py-2.5">
                            <span className="text-[10px] uppercase tracking-widest font-black text-pm-secondary flex items-center gap-1.5">
                                <ClipboardCheck className="w-3.5 h-3.5" /> Conteúdo
                            </span>
                            <strong className="text-sm text-pm-dark leading-none mt-2 block">{snapshotCount} indicadores / {collectionCount} listas</strong>
                        </div>
                        </div>

                        <div className="bg-pm-light border border-pm-secondary/15 rounded-xl p-1 flex shrink-0" aria-label="Tamanho da fonte no relatório">
                            <button
                                onClick={() => setFontSize('standard')}
                                className={`px-3 py-2 rounded-lg text-xs font-black uppercase transition-colors ${fontSize === 'standard' ? 'bg-white text-pm-dark shadow-sm' : 'text-pm-secondary hover:text-pm-dark'}`}
                            >
                                Fonte padrão
                            </button>
                            <button
                                onClick={() => setFontSize('large')}
                                className={`px-3 py-2 rounded-lg text-xs font-black uppercase transition-colors ${fontSize === 'large' ? 'bg-white text-pm-dark shadow-sm' : 'text-pm-secondary hover:text-pm-dark'}`}
                            >
                                Fonte ampliada
                            </button>
                        </div>

                        <div className="bg-white border border-pm-secondary/15 rounded-xl p-2 flex flex-col sm:flex-row gap-1.5 shrink-0">
                                <button
                                    onClick={() => toggleTechnicalSection('showExecutiveSummary')}
                                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase flex items-center gap-1.5 text-pm-dark hover:bg-pm-light transition-colors"
                                >
                                    {technicalSections.showExecutiveSummary ? <CheckSquare className="w-3.5 h-3.5 text-pm-primary" /> : <Square className="w-3.5 h-3.5 text-pm-secondary" />}
                                    Resumo executivo
                                </button>
                                <button
                                    onClick={() => toggleTechnicalSection('showSubjectMap')}
                                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase flex items-center gap-1.5 text-pm-dark hover:bg-pm-light transition-colors"
                                >
                                    {technicalSections.showSubjectMap ? <CheckSquare className="w-3.5 h-3.5 text-pm-primary" /> : <Square className="w-3.5 h-3.5 text-pm-secondary" />}
                                    Mapa de assuntos
                                </button>
                        </div>

                        <div className="bg-pm-light border border-pm-secondary/15 rounded-xl p-1 flex shrink-0">
                            <button
                                onClick={() => setReportMode('builder')}
                                className={`px-3 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 transition-colors ${reportMode === 'builder' ? 'bg-white text-pm-dark shadow-sm' : 'text-pm-secondary hover:text-pm-dark'}`}
                            >
                                <SlidersHorizontal className="w-3.5 h-3.5" /> Montagem
                            </button>
                            <button
                                onClick={() => setReportMode('preview')}
                                disabled={!isPrintable}
                                className={`px-3 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${reportMode === 'preview' ? 'bg-white text-pm-dark shadow-sm' : 'text-pm-secondary hover:text-pm-dark'}`}
                            >
                                <Eye className="w-3.5 h-3.5" /> Prévia A4
                            </button>
                        </div>
                    </div>
                </div>

                {reportMode === 'builder' ? (
                <div
                    className="grid gap-0 flex-1 min-h-0 overflow-hidden"
                    style={{ gridTemplateColumns: '340px minmax(0, 1fr)' }}
                >
                    <aside className="bg-white border-r border-pm-secondary/15 flex flex-col min-h-0">
                        <div className="p-3.5 border-b border-pm-secondary/10">
                            <div className="flex items-center gap-2 mb-3">
                                <Filter className="w-4 h-4 text-pm-primary" />
                                <h3 className="text-sm font-black text-pm-dark uppercase tracking-tight">Biblioteca de tópicos</h3>
                            </div>

                            <div className="relative">
                                <Search className="w-4 h-4 text-pm-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    value={searchTerm}
                                    onChange={event => setSearchTerm(event.target.value)}
                                    placeholder="Buscar tópico, seção ou categoria"
                                    className="w-full border border-pm-secondary/20 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pm-primary/25 bg-white"
                                />
                            </div>

                            <div className="flex gap-2 mt-3">
                                <button onClick={handleSelectAll} className="flex-1 px-3 py-2 text-xs font-black bg-pm-dark text-white hover:bg-pm-primary rounded-lg transition-colors flex items-center justify-center gap-1.5">
                                    <CheckSquare className="w-3.5 h-3.5" /> Todos
                                </button>
                                <button onClick={handleClearAll} className="flex-1 px-3 py-2 text-xs font-black bg-pm-light text-pm-dark hover:bg-pm-secondary/20 rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-pm-secondary/20">
                                    <Square className="w-3.5 h-3.5" /> Limpar
                                </button>
                            </div>
                        </div>

                        <div className="overflow-y-auto custom-scrollbar p-3.5 space-y-2.5">
                            {filteredUnits.length === 0 && (
                                <p className="text-sm text-pm-secondary text-center py-8">Nenhum tópico encontrado.</p>
                            )}

                            {filteredUnits.map(({ unit, groups }) => {
                                const unitGroups = visibleDataGroups.filter(g => g.unitId === unit.id);
                                const isUnitSelected = selectedUnits.includes(unit.id);
                                const isExpanded = expandedUnits.includes(unit.id) || normalizedSearch.length > 0;
                                const selectedCount = unitGroups.filter(group => selectedGroups.includes(group.id)).length;

                                return (
                                    <div key={unit.id} className="border border-pm-secondary/15 rounded-xl overflow-hidden bg-white shadow-sm">
                                        <div className={`px-3 py-2.5 flex items-center justify-between transition-colors ${isUnitSelected ? 'bg-[#ede7d2] border-b border-[#d7ca9a]' : 'hover:bg-pm-light/60'}`}>
                                            <button className="flex items-center gap-3 min-w-0 text-left" onClick={() => toggleUnit(unit.id)}>
                                                <span className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${isUnitSelected ? 'bg-pm-dark border-pm-dark text-white' : 'border-pm-secondary/40 bg-white'}`}>
                                                    {isUnitSelected && <CheckSquare className="w-3.5 h-3.5" />}
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="font-black text-pm-dark leading-tight block truncate">{unit.name}</span>
                                                    <span className="text-[10px] text-pm-secondary uppercase tracking-wider mt-0.5 font-bold block">
                                                        {selectedCount}/{unitGroups.length} seções selecionadas
                                                    </span>
                                                </span>
                                            </button>
                                            <button
                                                className="p-1.5 text-pm-secondary hover:text-pm-primary rounded-full hover:bg-white/70 transition-colors"
                                                onClick={() => toggleExpandUnit(unit.id)}
                                            >
                                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        {isExpanded && (
                                            <div className="bg-pm-light/20 p-2.5 space-y-2 border-t border-pm-secondary/10">
                                                {groups.length === 0 ? (
                                                    <p className="text-xs text-pm-secondary italic text-center py-2">Este tópico ainda não possui seções compatíveis com a busca.</p>
                                                ) : (
                                                    groups.map(group => {
                                                        const isGroupSelected = selectedGroups.includes(group.id);
                                                        return (
                                                            <button
                                                                key={group.id}
                                                                onClick={() => addFullTopicFromSection(unit.id)}
                                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${isGroupSelected ? 'bg-white border-pm-primary/35 shadow-sm' : 'bg-white/70 border-pm-secondary/10 hover:border-pm-primary/25'}`}
                                                            >
                                                                <span className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors shrink-0 ${isGroupSelected ? 'bg-pm-primary border-pm-primary text-white' : 'border-pm-secondary/40 bg-white'}`}>
                                                                    {isGroupSelected && <CheckSquare className="w-3 h-3" />}
                                                                </span>
                                                                <span className="min-w-0 flex-1">
                                                                    <span className="text-sm font-bold text-pm-dark block truncate">{group.title}</span>
                                                                    <span className="text-[10px] uppercase tracking-wider font-bold text-pm-secondary">
                                                                        {getTopicCategory(unit.id)} · {group.mode === 'collection' ? 'Lista' : 'Indicadores'}
                                                                    </span>
                                                                </span>
                                                            </button>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </aside>

                    <main className="flex flex-col min-h-0">
                        <div className="p-4 border-b border-pm-secondary/10 bg-[#f8f7f2]">
                            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-black text-pm-dark flex items-center gap-2">
                                        <Layers3 className="w-5 h-5 text-pm-primary" />
                                        Roteiro de impressão
                                    </h3>
                                    <p className="text-sm text-pm-secondary mt-1">
                                        Organize em blocos. O comandante receberá o PDF nessa sequência.
                                    </p>
                                </div>

                                <div className="flex gap-2 w-full xl:w-auto">
                                    <input
                                        value={newCategoryName}
                                        onChange={event => setNewCategoryName(event.target.value)}
                                        onKeyDown={event => { if (event.key === 'Enter') addCategory(); }}
                                        placeholder="Nova categoria"
                                        className="flex-1 xl:w-64 border border-pm-secondary/20 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pm-primary/25 bg-white"
                                    />
                                    <button
                                        onClick={addCategory}
                                        className="px-4 py-2 bg-pm-primary text-white rounded-lg text-xs font-black uppercase flex items-center gap-1.5 hover:bg-pm-primary/90"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Criar
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 xl:p-5">
                            {topicsByCategory.length === 0 ? (
                                <div className="h-full min-h-[360px] border border-dashed border-pm-secondary/30 rounded-2xl bg-white/80 flex items-center justify-center text-center p-8">
                                    <div>
                                        <FileText className="w-10 h-10 text-pm-secondary/45 mx-auto mb-3" />
                                        <p className="text-lg font-black text-pm-dark">Comece selecionando os tópicos</p>
                                        <p className="text-sm text-pm-secondary mt-1 max-w-md">
                                            Depois de selecionar, as categorias aparecem aqui como blocos organizáveis para impressão.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {topicsByCategory.map(({ category, topics }, categoryIndex) => {
                                        const isCategoryCollapsed = collapsedCategories.includes(category);

                                        return (
                                        <section key={category} className="border border-pm-secondary/15 rounded-2xl overflow-hidden bg-white shadow-sm">
                                            <div className="bg-[#d8cca1] border-b border-[#b8a979] px-4 py-3 flex items-center gap-3">
                                                <span className="w-8 h-8 rounded-lg bg-pm-dark text-white flex items-center justify-center text-sm font-black shrink-0">
                                                    {categoryIndex + 1}
                                                </span>
                                                <button
                                                    onClick={() => toggleCategoryCollapse(category)}
                                                    className="p-2 text-pm-dark hover:text-pm-primary rounded-lg hover:bg-white/60 transition-colors"
                                                    title={isCategoryCollapsed ? 'Expandir categoria' : 'Minimizar categoria'}
                                                    aria-label={isCategoryCollapsed ? `Expandir ${category}` : `Minimizar ${category}`}
                                                >
                                                    {isCategoryCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </button>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-base font-black text-pm-dark truncate">{category}</h4>
                                                    <p className="text-[10px] uppercase tracking-wider text-pm-secondary font-black">
                                                        {topics.length} {topics.length === 1 ? 'tópico completo' : 'tópicos completos'} neste bloco
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => moveCategory(category, 'up')}
                                                    disabled={categoryIndex === 0}
                                                    className="p-2 text-pm-dark hover:text-pm-primary disabled:opacity-20 disabled:cursor-not-allowed rounded-lg hover:bg-white/60"
                                                    title="Subir categoria"
                                                >
                                                    <ArrowUp className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => moveCategory(category, 'down')}
                                                    disabled={categoryIndex === topicsByCategory.length - 1}
                                                    className="p-2 text-pm-dark hover:text-pm-primary disabled:opacity-20 disabled:cursor-not-allowed rounded-lg hover:bg-white/60"
                                                    title="Descer categoria"
                                                >
                                                    <ArrowDown className="w-4 h-4" />
                                                </button>
                                                {topics.length === 0 && category !== 'Geral' && (
                                                    <button
                                                        onClick={() => removeEmptyCategory(category)}
                                                        className="p-2 text-pm-secondary hover:text-red-700 rounded-lg hover:bg-white/60"
                                                        title="Remover categoria vazia"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>

                                            {!isCategoryCollapsed && <div className="p-3 space-y-2">
                                                {topics.length === 0 ? (
                                                    <p className="text-xs text-pm-secondary text-center py-5 bg-pm-light/40 rounded-xl">
                                                        Categoria criada. Use o campo "Categoria" de um tópico para movê-lo para este bloco.
                                                    </p>
                                                ) : topics.map((topic, topicIndex) => {
                                                    const topicGroups = getGroupsForUnit(topic.id);
                                                    const currentCategory = getTopicCategory(topic.id);
                                                    const collectionGroups = topicGroups.filter(group => group.mode === 'collection').length;
                                                    const indicatorGroups = topicGroups.length - collectionGroups;
                                                    const highlightedGroup = topicGroups.find(group => group.id === highlightEditingGroupId && group.reportLayout !== 'text');
                                                    const highlightedGroupRules = highlightedGroup
                                                        ? tableHighlights.filter(rule => rule.groupId === highlightedGroup.id)
                                                        : [];

                                                    return (
                                                        <div key={topic.id} className="border border-pm-secondary/10 rounded-xl bg-[#fbfaf6] hover:bg-white transition-colors overflow-hidden">
                                                            <div className="grid grid-cols-[auto,minmax(220px,1fr)] xl:grid-cols-[auto,minmax(260px,1fr),minmax(190px,240px),76px] gap-3 xl:gap-4 items-center p-3.5">
                                                                <span className="w-8 h-8 rounded-lg bg-white border border-pm-secondary/15 text-pm-secondary flex items-center justify-center text-xs font-black">
                                                                    {topicIndex + 1}
                                                                </span>
                                                                <div className="min-w-0">
                                                                    <p className="text-base font-black text-pm-dark truncate">{topic.name}</p>
                                                                    <p className="text-[10px] text-pm-secondary uppercase font-black tracking-wider">
                                                                        Tópico completo · {topicGroups.length} seções · {indicatorGroups} indicadores / {collectionGroups} listas
                                                                    </p>
                                                                </div>
                                                                <select
                                                                    aria-label={`Categoria de ${topic.name}`}
                                                                    value={currentCategory}
                                                                    onChange={event => assignTopicCategory(topic.id, event.target.value)}
                                                                    className="col-start-2 xl:col-start-auto border border-pm-secondary/20 rounded-lg px-2 py-2 text-xs font-bold text-pm-dark bg-white"
                                                                >
                                                                    {[...reportCategories].sort(compareTextPtBr).map(option => (
                                                                        <option key={option} value={option}>{option}</option>
                                                                    ))}
                                                                </select>
                                                                <div className="col-start-2 xl:col-start-auto flex justify-end gap-1">
                                                                    <button
                                                                        onClick={() => moveTopic(topic.id, topics, 'up')}
                                                                        disabled={topicIndex === 0}
                                                                        className="p-1.5 text-pm-secondary hover:text-pm-primary disabled:opacity-20 disabled:cursor-not-allowed rounded-md hover:bg-pm-light"
                                                                        title="Subir tópico"
                                                                    >
                                                                        <ArrowUp className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => moveTopic(topic.id, topics, 'down')}
                                                                        disabled={topicIndex === topics.length - 1}
                                                                        className="p-1.5 text-pm-secondary hover:text-pm-primary disabled:opacity-20 disabled:cursor-not-allowed rounded-md hover:bg-pm-light"
                                                                        title="Descer tópico"
                                                                    >
                                                                        <ArrowDown className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="border-t border-pm-secondary/10 bg-white/65 px-4 py-3">
                                                                <p className="text-[10px] uppercase tracking-widest font-black text-pm-secondary mb-2">Seções incluídas neste tópico</p>
                                                                <div className="space-y-2">
                                                                    {topicGroups.map(group => {
                                                                        const orderedFields = getFieldsForGroup(group.id);
                                                                        return (
                                                                            <div key={group.id} className="overflow-hidden rounded-lg bg-pm-light border border-pm-secondary/10">
                                                                                <div className="flex items-center">
                                                                                    <span className="px-2.5 py-2 text-[11px] font-black text-pm-dark flex-1">{group.title}</span>
                                                                                    {canManageGlobalModel && group.reportLayout !== 'text' && (
                                                                                        <button
                                                                                            onClick={() => setHighlightEditingGroupId(current => current === group.id ? '' : group.id)}
                                                                                            className={`px-2.5 py-2 text-[10px] font-black uppercase border-l border-pm-secondary/10 transition-colors ${highlightEditingGroupId === group.id ? 'bg-pm-primary text-white' : 'text-pm-secondary hover:bg-white hover:text-pm-dark'}`}
                                                                                        >
                                                                                            Cor
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                                {canManageGlobalModel && orderedFields.length > 0 && (
                                                                                    <div className="border-t border-pm-secondary/10 bg-white px-2.5 py-2">
                                                                                        <p className="text-[9px] uppercase tracking-widest font-black text-pm-secondary mb-1.5">Ordem dos campos no relatório</p>
                                                                                        <div className="space-y-1">
                                                                                            {orderedFields.map((field, fieldIndex) => (
                                                                                                <div key={field.id} className="flex items-center gap-2 rounded-md border border-pm-secondary/10 bg-[#fbfaf6] px-2 py-1">
                                                                                                    <span className="w-5 text-[10px] font-black text-pm-secondary">{fieldIndex + 1}</span>
                                                                                                    <span className="text-[11px] font-bold text-pm-dark flex-1 truncate">{field.name}</span>
                                                                                                    <button
                                                                                                        onClick={() => moveField(group.id, field.id, 'up')}
                                                                                                        disabled={fieldIndex === 0}
                                                                                                        className="p-1 text-pm-secondary hover:text-pm-primary disabled:opacity-20 disabled:cursor-not-allowed rounded hover:bg-pm-light"
                                                                                                        title="Subir campo"
                                                                                                    >
                                                                                                        <ArrowUp className="w-3.5 h-3.5" />
                                                                                                    </button>
                                                                                                    <button
                                                                                                        onClick={() => moveField(group.id, field.id, 'down')}
                                                                                                        disabled={fieldIndex === orderedFields.length - 1}
                                                                                                        className="p-1 text-pm-secondary hover:text-pm-primary disabled:opacity-20 disabled:cursor-not-allowed rounded hover:bg-pm-light"
                                                                                                        title="Descer campo"
                                                                                                    >
                                                                                                        <ArrowDown className="w-3.5 h-3.5" />
                                                                                                    </button>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                                {canManageGlobalModel && highlightedGroup && (
                                                                    <div className="mt-3 rounded-xl border border-pm-secondary/15 bg-[#fbfaf6] p-3">
                                                                        <div className="flex items-start justify-between gap-3 mb-3">
                                                                            <div>
                                                                                <p className="text-[10px] uppercase tracking-widest font-black text-pm-secondary">Destaque de tabela</p>
                                                                                <p className="text-sm font-black text-pm-dark">{highlightedGroup.title}</p>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => setHighlightEditingGroupId('')}
                                                                                className="p-1.5 rounded-md text-pm-secondary hover:text-pm-dark hover:bg-white"
                                                                                aria-label="Fechar configuração de cor"
                                                                            >
                                                                                <X className="w-4 h-4" />
                                                                            </button>
                                                                        </div>
                                                                        <div className="grid grid-cols-2 xl:grid-cols-[140px,110px,110px,180px,auto] gap-2 items-end">
                                                                            <label className="text-[10px] uppercase tracking-wide font-black text-pm-secondary">
                                                                                Aplicar em
                                                                                <select
                                                                                    value={highlightTarget}
                                                                                    onChange={event => setHighlightTarget(event.target.value as ReportHighlightTarget)}
                                                                                    className="block mt-1 w-full border border-pm-secondary/20 rounded-lg px-2 py-2 text-xs font-bold text-pm-dark bg-white"
                                                                                >
                                                                                    <option value="row">Linha</option>
                                                                                    <option value="column">Coluna</option>
                                                                                    <option value="cell">Célula</option>
                                                                                </select>
                                                                            </label>
                                                                            {highlightTarget !== 'column' && (
                                                                                <label className="text-[10px] uppercase tracking-wide font-black text-pm-secondary">
                                                                                    Linha
                                                                                    <input
                                                                                        type="number"
                                                                                        min={1}
                                                                                        value={highlightRow}
                                                                                        onChange={event => setHighlightRow(Math.max(1, Number(event.target.value) || 1))}
                                                                                        className="block mt-1 w-full border border-pm-secondary/20 rounded-lg px-2 py-2 text-xs font-bold text-pm-dark bg-white"
                                                                                    />
                                                                                </label>
                                                                            )}
                                                                            {highlightTarget !== 'row' && (
                                                                                <label className="text-[10px] uppercase tracking-wide font-black text-pm-secondary">
                                                                                    Coluna
                                                                                    <input
                                                                                        type="number"
                                                                                        min={1}
                                                                                        value={highlightColumn}
                                                                                        onChange={event => setHighlightColumn(Math.max(1, Number(event.target.value) || 1))}
                                                                                        className="block mt-1 w-full border border-pm-secondary/20 rounded-lg px-2 py-2 text-xs font-bold text-pm-dark bg-white"
                                                                                    />
                                                                                </label>
                                                                            )}
                                                                            <label className="text-[10px] uppercase tracking-wide font-black text-pm-secondary">
                                                                                Cor
                                                                                <select
                                                                                    value={highlightColor}
                                                                                    onChange={event => setHighlightColor(event.target.value as ReportHighlightColor)}
                                                                                    className="block mt-1 w-full border border-pm-secondary/20 rounded-lg px-2 py-2 text-xs font-bold text-pm-dark bg-white"
                                                                                >
                                                                                    {REPORT_HIGHLIGHT_COLORS.map(color => (
                                                                                        <option key={color.value} value={color.value}>{color.label}</option>
                                                                                    ))}
                                                                                </select>
                                                                            </label>
                                                                            <button
                                                                                onClick={() => addTableHighlight(highlightedGroup.id)}
                                                                                disabled={isSavingHighlight}
                                                                                className="px-3 py-2 rounded-lg bg-pm-dark text-white text-xs font-black uppercase hover:bg-pm-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                                                            >
                                                                                {isSavingHighlight && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                                                                Aplicar
                                                                            </button>
                                                                        </div>
                                                                        <p className="mt-2 text-[11px] text-pm-secondary font-bold">
                                                                            Numere somente as linhas de dados e as colunas visíveis da tabela, começando em 1.
                                                                        </p>
                                                                        {highlightedGroupRules.length > 0 && (
                                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                                {highlightedGroupRules.map(rule => {
                                                                                    const color = REPORT_HIGHLIGHT_COLORS.find(item => item.value === rule.color);
                                                                                    const location = rule.target === 'row'
                                                                                        ? `linha ${(rule.rowIndex ?? 0) + 1}`
                                                                                        : rule.target === 'column'
                                                                                            ? `coluna ${(rule.columnIndex ?? 0) + 1}`
                                                                                            : `linha ${(rule.rowIndex ?? 0) + 1}, coluna ${(rule.columnIndex ?? 0) + 1}`;

                                                                                    return (
                                                                                        <span key={rule.id} className="inline-flex items-center gap-1.5 rounded-lg border border-pm-secondary/15 bg-white px-2 py-1 text-[11px] font-bold text-pm-dark">
                                                                                            <span className={`w-3 h-3 rounded-sm border border-pm-secondary/20 ${color?.swatch || 'bg-pm-light'}`} />
                                                                                            {REPORT_HIGHLIGHT_TARGET_LABELS[rule.target]}: {location}
                                                                                            <button
                                                                                                onClick={() => removeTableHighlight(rule.id)}
                                                                                                disabled={isSavingHighlight}
                                                                                                className="ml-1 text-pm-secondary hover:text-red-700 disabled:opacity-40"
                                                                                                aria-label="Remover destaque"
                                                                                            >
                                                                                                <X className="w-3.5 h-3.5" />
                                                                                            </button>
                                                                                        </span>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>}
                                        </section>
                                    );
                                    })}
                                </div>
                            )}
                        </div>
                    </main>
                </div>
                ) : (
                    <div className="flex-1 min-h-0 overflow-hidden bg-[#dedbd1]">
                        <div className="h-full overflow-auto custom-scrollbar p-4 md:p-6">
                            {isPrintable ? (
                                <div className="mx-auto bg-white shadow-2xl ring-1 ring-black/10 origin-top report-preview-sheet w-[210mm] min-h-[297mm]">
                                    <ReportPdfRenderer
                                        selectedUnits={selectedUnits}
                                        selectedGroups={selectedGroups}
                                        reportCategoryConfig={sharedReportConfig}
                                        reportSectionsConfig={technicalSections}
                                        fontSize={fontSize}
                                    />
                                </div>
                            ) : (
                                <div className="h-full min-h-[360px] flex items-center justify-center text-center p-8">
                                    <div className="bg-white border border-pm-secondary/15 rounded-2xl p-8 max-w-md shadow-sm">
                                        <FileText className="w-10 h-10 text-pm-secondary/45 mx-auto mb-3" />
                                        <p className="text-lg font-black text-pm-dark">Sem conteúdo para prévia</p>
                                        <p className="text-sm text-pm-secondary mt-1">
                                            Selecione ao menos um tópico e uma seção para visualizar o relatório em A4.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="bg-white px-5 py-3.5 border-t border-pm-secondary/15 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${isPrintable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            <ClipboardCheck className="w-5 h-5" />
                        </span>
                        <div>
                            <p className="text-sm font-black text-pm-dark">
                                {isPrintable ? 'Briefing geral pronto para impressão' : 'Selecione ao menos um tópico e uma seção'}
                            </p>
                            <p className="text-xs text-pm-secondary">
                                {selectedUnits.length} tópicos, {selectedGroups.length} seções e {selectedCategoryCount} categorias com conteúdo.
                            </p>
                            {modelMessage && (
                                <p className={`text-xs font-bold mt-1 ${modelMessage.type === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
                                    {modelMessage.text}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-pm-secondary hover:bg-pm-light rounded-lg transition-colors border border-transparent hover:border-pm-secondary/20">
                            Cancelar
                        </button>
                        <button
                            onClick={reloadSavedModel}
                            disabled={isSavingModel || isLoadingSavedModel || isSavingHighlight}
                            className="px-4 py-2.5 text-sm font-black bg-white text-pm-dark rounded-lg hover:bg-pm-light transition-all border border-pm-secondary/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoadingSavedModel ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                            Carregar modelo global
                        </button>
                        {canManageGlobalModel && (
                            <button
                                onClick={saveReportConfiguration}
                                disabled={isSavingModel || isLoadingSavedModel || isSavingHighlight}
                                className="px-5 py-2.5 text-sm font-black bg-white text-pm-dark rounded-lg hover:bg-pm-light transition-all border border-pm-secondary/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSavingModel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {isSavingModel ? 'Publicando...' : 'Publicar modelo global'}
                            </button>
                        )}
                        <button
                            onClick={() => setReportMode(reportMode === 'preview' ? 'builder' : 'preview')}
                            disabled={!isPrintable}
                            className="px-5 py-2.5 text-sm font-black bg-white text-pm-dark rounded-lg hover:bg-pm-light transition-all border border-pm-secondary/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {reportMode === 'preview' ? <SlidersHorizontal className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            {reportMode === 'preview' ? 'Editar montagem' : 'Ver prévia'}
                        </button>
                        <button
                            onClick={() => handlePrint()}
                            disabled={!isPrintable}
                            className="px-6 py-2.5 text-sm font-black bg-pm-primary text-pm-light rounded-lg hover:bg-pm-primary/90 transition-all shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Printer className="w-4 h-4" />
                            Imprimir PDF
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ display: 'none' }}>
                <div ref={printRef}>
                    <ReportPdfRenderer
                        selectedUnits={selectedUnits}
                        selectedGroups={selectedGroups}
                        reportCategoryConfig={sharedReportConfig}
                        reportSectionsConfig={technicalSections}
                        fontSize={fontSize}
                    />
                </div>
            </div>
        </div>
    );
}
