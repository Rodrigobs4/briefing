import { useRef, useState } from 'react';
import { useAuth } from '../../../store/AuthContext';
import {
    ArrowDown,
    ArrowUp,
    Building2,
    CheckSquare,
    ChevronDown,
    ChevronRight,
    ClipboardCheck,
    FileText,
    Filter,
    Layers3,
    ListChecks,
    Plus,
    Printer,
    Search,
    Square,
    X
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import ReportPdfRenderer from './ReportPdfRenderer';

export default function ReportBuilderModal({ onClose }: { onClose: () => void }) {
    const { units: allUnits, dataGroups, user } = useAuth();
    const units = user?.role === 'editor' && user.unitId ? allUnits.filter(u => u.id === user.unitId) : allUnits;
    const visibleUnitIds = units.map(unit => unit.id);
    const visibleDataGroups = dataGroups.filter(group => visibleUnitIds.includes(group.unitId));

    const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [expandedUnits, setExpandedUnits] = useState<string[]>([]);
    const [customCategories, setCustomCategories] = useState<string[]>([]);
    const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
    const [unitOrder, setUnitOrder] = useState<string[]>([]);
    const [groupOrder, setGroupOrder] = useState<string[]>([]);
    const [groupAssignments, setGroupAssignments] = useState<Record<string, string>>({});
    const [newCategoryName, setNewCategoryName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Relatório Executivo PMBA - ${new Date().toISOString().split('T')[0]}`
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

    const getGroupCategory = (group: { id: string; categoryTitle?: string | null }) => (
        groupAssignments[group.id] || group.categoryTitle?.trim() || 'Geral'
    );

    const getGroupOrderIndex = (groupId: string) => {
        const index = groupOrder.indexOf(groupId);
        return index >= 0 ? index : 9999;
    };

    const selectedGroupObjects = visibleDataGroups
        .filter(group => selectedGroups.includes(group.id))
        .sort((a, b) => getGroupOrderIndex(a.id) - getGroupOrderIndex(b.id) || (a.categoryOrder ?? 999) - (b.categoryOrder ?? 999) || a.order - b.order);

    const getUnitOrderIndex = (unitId: string) => {
        const index = unitOrder.indexOf(unitId);
        return index >= 0 ? index : 9999;
    };

    const getGroupsForUnit = (unitId: string) => selectedGroupObjects
        .filter(group => group.unitId === unitId)
        .sort((a, b) => getGroupOrderIndex(a.id) - getGroupOrderIndex(b.id) || a.order - b.order);

    const selectedUnitObjects = units
        .filter(unit => selectedUnits.includes(unit.id) && getGroupsForUnit(unit.id).length > 0)
        .sort((a, b) => getUnitOrderIndex(a.id) - getUnitOrderIndex(b.id) || (a.order_index ?? 999) - (b.order_index ?? 999));

    const getTopicCategory = (unitId: string) => {
        const unitGroups = getGroupsForUnit(unitId);
        const categories = Array.from(new Set(unitGroups.map(getGroupCategory)));
        return categories[0] || 'Geral';
    };

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
                const haystack = `${unit.name} ${unit.full_name || ''} ${group.title} ${group.categoryTitle || ''}`.toLowerCase();
                return haystack.includes(normalizedSearch);
            })
        }))
        .filter(item => !normalizedSearch || item.groups.length > 0 || item.unit.name.toLowerCase().includes(normalizedSearch));

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
        const unitGroupIds = getGroupsForUnit(unitId).map(group => group.id);
        setGroupAssignments(prev => ({
            ...prev,
            ...Object.fromEntries(unitGroupIds.map(groupId => [groupId, category]))
        }));
        setCategoryOrder(prev => prev.includes(category) ? prev : [...prev, category]);
    };

    const selectedCategoryCount = topicsByCategory.filter(item => item.topics.length > 0).length;
    const collectionCount = selectedGroupObjects.filter(group => group.mode === 'collection').length;
    const snapshotCount = selectedGroupObjects.length - collectionCount;
    const isPrintable = selectedUnits.length > 0 && selectedGroups.length > 0;

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
                                Gerenciador de Relatório
                            </h2>
                            <p className="text-sm text-pm-secondary mt-1">
                                Monte a estrutura final do PDF por categorias, ordem de leitura e seções selecionadas.
                            </p>
                        </div>
                        <button onClick={onClose} className="text-pm-secondary hover:text-pm-dark p-2 hover:bg-pm-light rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-4">
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
                </div>

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
                                                                        {group.categoryTitle?.trim() || 'Geral'} · {group.mode === 'collection' ? 'Lista' : 'Indicadores'}
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
                                    {topicsByCategory.map(({ category, topics }, categoryIndex) => (
                                        <section key={category} className="border border-pm-secondary/15 rounded-2xl overflow-hidden bg-white shadow-sm">
                                            <div className="bg-[#d8cca1] border-b border-[#b8a979] px-4 py-3 flex items-center gap-3">
                                                <span className="w-8 h-8 rounded-lg bg-pm-dark text-white flex items-center justify-center text-sm font-black shrink-0">
                                                    {categoryIndex + 1}
                                                </span>
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

                                            <div className="p-3 space-y-2">
                                                {topics.length === 0 ? (
                                                    <p className="text-xs text-pm-secondary text-center py-5 bg-pm-light/40 rounded-xl">
                                                        Categoria criada. Use o campo "Categoria" de um tópico para movê-lo para este bloco.
                                                    </p>
                                                ) : topics.map((topic, topicIndex) => {
                                                    const topicGroups = getGroupsForUnit(topic.id);
                                                    const currentCategory = getTopicCategory(topic.id);
                                                    const collectionGroups = topicGroups.filter(group => group.mode === 'collection').length;
                                                    const indicatorGroups = topicGroups.length - collectionGroups;

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
                                                                    {reportCategories.map(option => (
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
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {topicGroups.map(group => (
                                                                        <span key={group.id} className="px-2 py-1 rounded-md bg-pm-light text-[11px] font-bold text-pm-dark border border-pm-secondary/10">
                                                                            {group.title}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    ))}
                                </div>
                            )}
                        </div>
                    </main>
                </div>

                <div className="bg-white px-5 py-3.5 border-t border-pm-secondary/15 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${isPrintable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            <ClipboardCheck className="w-5 h-5" />
                        </span>
                        <div>
                            <p className="text-sm font-black text-pm-dark">
                                {isPrintable ? 'Relatório pronto para impressão' : 'Selecione ao menos um tópico e uma seção'}
                            </p>
                            <p className="text-xs text-pm-secondary">
                                {selectedUnits.length} tópicos, {selectedGroups.length} seções e {selectedCategoryCount} categorias com conteúdo.
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-pm-secondary hover:bg-pm-light rounded-lg transition-colors border border-transparent hover:border-pm-secondary/20">
                            Cancelar
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
                        reportCategoryConfig={{
                            groupAssignments,
                            categoryOrder: reportCategories,
                            groupOrder
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
