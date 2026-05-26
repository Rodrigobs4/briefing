import { useEffect, useMemo, useState } from 'react';
import {
    AlignLeft, ArrowLeft, CalendarDays, ChevronDown, ChevronUp,
    Copy, Database, Edit2, Hash, LayoutTemplate, Plus, Percent, Save, Search,
    Trash2, Type, X
} from 'lucide-react';
import { useAuth, RegionalBriefingField, RegionalBriefingSection } from '../../store/AuthContext';
import { supabase } from '../../lib/supabase';

type RegionalFieldType = RegionalBriefingField['fieldType'];
type RegionalSectionMode = RegionalBriefingSection['mode'];
type RegionalFrequency = RegionalBriefingSection['updateFrequency'];

const FIELD_TYPES: { type: RegionalFieldType; label: string; icon: typeof Type }[] = [
    { type: 'calculated', label: 'Calculado', icon: Database },
    { type: 'date', label: 'Data', icon: CalendarDays },
    { type: 'textarea', label: 'Descritivo', icon: AlignLeft },
    { type: 'currency', label: 'Moeda', icon: Database },
    { type: 'number', label: 'Numérico', icon: Hash },
    { type: 'percentage', label: 'Percentual', icon: Percent },
    { type: 'text', label: 'Texto', icon: Type }
];

const FREQUENCIES: RegionalFrequency[] = ['yearly', 'fixed', 'custom', 'monthly', 'weekly', 'semester'];

const getFrequencyLabel = (frequency: RegionalFrequency) => ({
    fixed: 'Fixo',
    weekly: 'Semanal',
    monthly: 'Mensal',
    semester: 'Semestral',
    yearly: 'Anual',
    custom: 'Personalizado'
}[frequency]);

const slugify = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 54) || 'regional';

const makeCode = (value: string) => `${slugify(value)}_${crypto.randomUUID().slice(0, 8)}`;

export default function RegionalAdminDynamicForms() {
    const {
        regionalBriefingSections,
        regionalBriefingTopics,
        regionalBriefingFields,
        regionalBriefingValues,
        regionalBriefingCollectionValues,
        refreshData
    } = useAuth();

    const activeSections = regionalBriefingSections
        .filter(section => section.isActive)
        .sort((a, b) => a.categoryOrder - b.categoryOrder || a.orderIndex - b.orderIndex);

    const categories = useMemo(() => regionalBriefingTopics
        .filter(topic => topic.isActive)
        .sort((a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name, 'pt-BR'))
        .map(topic => ({
            id: topic.id,
            title: topic.name,
            order: topic.orderIndex,
            count: activeSections.filter(section =>
                section.topicId === topic.id || (!section.topicId && section.categoryTitle === topic.name)
            ).length
        })), [activeSections, regionalBriefingTopics]);

    const [selectedCategory, setSelectedCategory] = useState(categories[0]?.title || '');
    const [selectedSection, setSelectedSection] = useState<string | null>(null);
    const [newCategoryTitle, setNewCategoryTitle] = useState('');
    const [newSectionTitle, setNewSectionTitle] = useState('');
    const [newSectionMode, setNewSectionMode] = useState<RegionalSectionMode>('snapshot');
    const [newSectionFrequency, setNewSectionFrequency] = useState<RegionalFrequency>('custom');
    const [sectionSearch, setSectionSearch] = useState('');
    const [editingTopic, setEditingTopic] = useState<{ id: string; title: string; order: number } | null>(null);
    const [editTopicTitle, setEditTopicTitle] = useState('');
    const [editingSection, setEditingSection] = useState<RegionalBriefingSection | null>(null);
    const [editSectionTitle, setEditSectionTitle] = useState('');
    const [editSectionTopicId, setEditSectionTopicId] = useState('');
    const [editSectionMode, setEditSectionMode] = useState<RegionalSectionMode>('snapshot');
    const [editSectionFrequency, setEditSectionFrequency] = useState<RegionalFrequency>('custom');
    const [editingField, setEditingField] = useState<RegionalBriefingField | null>(null);
    const [isCreatingField, setIsCreatingField] = useState(false);
    const [editError, setEditError] = useState('');

    useEffect(() => {
        if (!selectedCategory && categories[0]) {
            setSelectedCategory(categories[0].title);
            return;
        }
        if (selectedCategory && categories.length > 0 && !categories.some(category => category.title === selectedCategory)) {
            setSelectedCategory(categories[0].title);
            setSelectedSection(null);
        }
    }, [categories, selectedCategory]);

    const selectedTopic = categories.find(category => category.title === selectedCategory) ?? null;
    const selectedCategorySections = activeSections.filter(section =>
        section.topicId === selectedTopic?.id || (!section.topicId && section.categoryTitle === selectedCategory)
    );
    const visibleSections = selectedCategorySections.filter(section =>
        `${section.title} ${section.categoryTitle}`.toLowerCase().includes(sectionSearch.toLowerCase())
    );
    const selectedSectionData = activeSections.find(section => section.id === selectedSection) ?? visibleSections[0] ?? null;
    const selectedSectionFields = regionalBriefingFields
        .filter(field => field.sectionId === selectedSectionData?.id && field.isActive)
        .sort((a, b) => a.orderIndex - b.orderIndex);

    const sync = async () => {
        await refreshData();
    };

    const createCategory = async () => {
        if (!newCategoryTitle.trim()) return;
        const topicName = newCategoryTitle.trim();
        const { error } = await supabase.from('regional_briefing_topics').insert({
            name: topicName,
            order_index: categories.length + 1,
            is_active: true
        });
        if (error) {
            console.error('Erro ao criar tópico regional:', error);
            return;
        }
        setSelectedCategory(topicName);
        setNewCategoryTitle('');
        setSelectedSection(null);
        await sync();
    };

    const createSection = async () => {
        if (!newSectionTitle.trim() || !selectedTopic) return;
        const { data, error } = await supabase.from('regional_briefing_sections').insert({
            topic_id: selectedTopic.id,
            code: makeCode(newSectionTitle),
            title: newSectionTitle.trim(),
            category_title: selectedTopic.title,
            category_order: selectedTopic.order,
            order_index: selectedCategorySections.length + 1,
            mode: newSectionMode,
            source_strategy: 'manual',
            update_frequency: newSectionFrequency,
            is_active: true
        }).select('id').single();

        if (error) {
            console.error('Erro ao criar seção regional:', error);
            return;
        }

        setSelectedSection(data.id);
        setNewSectionTitle('');
        setNewSectionMode('snapshot');
        setNewSectionFrequency('custom');
        await sync();
    };

    const updateTopic = async () => {
        if (!editingTopic || !editTopicTitle.trim()) return;
        const topicTitle = editTopicTitle.trim();
        const { error } = await supabase.from('regional_briefing_topics').update({
            name: topicTitle
        }).eq('id', editingTopic.id);
        if (error) {
            console.error('Erro ao atualizar tópico regional:', error);
            return;
        }

        await supabase.from('regional_briefing_sections').update({
            category_title: topicTitle,
            category_order: editingTopic.order
        }).eq('topic_id', editingTopic.id);
        setSelectedCategory(topicTitle);
        setEditingTopic(null);
        await sync();
    };

    const updateSection = async () => {
        const topic = categories.find(category => category.id === editSectionTopicId);
        if (!editingSection || !editSectionTitle.trim() || !topic) return;

        const { error } = await supabase.from('regional_briefing_sections').update({
            topic_id: topic.id,
            title: editSectionTitle.trim(),
            category_title: topic.title,
            category_order: topic.order,
            mode: editSectionMode,
            update_frequency: editSectionFrequency
        }).eq('id', editingSection.id);

        if (error) {
            console.error('Erro ao atualizar seção regional:', error);
            return;
        }

        setSelectedCategory(topic.title);
        setEditingSection(null);
        await sync();
    };

    const moveCategory = async (topicId: string, direction: 'up' | 'down') => {
        const index = categories.findIndex(category => category.id === topicId);
        if (index < 0 || (direction === 'up' && index === 0) || (direction === 'down' && index === categories.length - 1)) return;
        const target = categories[direction === 'up' ? index - 1 : index + 1];
        const current = categories[index];

        await supabase.from('regional_briefing_topics').update({ order_index: target.order }).eq('id', current.id);
        await supabase.from('regional_briefing_topics').update({ order_index: current.order }).eq('id', target.id);
        await supabase.from('regional_briefing_sections').update({ category_order: target.order }).eq('topic_id', current.id);
        await supabase.from('regional_briefing_sections').update({ category_order: current.order }).eq('topic_id', target.id);
        await sync();
    };

    const moveSection = async (sectionId: string, direction: 'up' | 'down') => {
        const sorted = [...selectedCategorySections].sort((a, b) => a.orderIndex - b.orderIndex);
        const index = sorted.findIndex(section => section.id === sectionId);
        if (index < 0 || (direction === 'up' && index === 0) || (direction === 'down' && index === sorted.length - 1)) return;
        const target = sorted[direction === 'up' ? index - 1 : index + 1];
        const current = sorted[index];

        await supabase.from('regional_briefing_sections').update({ order_index: target.orderIndex }).eq('id', current.id);
        await supabase.from('regional_briefing_sections').update({ order_index: current.orderIndex }).eq('id', target.id);
        await sync();
    };

    const duplicateSection = async (section: RegionalBriefingSection) => {
        const { data, error } = await supabase.from('regional_briefing_sections').insert({
            topic_id: section.topicId ?? selectedTopic?.id ?? null,
            code: makeCode(`${section.title}_copia`),
            title: `${section.title} (Cópia)`,
            category_title: section.categoryTitle,
            category_order: section.categoryOrder,
            order_index: selectedCategorySections.length + 1,
            mode: section.mode,
            source_strategy: section.sourceStrategy || 'manual',
            update_frequency: section.updateFrequency,
            is_active: true
        }).select('id').single();

        if (error || !data) {
            console.error('Erro ao duplicar seção regional:', error);
            return;
        }

        const fieldsToCopy = regionalBriefingFields.filter(field => field.sectionId === section.id && field.isActive);
        if (fieldsToCopy.length > 0) {
            await supabase.from('regional_briefing_fields').insert(fieldsToCopy.map(field => ({
                section_id: data.id,
                code: makeCode(field.code || field.label),
                label: field.label,
                field_type: field.fieldType,
                order_index: field.orderIndex,
                is_required: field.isRequired,
                supports_comparison: field.supportsComparison,
                aggregation_method: field.aggregationMethod || 'none',
                calculation_config: field.calculationConfig ?? null,
                is_active: true
            })));
        }

        setSelectedSection(data.id);
        await sync();
    };

    const deleteSection = async (section: RegionalBriefingSection) => {
        await supabase.from('regional_briefing_sections').update({ is_active: false }).eq('id', section.id);
        if (selectedSection === section.id) setSelectedSection(null);
        await sync();
    };

    const openFieldEditor = (type: RegionalFieldType) => {
        if (!selectedSectionData) return;
        setEditingField({
            id: crypto.randomUUID(),
            sectionId: selectedSectionData.id,
            code: makeCode(type),
            label: '',
            fieldType: type,
            orderIndex: selectedSectionFields.length + 1,
            isRequired: false,
            supportsComparison: false,
            aggregationMethod: ['number', 'percentage', 'currency'].includes(type) ? 'sum' : 'none',
            calculationConfig: null,
            isActive: true
        });
        setIsCreatingField(true);
        setEditError('');
    };

    const saveField = async () => {
        if (!editingField) return;
        if (!editingField.label.trim()) {
            setEditError('Informe o nome de exibição do campo.');
            return;
        }

        if (isCreatingField) {
            const { error } = await supabase.from('regional_briefing_fields').insert({
                section_id: editingField.sectionId,
                code: makeCode(editingField.label),
                label: editingField.label.trim(),
                field_type: editingField.fieldType,
                order_index: editingField.orderIndex,
                is_required: editingField.isRequired,
                supports_comparison: editingField.supportsComparison,
                aggregation_method: editingField.aggregationMethod || 'none',
                calculation_config: editingField.calculationConfig ?? null,
                is_active: true
            });
            if (error) {
                console.error('Erro ao criar campo regional:', error);
                return;
            }
        } else {
            const hasValues = regionalBriefingValues.some(value => value.fieldId === editingField.id)
                || regionalBriefingCollectionValues.some(value => value.fieldId === editingField.id);
            const originalField = regionalBriefingFields.find(field => field.id === editingField.id);
            if (hasValues && originalField && originalField.fieldType !== editingField.fieldType) {
                setEditError('Este campo já possui dados. Para mudar o tipo, arquive o campo e crie um novo.');
                return;
            }

            const { error } = await supabase.from('regional_briefing_fields').update({
                label: editingField.label.trim(),
                field_type: editingField.fieldType,
                is_required: editingField.isRequired,
                supports_comparison: editingField.supportsComparison,
                aggregation_method: editingField.aggregationMethod || 'none',
                calculation_config: editingField.calculationConfig ?? null
            }).eq('id', editingField.id);
            if (error) {
                console.error('Erro ao atualizar campo regional:', error);
                return;
            }
        }

        setEditingField(null);
        setIsCreatingField(false);
        await sync();
    };

    const duplicateField = async (field: RegionalBriefingField) => {
        await supabase.from('regional_briefing_fields').insert({
            section_id: field.sectionId,
            code: makeCode(`${field.code}_copia`),
            label: `${field.label} (cópia)`,
            field_type: field.fieldType,
            order_index: selectedSectionFields.length + 1,
            is_required: field.isRequired,
            supports_comparison: field.supportsComparison,
            aggregation_method: field.aggregationMethod || 'none',
            calculation_config: field.calculationConfig ?? null,
            is_active: true
        });
        await sync();
    };

    const moveField = async (fieldId: string, direction: 'up' | 'down') => {
        const index = selectedSectionFields.findIndex(field => field.id === fieldId);
        if (index < 0 || (direction === 'up' && index === 0) || (direction === 'down' && index === selectedSectionFields.length - 1)) return;
        const target = selectedSectionFields[direction === 'up' ? index - 1 : index + 1];
        const current = selectedSectionFields[index];

        await supabase.from('regional_briefing_fields').update({ order_index: target.orderIndex }).eq('id', current.id);
        await supabase.from('regional_briefing_fields').update({ order_index: current.orderIndex }).eq('id', target.id);
        await sync();
    };

    const deleteField = async (field: RegionalBriefingField) => {
        const hasValues = regionalBriefingValues.some(value => value.fieldId === field.id)
            || regionalBriefingCollectionValues.some(value => value.fieldId === field.id);

        if (hasValues) {
            await supabase.from('regional_briefing_fields').update({ is_active: false }).eq('id', field.id);
        } else {
            await supabase.from('regional_briefing_fields').delete().eq('id', field.id);
        }
        await sync();
    };

    return (
        <div className="flex flex-col gap-10 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white p-6 rounded-3xl shadow-premium border border-pm-secondary/10">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-pm-primary text-white flex items-center justify-center shadow-lg shadow-pm-primary/20 ring-4 ring-pm-primary/10">
                        <LayoutTemplate className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-pm-dark tracking-tight">Arquitetura Regional</h1>
                        <p className="text-xs font-bold text-pm-secondary/60 uppercase tracking-widest mt-0.5">
                            Gerenciamento dos tópicos, seções e campos do briefing regional
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-4 flex flex-col gap-8">
                    <div className="card p-0 overflow-hidden flex flex-col">
                        <div className="px-6 py-5 border-b border-pm-secondary/10 bg-pm-light/30">
                            <h3 className="section-title mb-0">1. Nome do Tópico</h3>
                            <p className="text-[10px] font-bold text-pm-secondary/50 mt-1 uppercase tracking-tighter">Tópicos do briefing regional</p>
                        </div>

                        <div className="p-6 bg-pm-light/20 border-b border-pm-secondary/10">
                            <div className="space-y-4">
                                <div>
                                    <label className="input-label">NOVO TÓPICO</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Efetivo, Produtividade..."
                                        value={newCategoryTitle}
                                        onChange={event => setNewCategoryTitle(event.target.value)}
                                        className="input-field"
                                    />
                                </div>
                                <button
                                    onClick={createCategory}
                                    disabled={!newCategoryTitle.trim()}
                                    className="btn btn-primary w-full h-12 mt-2"
                                >
                                    <Plus className="w-4 h-4" /> Adicionar Tópico
                                </button>
                            </div>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                            {categories.map((category, index) => (
                                <div key={category.title} className="group relative">
                                    <button
                                        onClick={() => {
                                            setSelectedCategory(category.title);
                                            setSelectedSection(null);
                                        }}
                                        className={`w-full flex items-center gap-4 pl-12 pr-14 py-5 rounded-3xl transition-all border-2 text-left ${selectedCategory === category.title
                                            ? 'bg-white border-pm-primary/40 shadow-premium-lg translate-x-1'
                                            : 'bg-transparent border-transparent hover:bg-pm-light/50 hover:border-pm-secondary/10'
                                            }`}
                                    >
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={event => { event.stopPropagation(); moveCategory(category.id, 'up'); }} disabled={index === 0} className="p-1 text-pm-secondary hover:text-pm-primary transition-all disabled:opacity-10">
                                                <ChevronUp className="w-4 h-4" />
                                            </button>
                                            <button onClick={event => { event.stopPropagation(); moveCategory(category.id, 'down'); }} disabled={index === categories.length - 1} className="p-1 text-pm-secondary hover:text-pm-primary transition-all disabled:opacity-10">
                                                <ChevronDown className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${selectedCategory === category.title
                                            ? 'bg-pm-primary text-white shadow-xl shadow-pm-primary/20'
                                            : 'bg-pm-light text-pm-secondary/40 group-hover:bg-pm-primary/10 group-hover:text-pm-primary'
                                            }`}>
                                            <Database className="w-7 h-7" />
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <p className={`text-md font-black uppercase tracking-tighter truncate ${selectedCategory === category.title ? 'text-pm-dark' : 'text-pm-secondary/70 group-hover:text-pm-dark'}`}>
                                                {category.title}
                                            </p>
                                            <span className={`text-[10px] font-bold uppercase tracking-widest ${selectedCategory === category.title ? 'text-pm-primary' : 'text-pm-secondary/40'}`}>
                                                {category.count} seção(ões)
                                            </span>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingTopic(category);
                                            setEditTopicTitle(category.title);
                                        }}
                                        className="absolute right-4 bottom-5 p-2 bg-white text-pm-secondary hover:bg-pm-primary hover:text-white rounded-xl transition-all shadow-sm border border-pm-secondary/10 opacity-0 group-hover:opacity-100"
                                        title="Editar tópico"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {categories.length === 0 && (
                                <p className="text-sm text-pm-secondary italic text-center py-4">Nenhum tópico regional cadastrado.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-8">
                    <div className="card p-0 overflow-hidden flex flex-col min-h-[700px]">
                        <div className="px-8 py-6 border-b border-pm-secondary/10 bg-pm-light/30">
                            <h3 className="section-title mb-0">2. Seções</h3>
                            <p className="text-[10px] font-black text-pm-secondary/50 mt-1 uppercase tracking-widest leading-none">Conjuntos de Informação</p>
                        </div>

                        <div className="p-8 bg-pm-light/20 border-b border-pm-secondary/10">
                            {!selectedCategory ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-pm-primary/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <ArrowLeft className="w-8 h-8 text-pm-primary/30" />
                                    </div>
                                    <p className="text-[10px] font-black text-pm-secondary/40 uppercase tracking-[0.2em]">Selecione um tópico para prosseguir</p>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    <div>
                                        <label className="input-label">NOME DA SEÇÃO</label>
                                        <input
                                            type="text"
                                            placeholder="Ex: Efetivo Regional..."
                                            value={newSectionTitle}
                                            onChange={event => setNewSectionTitle(event.target.value)}
                                            className="input-field"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="input-label">MODO OPERACIONAL</label>
                                            <select value={newSectionMode} onChange={event => setNewSectionMode(event.target.value as RegionalSectionMode)} className="input-field">
                                                <option value="collection">Coleção</option>
                                                <option value="snapshot">Snapshot</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="input-label">PERIODICIDADE</label>
                                            <select value={newSectionFrequency} onChange={event => setNewSectionFrequency(event.target.value as RegionalFrequency)} className="input-field">
                                                {FREQUENCIES.map(frequency => (
                                                    <option key={frequency} value={frequency}>{getFrequencyLabel(frequency)}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <button onClick={createSection} disabled={!newSectionTitle.trim()} className="btn btn-primary w-full h-14">
                                        <Plus className="w-5 h-5" /> Adicionar Seção
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-b border-pm-secondary/10">
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-pm-secondary/50" />
                                <input
                                    value={sectionSearch}
                                    onChange={event => setSectionSearch(event.target.value)}
                                    placeholder="Buscar seção regional..."
                                    className="input-field pl-11"
                                />
                            </div>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                            {visibleSections.map((section, index) => (
                                <div key={section.id} className="group/dg relative">
                                    <button
                                        onClick={() => setSelectedSection(section.id)}
                                        className={`w-full flex items-center justify-between gap-4 pl-12 pr-6 py-5 rounded-3xl transition-all border-2 text-left ${selectedSectionData?.id === section.id
                                            ? 'bg-pm-secondary border-pm-secondary text-white shadow-premium-lg translate-x-1'
                                            : 'bg-white border-pm-secondary/10 hover:border-pm-secondary/30 hover:bg-pm-light/30 shadow-sm'
                                            }`}
                                    >
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col opacity-0 group-hover/dg:opacity-60 hover:!opacity-100 transition-all">
                                            <button onClick={event => { event.stopPropagation(); moveSection(section.id, 'up'); }} disabled={index === 0} className={`p-1 transition-all disabled:opacity-10 ${selectedSectionData?.id === section.id ? 'text-white' : 'text-pm-secondary hover:text-pm-primary'}`}>
                                                <ChevronUp className="w-4 h-4" />
                                            </button>
                                            <button onClick={event => { event.stopPropagation(); moveSection(section.id, 'down'); }} disabled={index === visibleSections.length - 1} className={`p-1 transition-all disabled:opacity-10 ${selectedSectionData?.id === section.id ? 'text-white' : 'text-pm-secondary hover:text-pm-primary'}`}>
                                                <ChevronDown className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <p className={`text-sm font-black uppercase tracking-tight truncate ${selectedSectionData?.id === section.id ? 'text-white' : 'text-pm-dark'}`}>{section.title}</p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${selectedSectionData?.id === section.id ? 'bg-white/20 border-white/30 text-white' : 'bg-pm-light border-pm-secondary/10 text-pm-secondary/60'}`}>
                                                    {section.mode === 'snapshot' ? 'Valores' : 'Itens'}
                                                </span>
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${selectedSectionData?.id === section.id ? 'bg-white/20 border-white/30 text-white' : 'bg-pm-light border-pm-secondary/10 text-pm-secondary/60'}`}>
                                                    {getFrequencyLabel(section.updateFrequency)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={`flex gap-1.5 transition-opacity ${selectedSectionData?.id === section.id ? 'opacity-100' : 'opacity-0 group-hover/dg:opacity-100'}`}>
                                            <button onClick={event => { event.stopPropagation(); duplicateSection(section); }} className={`p-2 rounded-xl transition-all ${selectedSectionData?.id === section.id ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white text-pm-secondary hover:text-pm-primary shadow-premium border border-pm-secondary/10'}`}>
                                                <Copy className="w-4 h-4" />
                                            </button>
                                            <button onClick={event => {
                                                event.stopPropagation();
                                                setEditingSection(section);
                                                setEditSectionTitle(section.title);
                                                setEditSectionTopicId(section.topicId ?? selectedTopic?.id ?? '');
                                                setEditSectionMode(section.mode);
                                                setEditSectionFrequency(section.updateFrequency);
                                            }} className={`p-2 rounded-xl transition-all ${selectedSectionData?.id === section.id ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white text-pm-secondary hover:text-pm-primary shadow-premium border border-pm-secondary/10'}`}>
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={event => { event.stopPropagation(); deleteSection(section); }} className={`p-2 rounded-xl transition-all ${selectedSectionData?.id === section.id ? 'bg-red-400/20 text-white hover:bg-red-500' : 'bg-red-50 text-red-500 hover:bg-red-100 shadow-premium border border-red-100'}`}>
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </button>
                                </div>
                            ))}
                            {visibleSections.length === 0 && (
                                <p className="text-sm text-pm-secondary italic text-center py-4">Nenhuma seção regional encontrada.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-8">
                    <div className="card p-0 overflow-hidden flex flex-col min-h-[700px]">
                        <div className="px-8 py-6 border-b border-pm-secondary/10 bg-pm-light/30">
                            <h3 className="section-title mb-0">3. Campos</h3>
                            <p className="text-[10px] font-black text-pm-secondary/50 mt-1 uppercase tracking-widest leading-none">Atributos de Pesquisa</p>
                        </div>

                        {!selectedSectionData ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                                <div className="w-20 h-20 bg-pm-primary/5 rounded-3xl flex items-center justify-center mb-6">
                                    <Database className="w-10 h-10 text-pm-primary/20" />
                                </div>
                                <p className="text-xs font-black text-pm-secondary/40 uppercase tracking-widest max-w-[240px] leading-relaxed">
                                    Selecione uma seção regional para configurar os campos
                                </p>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col">
                                <div className="p-8 bg-pm-light/20 border-b border-pm-secondary/10">
                                    <p className="text-[10px] font-black text-pm-secondary/60 uppercase tracking-widest mb-4">Adicionar Novo Atributo</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {FIELD_TYPES.map(item => {
                                            const Icon = item.icon;
                                            return (
                                                <button key={item.type} onClick={() => openFieldEditor(item.type)} className="flex items-center gap-3 px-4 py-3 bg-white border border-pm-secondary/10 rounded-2xl text-[10px] font-black text-pm-dark uppercase tracking-tighter hover:border-pm-primary/40 hover:shadow-premium-lg transition-all">
                                                    <Icon className="w-4 h-4 text-pm-primary" /> {item.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="p-6 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                                    {selectedSectionFields.map((field, index) => (
                                        <div key={field.id} className="group/field relative bg-white border border-pm-secondary/10 p-5 rounded-3xl shadow-sm hover:border-pm-primary/30 hover:shadow-premium-lg transition-all">
                                            <div className="flex items-center gap-5">
                                                <div className="flex flex-col opacity-0 group-hover/field:opacity-100 transition-all scale-90 -translate-x-2 group-hover:translate-x-0">
                                                    <button onClick={() => moveField(field.id, 'up')} disabled={index === 0} className="p-1 text-pm-secondary hover:text-pm-primary transition-all disabled:opacity-10"><ChevronUp className="w-4 h-4" /></button>
                                                    <button onClick={() => moveField(field.id, 'down')} disabled={index === selectedSectionFields.length - 1} className="p-1 text-pm-secondary hover:text-pm-primary transition-all disabled:opacity-10"><ChevronDown className="w-4 h-4" /></button>
                                                </div>
                                                <div className="flex-1 overflow-hidden">
                                                    <div className="flex items-center gap-3">
                                                        <h4 className="text-sm font-black text-pm-dark uppercase tracking-tight truncate">{field.label}</h4>
                                                        {field.isRequired && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50" title="Obrigatório" />}
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-1.5">
                                                        <span className="text-[9px] font-black uppercase tracking-[0.1em] text-pm-primary bg-pm-primary/5 px-2 py-0.5 rounded-md border border-pm-primary/10">
                                                            {field.fieldType}
                                                        </span>
                                                        {field.supportsComparison && <span className="text-[8px] font-bold text-pm-secondary uppercase tracking-widest">Comparável</span>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 opacity-0 group-hover/field:opacity-100 transition-all">
                                                    <button onClick={() => { setEditingField({ ...field }); setIsCreatingField(false); setEditError(''); }} className="p-2 bg-pm-light text-pm-secondary hover:bg-pm-primary hover:text-white rounded-xl transition-all shadow-sm" title="Editar atributo"><Edit2 className="w-4 h-4" /></button>
                                                    <button onClick={() => duplicateField(field)} className="p-2 bg-pm-light text-pm-secondary hover:bg-pm-primary hover:text-white rounded-xl transition-all shadow-sm" title="Duplicar atributo"><Copy className="w-4 h-4" /></button>
                                                    <button onClick={() => deleteField(field)} className="p-2 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all shadow-sm" title="Remover atributo"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {selectedSectionFields.length === 0 && (
                                        <div className="py-12 text-center">
                                            <p className="text-[10px] font-black text-pm-secondary/30 uppercase tracking-[0.2em]">Configuração vazia</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {editingTopic && (
                <div className="fixed inset-0 bg-pm-dark/60 backdrop-blur-md z-[55] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-premium-2xl w-full max-w-md p-8 border border-pm-secondary/10 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xl font-black text-pm-dark uppercase tracking-tight">Editar Tópico</h3>
                                <p className="text-[10px] font-bold text-pm-secondary/50 uppercase tracking-widest mt-1">Arquitetura Regional</p>
                            </div>
                            <button onClick={() => setEditingTopic(null)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-pm-light text-pm-secondary transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div>
                            <label className="input-label">NOME DO TÓPICO</label>
                            <input value={editTopicTitle} onChange={event => setEditTopicTitle(event.target.value)} className="input-field h-14" />
                        </div>
                        <button onClick={updateTopic} disabled={!editTopicTitle.trim()} className="btn btn-primary w-full h-14 text-sm mt-8">
                            <Save className="w-5 h-5" /> Salvar Tópico
                        </button>
                    </div>
                </div>
            )}

            {editingSection && (
                <div className="fixed inset-0 bg-pm-dark/60 backdrop-blur-md z-[55] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-premium-2xl w-full max-w-md p-8 border border-pm-secondary/10 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xl font-black text-pm-dark uppercase tracking-tight">Editar Seção</h3>
                                <p className="text-[10px] font-bold text-pm-secondary/50 uppercase tracking-widest mt-1">Configurações Regionais</p>
                            </div>
                            <button onClick={() => setEditingSection(null)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-pm-light text-pm-secondary transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <label className="input-label">NOME DA SEÇÃO</label>
                                <input value={editSectionTitle} onChange={event => setEditSectionTitle(event.target.value)} className="input-field h-14" />
                            </div>
                            <div>
                                <label className="input-label">TÓPICO</label>
                                <select value={editSectionTopicId} onChange={event => setEditSectionTopicId(event.target.value)} className="input-field h-14">
                                    {categories.map(topic => (
                                        <option key={topic.id} value={topic.id}>{topic.title}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="input-label">MODO</label>
                                    <select value={editSectionMode} onChange={event => setEditSectionMode(event.target.value as RegionalSectionMode)} className="input-field h-14">
                                        <option value="collection">Coleção</option>
                                        <option value="snapshot">Snapshot</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="input-label">PERIODICIDADE</label>
                                    <select value={editSectionFrequency} onChange={event => setEditSectionFrequency(event.target.value as RegionalFrequency)} className="input-field h-14">
                                        {FREQUENCIES.map(frequency => (
                                            <option key={frequency} value={frequency}>{getFrequencyLabel(frequency)}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <button onClick={updateSection} disabled={!editSectionTitle.trim() || !editSectionTopicId} className="btn btn-primary w-full h-14 text-sm mt-8">
                            <Save className="w-5 h-5" /> Salvar Alterações
                        </button>
                    </div>
                </div>
            )}

            {editingField && (
                <div className="fixed inset-0 bg-pm-dark/60 backdrop-blur-md z-[55] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-premium-2xl w-full max-w-md p-8 border border-pm-secondary/10 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xl font-black text-pm-dark uppercase tracking-tight">{isCreatingField ? 'Novo Atributo' : 'Configurar Atributo'}</h3>
                                <p className="text-[10px] font-bold text-pm-secondary/50 uppercase tracking-widest mt-1">Definição de Campo Regional</p>
                            </div>
                            <button onClick={() => { setEditingField(null); setIsCreatingField(false); }} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-pm-light text-pm-secondary transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {editError && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs mb-6 border border-red-100 font-semibold">
                                {editError}
                            </div>
                        )}

                        <div className="space-y-6">
                            <div>
                                <label className="input-label">LABEL (NOME DE EXIBIÇÃO)</label>
                                <input
                                    type="text"
                                    value={editingField.label}
                                    onChange={event => setEditingField({ ...editingField, label: event.target.value })}
                                    className="input-field h-14"
                                    placeholder="Ex: Efetivo total"
                                />
                            </div>
                            <div>
                                <label className="input-label">TIPO DE ENTRADA</label>
                                <select
                                    value={editingField.fieldType}
                                    onChange={event => setEditingField({ ...editingField, fieldType: event.target.value as RegionalFieldType })}
                                    className="input-field h-14"
                                >
                                    {FIELD_TYPES.map(item => (
                                        <option key={item.type} value={item.type}>{item.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="input-label">AGREGAÇÃO</label>
                                <select
                                    value={editingField.aggregationMethod || 'none'}
                                    onChange={event => setEditingField({ ...editingField, aggregationMethod: event.target.value })}
                                    className="input-field h-14"
                                >
                                    <option value="calculated">Calculado</option>
                                    <option value="list">Lista</option>
                                    <option value="avg">Média</option>
                                    <option value="none">Nenhuma</option>
                                    <option value="sum">Soma</option>
                                    <option value="latest">Último valor</option>
                                </select>
                            </div>
                            <label className="flex items-center gap-4 p-5 bg-pm-light/30 border-2 border-transparent hover:border-pm-primary/10 rounded-[1.5rem] cursor-pointer transition-all group">
                                <input
                                    type="checkbox"
                                    checked={editingField.isRequired}
                                    onChange={event => setEditingField({ ...editingField, isRequired: event.target.checked })}
                                    className="w-5 h-5 rounded-md border-pm-secondary/20 text-pm-primary focus:ring-pm-primary"
                                />
                                <div>
                                    <span className="block text-xs font-black text-pm-dark uppercase tracking-tight">Atributo obrigatório</span>
                                    <span className="block text-[10px] text-pm-secondary/60">Impede lançamento vazio quando aplicável</span>
                                </div>
                            </label>
                            <label className="flex items-center gap-4 p-5 bg-pm-light/30 border-2 border-transparent hover:border-pm-primary/10 rounded-[1.5rem] cursor-pointer transition-all group">
                                <input
                                    type="checkbox"
                                    checked={editingField.supportsComparison}
                                    onChange={event => setEditingField({ ...editingField, supportsComparison: event.target.checked })}
                                    className="w-5 h-5 rounded-md border-pm-secondary/20 text-pm-primary focus:ring-pm-primary"
                                />
                                <div>
                                    <span className="block text-xs font-black text-pm-dark uppercase tracking-tight">Suporta comparação</span>
                                    <span className="block text-[10px] text-pm-secondary/60">Permite comparar períodos no relatório regional</span>
                                </div>
                            </label>
                        </div>

                        <div className="mt-10 flex flex-col gap-3">
                            <button onClick={saveField} className="btn btn-primary h-14 w-full">
                                <Save className="w-5 h-5" /> {isCreatingField ? 'Confirmar Criação' : 'Atualizar Estrutura'}
                            </button>
                            <button onClick={() => { setEditingField(null); setIsCreatingField(false); }} className="w-full h-12 font-black text-[10px] text-pm-secondary uppercase tracking-widest hover:bg-pm-light transition-all rounded-2xl">
                                Descartar Alterações
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
