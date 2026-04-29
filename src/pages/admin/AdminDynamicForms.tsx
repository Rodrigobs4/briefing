import { useState } from 'react';
import { useAuth, FieldType, Field, CalculationOperation } from '../../store/AuthContext';
import {
    Plus, Trash2, LayoutTemplate, Type, Hash, Image as ImageIcon, Percent, Edit2, AlertTriangle,
    Save, Copy, ChevronUp, ChevronDown, Search, X, Check, Smile, Calculator,
    Database, Shield, ShieldCheck, ShieldAlert, Camera, Video, FileSearch, FileText,
    ClipboardList, FileCheck, AlertCircle, BadgeAlert, Plane, Helicopter, Users, UserRound,
    HeartPulse, Stethoscope, Award, BadgeCheck, School, Building2, BookOpen, HeartHandshake,
    Brain, MessagesSquare, CarFront, Truck, Siren, Radio, Map, MapPinned, Target, Crosshair,
    Briefcase, CalendarCheck, NotebookPen, Bell, ClipboardPlus, Package, AlignLeft, Archive, ArrowLeft
} from 'lucide-react';

const TOPIC_ICONS = [
    { name: 'database', label: 'database', icon: Database },
    { name: 'shield', label: 'shield', icon: Shield },
    { name: 'shield-check', label: 'shield-check', icon: ShieldCheck },
    { name: 'shield-alert', label: 'shield-alert', icon: ShieldAlert },
    { name: 'camera', label: 'camera', icon: Camera },
    { name: 'video', label: 'video', icon: Video },
    { name: 'file-search', label: 'file-search', icon: FileSearch },
    { name: 'file-text', label: 'file-text', icon: FileText },
    { name: 'clipboard-list', label: 'clipboard-list', icon: ClipboardList },
    { name: 'file-check', label: 'file-check', icon: FileCheck },
    { name: 'alert-circle', label: 'alert-circle', icon: AlertCircle },
    { name: 'badge-alert', label: 'badge-alert', icon: BadgeAlert },
    { name: 'plane', label: 'plane', icon: Plane },
    { name: 'helicopter', label: 'helicopter', icon: Helicopter },
    { name: 'users', label: 'users', icon: Users },
    { name: 'user-round', label: 'user-round', icon: UserRound },
    { name: 'heart-pulse', label: 'heart-pulse', icon: HeartPulse },
    { name: 'stethoscope', label: 'stethoscope', icon: Stethoscope },
    { name: 'award', label: 'award', icon: Award },
    { name: 'badge-check', label: 'badge-check', icon: BadgeCheck },
    { name: 'school', label: 'school', icon: School },
    { name: 'building-2', label: 'building-2', icon: Building2 },
    { name: 'book-open', label: 'book-open', icon: BookOpen },
    { name: 'heart-handshake', label: 'heart-handshake', icon: HeartHandshake },
    { name: 'brain', label: 'brain', icon: Brain },
    { name: 'messages-square', label: 'messages-square', icon: MessagesSquare },
    { name: 'car-front', label: 'car-front', icon: CarFront },
    { name: 'truck', label: 'truck', icon: Truck },
    { name: 'siren', label: 'siren', icon: Siren },
    { name: 'radio', label: 'radio', icon: Radio },
    { name: 'map', label: 'map', icon: Map },
    { name: 'map-pinned', label: 'map-pinned', icon: MapPinned },
    { name: 'target', label: 'target', icon: Target },
    { name: 'crosshair', label: 'crosshair', icon: Crosshair },
    { name: 'briefcase', label: 'briefcase', icon: Briefcase },
    { name: 'calendar-check', label: 'calendar-check', icon: CalendarCheck },
    { name: 'notebook-pen', label: 'notebook-pen', icon: NotebookPen },
    { name: 'bell', label: 'bell', icon: Bell },
    { name: 'clipboard-plus', label: 'clipboard-plus', icon: ClipboardPlus },
    { name: 'package', label: 'package', icon: Package },
];

// Helper para encontrar o componente do ícone pelo nome
function getIconByName(name: string) {
    return TOPIC_ICONS.find(ic => ic.name === name) || TOPIC_ICONS.find(ic => ic.name === 'briefcase') || TOPIC_ICONS[0];
}

// Modal de seleção de ícone
interface IconPickerModalProps {
    value: string;
    onConfirm: (iconName: string) => void;
    onClose: () => void;
}

function IconPickerModal({ value, onConfirm, onClose }: IconPickerModalProps) {
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(value);

    const filtered = TOPIC_ICONS.filter(ic =>
        ic.label.toLowerCase().includes(search.toLowerCase())
    );

    const SelectedIconDef = getIconByName(selected);
    const SelectedIconNode = SelectedIconDef.icon;

    return (
        <div className="fixed inset-0 bg-pm-dark/60 backdrop-blur-md z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-pm-secondary/20 flex flex-col max-h-[90vh] overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-pm-secondary/10 bg-pm-light/30">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-pm-primary/10 flex items-center justify-center border border-pm-primary/20">
                            <Smile className="w-6 h-6 text-pm-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-pm-dark tracking-tight">Vetor de Ícones</h3>
                            <p className="text-[10px] font-bold text-pm-secondary/60 uppercase tracking-widest">{TOPIC_ICONS.length} opções disponíveis</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-icon-only">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="px-6 pt-6 mb-2">
                    <div className="relative group">
                        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-pm-secondary group-focus-within:text-pm-primary transition-colors" />
                        <input
                            autoFocus
                            type="text"
                            placeholder="Pesquisar ícone por identificador..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="input-field pl-11"
                        />
                    </div>
                </div>

                {/* Preview */}
                {selected && (
                    <div className="mx-6 mt-2 px-5 py-3 bg-pm-primary/5 border border-pm-primary/20 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
                        <div className="w-10 h-10 rounded-xl bg-pm-primary/20 flex items-center justify-center text-pm-primary shadow-sm">
                            <SelectedIconNode className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-pm-primary uppercase tracking-tighter">Vetor Ativo</p>
                            <p className="text-sm font-bold text-pm-dark/70 font-mono tracking-tight">{selected}</p>
                        </div>
                    </div>
                )}

                {/* Grid */}
                <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
                    {filtered.length === 0 ? (
                        <div className="text-center py-12">
                            <Search className="w-12 h-12 text-pm-secondary/20 mx-auto mb-3" />
                            <p className="text-sm font-bold text-pm-secondary/60">Nenhum ícone encontrado para "{search}"</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-6 sm:grid-cols-7 gap-2.5">
                            {filtered.map(iconDef => {
                                const IconNode = iconDef.icon;
                                const isSelected = selected === iconDef.name;
                                return (
                                    <button
                                        key={iconDef.name}
                                        onClick={() => setSelected(iconDef.name)}
                                        title={iconDef.label}
                                        className={`relative h-14 rounded-2xl flex items-center justify-center transition-all border-2 ${isSelected
                                            ? 'bg-pm-primary border-pm-primary text-white shadow-lg scale-110 z-10'
                                            : 'bg-pm-light/50 border-transparent text-pm-secondary hover:bg-white hover:border-pm-primary/30 hover:text-pm-primary hover:shadow-sm'
                                            }`}
                                    >
                                        <IconNode className="w-6 h-6" />
                                        {isSelected && (
                                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-pm-primary border-2 border-pm-primary rounded-full flex items-center justify-center shadow-lg">
                                                <Check className="w-3 h-3 font-black" />
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-pm-secondary/10 bg-pm-light/30 flex items-center justify-between gap-4">
                    <button
                        onClick={() => setSelected('')}
                        className="text-xs font-bold text-pm-secondary/60 hover:text-red-500 transition-colors uppercase tracking-widest px-2"
                    >
                        Limpar seleção
                    </button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="btn btn-ghost border-pm-secondary/20">
                            Cancelar
                        </button>
                        <button
                            onClick={() => onConfirm(selected)}
                            className="btn btn-primary"
                            disabled={!selected}
                        >
                            <Check className="w-4 h-4" /> Aplicar Ícone
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function AdminDynamicForms() {
    const { units, dataGroups, fields, addUnit, updateUnit, deleteUnit, addDataGroup, updateDataGroup, deleteDataGroup, addField, updateField, deleteField, fieldValues } = useAuth();

    const [selectedUnit, setSelectedUnit] = useState<string | null>(units[0]?.id || null);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

    const [newUnitName, setNewUnitName] = useState('');
    const [newUnitIcon, setNewUnitIcon] = useState('briefcase'); // Default icon

    // Group CRUDS
    const [newGroupTitle, setNewGroupTitle] = useState('');
    const [newGroupMode, setNewGroupMode] = useState<'snapshot' | 'collection'>('snapshot');
    const [newGroupCategory, setNewGroupCategory] = useState('');

    // Editing State
    const [editingField, setEditingField] = useState<Field | null>(null);
    const [isCreatingField, setIsCreatingField] = useState(false);
    const [editError, setEditError] = useState('');

    // Calculation State
    const [calculationOperation, setCalculationOperation] = useState<CalculationOperation>('sum');
    const [selectedSourceFields, setSelectedSourceFields] = useState<string[]>([]);

    // Deleting State
    const [deletingField, setDeletingField] = useState<Field | null>(null);

    // Group CRUDS State
    const [editingGroup, setEditingGroup] = useState<any>(null); // Type is DataGroup
    const [editGroupTitle, setEditGroupTitle] = useState('');
    const [editGroupCategory, setEditGroupCategory] = useState('');
    const [deletingGroup, setDeletingGroup] = useState<any>(null);

    // Unit (Topic) Edit State
    const [editingUnit, setEditingUnit] = useState<any>(null); // Type is Unit (Topico)
    const [editUnitName, setEditUnitName] = useState('');
    const [editUnitIcon, setEditUnitIcon] = useState('briefcase');
    const [deletingUnit, setDeletingUnit] = useState<any>(null); // For confirmation modal

    // Icon Picker Modal State
    // 'create' = formulário de criação | 'edit' = modal de edição | null = fechado
    const [iconModalTarget, setIconModalTarget] = useState<'create' | 'edit' | null>(null);

    const unitGroups = dataGroups.filter(g => g.unitId === selectedUnit);
    const categoryOptions = Array.from(new Set(unitGroups.map(g => g.categoryTitle?.trim()).filter(Boolean) as string[]));
    const getCategoryOrder = (categoryTitle: string) => {
        const matching = unitGroups.filter(g => (g.categoryTitle || '').trim() === categoryTitle);
        return matching.length > 0 ? Math.min(...matching.map(g => g.categoryOrder ?? 999)) : categoryOptions.length + 1;
    };
    const groupedUnitGroups = [...unitGroups]
        .sort((a, b) => (a.categoryOrder ?? 999) - (b.categoryOrder ?? 999) || a.order - b.order)
        .reduce<{ title: string; order: number; groups: typeof unitGroups }[]>((acc, group) => {
            const title = group.categoryTitle?.trim() || 'Sem categoria';
            const existing = acc.find(item => item.title === title);
            if (existing) {
                existing.groups.push(group);
                existing.order = Math.min(existing.order, group.categoryOrder ?? 999);
                return acc;
            }
            acc.push({ title, order: group.categoryOrder ?? 999, groups: [group] });
            return acc;
        }, [])
        .sort((a, b) => a.order - b.order);

    // Apenas campos ativos para este painel (excluindo os soft-deleted)
    const groupFields = fields.filter(f => f.dataGroupId === selectedGroup && f.isActive).sort((a, b) => a.order - b.order);

    const handleCreateUnit = () => {
        if (!newUnitName.trim()) return;
        const newId = crypto.randomUUID();
        // @ts-ignore - Update implementation will fix typings, ignoring temporal issues for rapid update
        addUnit({
            id: newId,
            name: newUnitName,
            description: newUnitIcon // Usando description para guardar a Key do Ícone
        });
        setNewUnitName('');
        setNewUnitIcon('briefcase');
        setSelectedUnit(newId);
        setSelectedGroup(null);
    };

    const saveUnitEdit = () => {
        if (!editingUnit || !editUnitName.trim()) return;
        // @ts-ignore
        updateUnit(editingUnit.id, {
            name: editUnitName,
            description: editUnitIcon
        });
        setEditingUnit(null);
    }


    const confirmDeleteUnit = () => {
        if (!deletingUnit) return;
        deleteUnit(deletingUnit.id);
        if (selectedUnit === deletingUnit.id) {
            setSelectedUnit(null);
            setSelectedGroup(null);
        }
        setDeletingUnit(null);
    }

    const handleCreateGroup = () => {
        if (!newGroupTitle.trim() || !selectedUnit) return;
        const newId = crypto.randomUUID();
        addDataGroup({
            id: newId,
            unitId: selectedUnit,
            title: newGroupTitle,
            order: unitGroups.length + 1,
            mode: newGroupMode,
            categoryTitle: newGroupCategory.trim() || null,
            categoryOrder: newGroupCategory.trim() ? getCategoryOrder(newGroupCategory.trim()) : 999
        });
        setNewGroupTitle('');
        setNewGroupMode('snapshot');
        setNewGroupCategory('');
        setSelectedGroup(newId);
    };

    const handleDuplicateGroup = (groupToCopy: any) => {
        const newGroupUUID = crypto.randomUUID();

        // Copia o Grupo atualizando ID e Título
        addDataGroup({
            id: newGroupUUID,
            unitId: groupToCopy.unitId,
            title: `${groupToCopy.title} (Cópia)`,
            order: unitGroups.length + 1,
            mode: groupToCopy.mode,
            categoryTitle: groupToCopy.categoryTitle ?? null,
            categoryOrder: groupToCopy.categoryOrder ?? 999
        });

        // Copia os Campos pertencentes
        const fieldsToCopy = fields.filter(f => f.dataGroupId === groupToCopy.id && f.isActive);
        fieldsToCopy.forEach(field => {
            addField({
                ...field,
                id: crypto.randomUUID(),
                dataGroupId: newGroupUUID
            });
        });

        setSelectedGroup(newGroupUUID);
    };

    const saveGroupEdit = () => {
        if (!editingGroup || !editGroupTitle.trim()) return;
        const normalizedCategory = editGroupCategory.trim();
        updateDataGroup(editingGroup.id, {
            title: editGroupTitle,
            categoryTitle: normalizedCategory || null,
            categoryOrder: normalizedCategory ? getCategoryOrder(normalizedCategory) : 999
        });
        setEditingGroup(null);
    }

    const handleAddField = (type: FieldType) => {
        if (!selectedGroup) return;
        setEditingField({
            id: crypto.randomUUID(),
            dataGroupId: selectedGroup,
            name: ``,
            type: type,
            required: false,
            order: groupFields.length + 1,
            isActive: true
        });
        setCalculationOperation('sum');
        setSelectedSourceFields([]);
        setIsCreatingField(true);
        setEditError('');
    };

    // Reordenação
    const moveField = (fieldId: string, direction: 'up' | 'down') => {
        const idx = groupFields.findIndex(f => f.id === fieldId);
        if (idx < 0) return;
        if (direction === 'up' && idx === 0) return;
        if (direction === 'down' && idx === groupFields.length - 1) return;

        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        const targetField = groupFields[targetIdx];

        // Swap orders
        updateField(fieldId, { order: targetField.order });
        updateField(targetField.id, { order: groupFields[idx].order });
    };

    const moveUnit = (unitId: string, direction: 'up' | 'down') => {
        // Ordena para garantir os índices visuais corretos
        const sortedUnits = [...units].sort((a, b) => (a.order_index ?? 999) - (b.order_index ?? 999));
        const idx = sortedUnits.findIndex(u => u.id === unitId);
        if (idx < 0) return;
        if (direction === 'up' && idx === 0) return;
        if (direction === 'down' && idx === sortedUnits.length - 1) return;

        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        const targetUnit = sortedUnits[targetIdx];

        // Swap order_indexes
        // @ts-ignore
        updateUnit(unitId, { order_index: targetUnit.order_index ?? 999 });
        // @ts-ignore
        updateUnit(targetUnit.id, { order_index: sortedUnits[idx].order_index ?? 999 });
    };

    const moveGroup = (groupId: string, direction: 'up' | 'down') => {
        const sortedGroups = [...unitGroups].sort((a, b) => a.order - b.order);
        const idx = sortedGroups.findIndex(g => g.id === groupId);
        if (idx < 0) return;
        if (direction === 'up' && idx === 0) return;
        if (direction === 'down' && idx === sortedGroups.length - 1) return;

        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        const targetGroup = sortedGroups[targetIdx];

        // Swap orders
        updateDataGroup(groupId, { order: targetGroup.order });
        updateDataGroup(targetGroup.id, { order: sortedGroups[idx].order });
    };

    // Edição Segura (Lógica Restritiva)
    const openEditModal = (field: Field) => {
        setEditingField({ ...field });
        if (field.calculationConfig) {
            setCalculationOperation(field.calculationConfig.operation);
            setSelectedSourceFields(field.calculationConfig.sourceFieldIds);
        } else {
            setCalculationOperation('sum');
            setSelectedSourceFields([]);
        }
        setIsCreatingField(false);
        setEditError('');
    };

    const saveEdit = () => {
        if (!editingField) return;

        if (!editingField.name.trim()) {
            setEditError('Por favor, informe um Label (Nome) para o campo.');
            return;
        }

        if (editingField.type === 'calculated') {
            if (selectedSourceFields.length < 2) {
                setEditError('Selecione pelo menos 2 campos para o cálculo.');
                return;
            }
            editingField.calculationConfig = {
                operation: calculationOperation,
                sourceFieldIds: selectedSourceFields
            };
        } else {
            editingField.calculationConfig = null;
        }

        if (isCreatingField) {
            addField(editingField);
            setEditingField(null);
            setIsCreatingField(false);
            return;
        }

        // Validar mudança de tipagem
        const originalField = fields.find(f => f.id === editingField.id);
        if (originalField && originalField.type !== editingField.type) {
            const hasAnswers = fieldValues.some(fv => fv.fieldId === editingField.id);

            if (hasAnswers) {
                // Checagem de cast seguro (Extremamente rígida conforme a nova regra)
                if (originalField.type === 'number' && editingField.type === 'text') {
                    // OK
                } else {
                    setEditError('Este campo já possui dados preenchidos. Para alterar fortemente o tipo, arquive este e crie um novo.');
                    return;
                }
            }
        }

        updateField(editingField.id, {
            name: editingField.name,
            required: editingField.required,
            type: editingField.type,
            calculationConfig: editingField.calculationConfig
        });
        setEditingField(null);
    };

    const duplicateField = (field: Field) => {
        const newField: Field = {
            ...field,
            id: crypto.randomUUID(),
            name: `${field.name} (cópia)`,
            order: groupFields.length + 1
        };
        addField(newField);
    };

    // Exclusão Segura
    const requestDelete = (field: Field) => {
        const respCount = fieldValues.filter(fv => fv.fieldId === field.id).length;
        if (respCount === 0) {
            // Hard deleção direta, não tem impacto.
            deleteField(field.id, false);
        } else {
            // Alertar e dar opções
            setDeletingField(field);
        }
    }

    const confirmDelete = (soft: boolean) => {
        if (!deletingField) return;
        deleteField(deletingField.id, soft);
        setDeletingField(null);
    }

    return (
        <div className="flex flex-col gap-10 animate-in fade-in duration-500">
            {/* Header e Título Principal */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white p-6 rounded-3xl shadow-premium border border-pm-secondary/10">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-pm-primary text-white flex items-center justify-center shadow-lg shadow-pm-primary/20 ring-4 ring-pm-primary/10">
                        <LayoutTemplate className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-pm-dark tracking-tight">Arquitetura de Dados</h1>
                        <p className="text-xs font-bold text-pm-secondary/60 uppercase tracking-widest mt-0.5">Gerenciamento de Tópicos e Campos Dinâmicos</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

                {/* Coluna Esquerda: Gestão de Tópicos */}
                <div className="lg:col-span-4 flex flex-col gap-8">
                    <div className="card p-0 overflow-hidden flex flex-col">
                        <div className="px-6 py-5 border-b border-pm-secondary/10 bg-pm-light/30">
                            <h3 className="section-title mb-0">1. Tópicos de Briefing</h3>
                            <p className="text-[10px] font-bold text-pm-secondary/50 mt-1 uppercase tracking-tighter">Estrutura de Alto Nível</p>
                        </div>

                        <div className="p-6 bg-pm-light/20 border-b border-pm-secondary/10">
                            <div className="space-y-4">
                                <div>
                                    <label className="input-label">NOME DO TÓPICO</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Operações, Logística..."
                                        value={newUnitName}
                                        onChange={e => setNewUnitName(e.target.value)}
                                        className="input-field"
                                    />
                                </div>

                                <div>
                                    <label className="input-label">VETOR VISUAL (ÍCONE)</label>
                                    <button
                                        type="button"
                                        onClick={() => setIconModalTarget('create')}
                                        className="w-full h-14 bg-white border border-pm-secondary/20 rounded-2xl px-4 flex items-center gap-4 hover:border-pm-primary/40 transition-all group shadow-sm"
                                    >
                                        {(() => {
                                            const def = getIconByName(newUnitIcon);
                                            const Icon = def.icon;
                                            return (
                                                <div className="w-10 h-10 rounded-xl bg-pm-primary/10 flex items-center justify-center text-pm-primary group-hover:scale-110 transition-transform">
                                                    <Icon className="w-5 h-5" />
                                                </div>
                                            );
                                        })()}
                                        <div className="flex-1 text-left">
                                            <p className="text-xs font-bold text-pm-dark truncate uppercase tracking-tight">{newUnitIcon}</p>
                                            <p className="text-[10px] text-pm-secondary/60 uppercase font-black tracking-widest">Alterar</p>
                                        </div>
                                        <ChevronDown className="w-4 h-4 text-pm-secondary/40" />
                                    </button>
                                </div>

                                <button
                                    onClick={handleCreateUnit}
                                    disabled={!newUnitName.trim()}
                                    className="btn btn-primary w-full h-12 mt-2"
                                >
                                    <Plus className="w-4 h-4" /> Criar Novo Tópico
                                </button>
                            </div>
                        </div>

                    <div className="p-6 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                        {units.sort((a, b) => (a.order_index ?? 999) - (b.order_index ?? 999)).map((unit, unitIdx) => {
                            const unitIconDef = getIconByName(unit.description || 'briefcase');
                            const UnitIcon = unitIconDef.icon;

                            return (
                                <div key={unit.id} className="group relative">
                                    <button
                                        onClick={() => {
                                            setSelectedUnit(unit.id);
                                            setSelectedGroup(null);
                                        }}
                                        className={`w-full flex items-center gap-4 pl-12 pr-6 py-5 rounded-3xl transition-all border-2 text-left ${selectedUnit === unit.id
                                            ? 'bg-white border-pm-primary/40 shadow-premium-lg translate-x-1'
                                            : 'bg-transparent border-transparent hover:bg-pm-light/50 hover:border-pm-secondary/10'
                                            }`}
                                    >
                                        {/* Setas de Reordenação - Internas */}
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col opacity-0 group-hover:opacity-100 transition-all">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); moveUnit(unit.id, 'up'); }}
                                                disabled={unitIdx === 0}
                                                className="p-1 text-pm-secondary hover:text-pm-primary transition-all disabled:opacity-10"
                                            >
                                                <ChevronUp className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); moveUnit(unit.id, 'down'); }}
                                                disabled={unitIdx === units.length - 1}
                                                className="p-1 text-pm-secondary hover:text-pm-primary transition-all disabled:opacity-10"
                                            >
                                                <ChevronDown className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${selectedUnit === unit.id
                                            ? 'bg-pm-primary text-white shadow-xl shadow-pm-primary/20'
                                            : 'bg-pm-light text-pm-secondary/40 group-hover:bg-pm-primary/10 group-hover:text-pm-primary'
                                            }`}>
                                            <UnitIcon className="w-7 h-7" />
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <p className={`text-md font-black uppercase tracking-tighter truncate ${selectedUnit === unit.id ? 'text-pm-dark' : 'text-pm-secondary/70 group-hover:text-pm-dark'}`}>
                                                {unit.name}
                                            </p>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <span className={`text-[10px] font-bold uppercase tracking-widest ${selectedUnit === unit.id ? 'text-pm-primary' : 'text-pm-secondary/40'}`}>
                                                    {dataGroups.filter(g => g.unitId === unit.id).length} SEÇÕES
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingUnit(unit);
                                            setEditUnitName(unit.name);
                                            setEditUnitIcon(unit.description || 'briefcase');
                                        }}
                                        className={`absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-xl transition-all ${selectedUnit === unit.id ? 'bg-pm-primary/10 text-pm-primary hover:bg-pm-primary hover:text-white shadow-sm' : 'bg-transparent text-pm-secondary/20 hover:text-pm-primary hover:bg-white opacity-0 group-hover:opacity-100'}`}
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                </div>
                            );
                        })}
                        {units.length === 0 && (
                            <p className="text-sm text-pm-secondary italic text-center py-4">Nenhum Tópico cadastrado.</p>
                        )}
                    </div>
                </div>
                </div>

                {/* Coluna 2: Conjuntos de Dados */}
                <div className="lg:col-span-4 flex flex-col gap-8">
                    <div className="card p-0 overflow-hidden flex flex-col min-h-[700px]">
                        <div className="px-8 py-6 border-b border-pm-secondary/10 bg-pm-light/30">
                            <h3 className="section-title mb-0">2. Seções</h3>
                            <p className="text-[10px] font-black text-pm-secondary/50 mt-1 uppercase tracking-widest leading-none">Conjuntos de Informação</p>
                        </div>

                        <div className="p-8 bg-pm-light/20 border-b border-pm-secondary/10">
                            {!selectedUnit ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-pm-primary/5 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                                        <ArrowLeft className="w-8 h-8 text-pm-primary/30" />
                                    </div>
                                    <p className="text-[10px] font-black text-pm-secondary/40 uppercase tracking-[0.2em]">Selecione um Tópico para Prosseguir</p>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    <div>
                                        <label className="input-label">NOME DA SEÇÃO</label>
                                        <input
                                            type="text"
                                            placeholder="Ex: Efetivo Diário..."
                                            value={newGroupTitle}
                                            onChange={e => setNewGroupTitle(e.target.value)}
                                            className="input-field"
                                        />
                                    </div>
                                    <div>
                                        <label className="input-label">CATEGORIA DO RELATÓRIO</label>
                                        <input
                                            list="category-options"
                                            type="text"
                                            placeholder="Ex: Operacional, Administrativo..."
                                            value={newGroupCategory}
                                            onChange={e => setNewGroupCategory(e.target.value)}
                                            className="input-field"
                                        />
                                        <datalist id="category-options">
                                            {categoryOptions.map(category => (
                                                <option key={category} value={category} />
                                            ))}
                                        </datalist>
                                        <p className="text-[10px] text-pm-secondary/60 font-bold mt-2 uppercase tracking-wider">
                                            Use categorias para agrupar seções no relatório e facilitar a leitura.
                                        </p>
                                    </div>
                                    <div>
                                        <label className="input-label">MODO OPERACIONAL</label>
                                        <div className="grid grid-cols-2 gap-3 p-1.5 bg-white border border-pm-secondary/20 rounded-2xl shadow-inner">
                                            <button
                                                onClick={() => setNewGroupMode('snapshot')}
                                                className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all ${newGroupMode === 'snapshot' ? 'bg-pm-dark text-white shadow-premium' : 'text-pm-secondary hover:bg-pm-light'}`}
                                            >
                                                <Database className="w-4 h-4" />
                                                <span className="text-[9px] font-black uppercase tracking-widest">Snapshot</span>
                                            </button>
                                            <button
                                                onClick={() => setNewGroupMode('collection')}
                                                className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all ${newGroupMode === 'collection' ? 'bg-pm-dark text-white shadow-premium' : 'text-pm-secondary hover:bg-pm-light'}`}
                                            >
                                                <ClipboardList className="w-4 h-4" />
                                                <span className="text-[9px] font-black uppercase tracking-widest">Coleção</span>
                                            </button>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleCreateGroup}
                                        disabled={!newGroupTitle.trim()}
                                        className="btn btn-primary w-full h-14"
                                    >
                                        <Plus className="w-5 h-5" /> Adicionar Seção
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto space-y-5 custom-scrollbar">
                            {selectedUnit && groupedUnitGroups.map(category => (
                                <div key={category.title} className="space-y-3">
                                    <div className="px-3 py-2 rounded-2xl bg-pm-light border border-pm-secondary/10">
                                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-pm-dark">{category.title}</p>
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-pm-secondary/60">{category.groups.length} seção(ões)</p>
                                    </div>
                                    {category.groups.sort((a, b) => a.order - b.order).map((g, groupIdx) => (
                                <div key={g.id} className="group/dg relative ml-3">
                                    <button
                                        onClick={() => setSelectedGroup(g.id)}
                                        className={`w-full flex items-center justify-between gap-4 pl-12 pr-6 py-5 rounded-3xl transition-all border-2 text-left ${selectedGroup === g.id
                                            ? 'bg-pm-secondary border-pm-secondary text-white shadow-premium-lg translate-x-1'
                                            : 'bg-white border-pm-secondary/10 hover:border-pm-secondary/30 hover:bg-pm-light/30 shadow-sm'
                                            }`}
                                    >
                                        {/* Setas de Reordenação - Internas */}
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col opacity-0 group-hover/dg:opacity-60 hover:!opacity-100 transition-all">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); moveGroup(g.id, 'up'); }}
                                                disabled={groupIdx === 0}
                                                className={`p-1 transition-all disabled:opacity-10 ${selectedGroup === g.id ? 'text-white' : 'text-pm-secondary hover:text-pm-primary'}`}
                                            >
                                                <ChevronUp className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); moveGroup(g.id, 'down'); }}
                                                disabled={groupIdx === unitGroups.length - 1}
                                                className={`p-1 transition-all disabled:opacity-10 ${selectedGroup === g.id ? 'text-white' : 'text-pm-secondary hover:text-pm-primary'}`}
                                            >
                                                <ChevronDown className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="flex-1 overflow-hidden">
                                            <p className={`text-sm font-black uppercase tracking-tight truncate ${selectedGroup === g.id ? 'text-white' : 'text-pm-dark'}`}>
                                                {g.title}
                                            </p>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${selectedGroup === g.id ? 'bg-white/20 border-white/30 text-white' : 'bg-pm-light border-pm-secondary/10 text-pm-secondary/60'}`}>
                                                    {g.mode === 'snapshot' ? 'Valores' : 'Itens'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={`flex gap-1.5 transition-opacity ${selectedGroup === g.id ? 'opacity-100' : 'opacity-0 group-hover/dg:opacity-100'}`}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDuplicateGroup(g); }}
                                                className={`p-2 rounded-xl transition-all ${selectedGroup === g.id ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white text-pm-secondary hover:text-pm-primary shadow-premium border border-pm-secondary/10'}`}
                                            >
                                                <Copy className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditingGroup(g); setEditGroupTitle(g.title); setEditGroupCategory(g.categoryTitle || ''); }}
                                                className={`p-2 rounded-xl transition-all ${selectedGroup === g.id ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white text-pm-secondary hover:text-pm-primary shadow-premium border border-pm-secondary/10'}`}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setDeletingGroup(g); }}
                                                className={`p-2 rounded-xl transition-all ${selectedGroup === g.id ? 'bg-red-400/20 text-white hover:bg-red-500' : 'bg-red-50 text-red-500 hover:bg-red-100 shadow-premium border border-red-100'}`}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </button>
                                </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Coluna 3: Campos Estruturais */}
                <div className="lg:col-span-4 flex flex-col gap-8">
                    <div className="card p-0 overflow-hidden flex flex-col min-h-[700px]">
                        <div className="px-8 py-6 border-b border-pm-secondary/10 bg-pm-light/30">
                            <h3 className="section-title mb-0">3. Campos</h3>
                            <p className="text-[10px] font-black text-pm-secondary/50 mt-1 uppercase tracking-widest leading-none">Atributos de Pesquisa</p>
                        </div>

                        {!selectedGroup ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                                <div className="w-20 h-20 bg-pm-primary/5 rounded-3xl flex items-center justify-center mb-6">
                                    <Database className="w-10 h-10 text-pm-primary/20" />
                                </div>
                                <p className="text-xs font-black text-pm-secondary/40 uppercase tracking-widest max-w-[200px] leading-relaxed">
                                    Selecione um Conjunto de Dados para Configurar a Estrutura de Campos
                                </p>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col">
                                <div className="p-8 bg-pm-light/20 border-b border-pm-secondary/10">
                                    <p className="text-[10px] font-black text-pm-secondary/60 uppercase tracking-widest mb-4">Adicionar Novo Atributo</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => handleAddField('text')} className="flex items-center gap-3 px-4 py-3 bg-white border border-pm-secondary/10 rounded-2xl text-[10px] font-black text-pm-dark uppercase tracking-tighter hover:border-pm-primary/40 hover:shadow-premium-lg transition-all"><Type className="w-4 h-4 text-pm-primary" /> Texto</button>
                                        <button onClick={() => handleAddField('textarea')} className="flex items-center gap-3 px-4 py-3 bg-white border border-pm-secondary/10 rounded-2xl text-[10px] font-black text-pm-dark uppercase tracking-tighter hover:border-pm-primary/40 hover:shadow-premium-lg transition-all"><AlignLeft className="w-4 h-4 text-pm-primary" /> Descritivo</button>
                                        <button onClick={() => handleAddField('number')} className="flex items-center gap-3 px-4 py-3 bg-white border border-pm-secondary/10 rounded-2xl text-[10px] font-black text-pm-dark uppercase tracking-tighter hover:border-pm-primary/40 hover:shadow-premium-lg transition-all"><Hash className="w-4 h-4 text-pm-primary" /> Numérico</button>
                                        <button onClick={() => handleAddField('percentage')} className="flex items-center gap-3 px-4 py-3 bg-white border border-pm-secondary/10 rounded-2xl text-[10px] font-black text-pm-dark uppercase tracking-tighter hover:border-pm-primary/40 hover:shadow-premium-lg transition-all"><Percent className="w-4 h-4 text-pm-primary" /> Percentual</button>
                                        <button onClick={() => handleAddField('image')} className="flex items-center gap-3 px-4 py-3 bg-white border border-pm-secondary/10 rounded-2xl text-[10px] font-black text-pm-dark uppercase tracking-tighter hover:border-pm-primary/40 hover:shadow-premium-lg transition-all"><ImageIcon className="w-4 h-4 text-pm-primary" /> Mídia</button>
                                        <button onClick={() => handleAddField('calculated')} className="flex items-center gap-3 px-4 py-3 bg-pm-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-tighter hover:shadow-xl hover:shadow-pm-primary/20 transition-all border-none"><Calculator className="w-4 h-4" /> Calculado</button>
                                    </div>
                                </div>

                                <div className="p-6 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                                    {groupFields.map((f, i) => (
                                        <div key={f.id} className="group/field relative bg-white border border-pm-secondary/10 p-5 rounded-3xl shadow-sm hover:border-pm-primary/30 hover:shadow-premium-lg transition-all">
                                            <div className="flex items-center gap-5">
                                                <div className="flex flex-col opacity-0 group-hover/field:opacity-100 transition-all scale-90 -translate-x-2 group-hover:translate-x-0">
                                                    <button onClick={() => moveField(f.id, 'up')} disabled={i === 0} className="p-1 text-pm-secondary hover:text-pm-primary transition-all disabled:opacity-10"><ChevronUp className="w-4 h-4" /></button>
                                                    <button onClick={() => moveField(f.id, 'down')} disabled={i === groupFields.length - 1} className="p-1 text-pm-secondary hover:text-pm-primary transition-all disabled:opacity-10"><ChevronDown className="w-4 h-4" /></button>
                                                </div>

                                                <div className="flex-1 overflow-hidden">
                                                    <div className="flex items-center gap-3">
                                                        <h4 className="text-sm font-black text-pm-dark uppercase tracking-tight truncate">{f.name}</h4>
                                                        {f.required && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50" title="Obrigatório" />}
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-1.5">
                                                        <span className="text-[9px] font-black uppercase tracking-[0.1em] text-pm-primary bg-pm-primary/5 px-2 py-0.5 rounded-md border border-pm-primary/10">
                                                            {f.type}
                                                        </span>
                                                        {f.type === 'calculated' && (
                                                            <span className="text-[8px] font-bold text-pm-secondary uppercase tracking-widest">( Dinâmico )</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5 opacity-0 group-hover/field:opacity-100 transition-all">
                                                    <button onClick={() => openEditModal(f)} className="p-2 bg-pm-light text-pm-secondary hover:bg-pm-primary hover:text-white rounded-xl transition-all shadow-sm" title="Editar Atributo"><Edit2 className="w-4 h-4" /></button>
                                                    <button onClick={() => duplicateField(f)} className="p-2 bg-pm-light text-pm-secondary hover:bg-pm-primary hover:text-white rounded-xl transition-all shadow-sm" title="Duplicar Atributo"><Copy className="w-4 h-4" /></button>
                                                    <button onClick={() => requestDelete(f)} className="p-2 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all shadow-sm" title="Remover Atributo"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {groupFields.length === 0 && (
                                        <div className="py-12 text-center">
                                            <p className="text-[10px] font-black text-pm-secondary/30 uppercase tracking-[0.2em]">Configuração Vazia</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MODAL DE EDIÇÃO DE UNIDADE */}
            {editingUnit && (
                <div className="fixed inset-0 bg-pm-dark/60 backdrop-blur-md z-[55] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-premium-2xl w-full max-w-md p-8 border border-pm-secondary/10 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xl font-black text-pm-dark uppercase tracking-tight">Editar Tópico</h3>
                                <p className="text-[10px] font-bold text-pm-secondary/50 uppercase tracking-widest mt-1">Configurações Base</p>
                            </div>
                            <button onClick={() => setEditingUnit(null)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-pm-light text-pm-secondary transition-all">&times;</button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="input-label">NOME DO TÓPICO</label>
                                <input
                                    type="text"
                                    value={editUnitName}
                                    onChange={e => setEditUnitName(e.target.value)}
                                    className="input-field h-14"
                                />
                            </div>

                            <div>
                                <label className="input-label">ÍCONE REPRESENTATIVO</label>
                                <button
                                    type="button"
                                    onClick={() => setIconModalTarget('edit')}
                                    className="w-full flex items-center gap-4 px-5 py-4 bg-pm-light/30 border-2 border-transparent hover:border-pm-primary/40 hover:bg-white rounded-2xl transition-all group"
                                >
                                    {(() => {
                                        const def = getIconByName(editUnitIcon);
                                        const Icon = def.icon;
                                        return (
                                            <div className="w-12 h-12 rounded-xl bg-pm-primary text-white flex items-center justify-center shadow-lg shadow-pm-primary/20">
                                                <Icon className="w-6 h-6" />
                                            </div>
                                        );
                                    })()}
                                    <div className="flex-1 text-left">
                                        <p className="text-xs font-black text-pm-dark uppercase tracking-wide">{editUnitIcon || 'Sem ícone'}</p>
                                        <p className="text-[10px] text-pm-secondary/60">Clique aqui para alterar visual</p>
                                    </div>
                                    <Smile className="w-5 h-5 text-pm-secondary/30 group-hover:text-pm-primary transition-colors" />
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 mt-10">
                            <button
                                onClick={saveUnitEdit}
                                disabled={!editUnitName.trim()}
                                className="btn btn-primary w-full h-14 text-sm"
                            >
                                <Save className="w-5 h-5" /> Salvar Alterações
                            </button>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setEditingUnit(null)}
                                    className="w-full h-12 rounded-2xl border-2 border-pm-secondary/10 font-black text-[10px] text-pm-secondary uppercase tracking-widest hover:bg-pm-light transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingUnit(null);
                                        setDeletingUnit(editingUnit);
                                    }}
                                    className="w-full h-12 rounded-2xl border-2 border-red-100 font-black text-[10px] text-red-500 uppercase tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" /> Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE SELEÇÃO DE ÍCONE */}
            {iconModalTarget === 'create' && (
                <IconPickerModal
                    value={newUnitIcon}
                    onConfirm={(name) => { setNewUnitIcon(name || 'briefcase'); setIconModalTarget(null); }}
                    onClose={() => setIconModalTarget(null)}
                />
            )}
            {iconModalTarget === 'edit' && (
                <IconPickerModal
                    value={editUnitIcon}
                    onConfirm={(name) => { setEditUnitIcon(name || 'briefcase'); setIconModalTarget(null); }}
                    onClose={() => setIconModalTarget(null)}
                />
            )}

            {/* MODAL DE DELEÇÃO DE UNIDADE/TÓPICO */}
            {deletingUnit && (
                <div className="fixed inset-0 bg-pm-dark/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-premium-2xl w-full max-w-md border border-pm-secondary/10 animate-in fade-in zoom-in-95 overflow-hidden">
                        <div className="bg-gradient-to-br from-red-500 to-red-600 p-10 flex flex-col items-center justify-center text-white">
                            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
                                <AlertTriangle className="w-10 h-10" />
                            </div>
                            <h3 className="text-2xl font-black uppercase tracking-tighter text-center leading-tight">Excluir Tópico Definitivamente?</h3>
                        </div>
                        <div className="p-10">
                            <p className="text-sm text-center text-pm-secondary leading-relaxed mb-8">
                                Você está prestes a excluir o tópico <strong className="text-pm-dark px-2 py-0.5 bg-pm-light rounded">{deletingUnit.name}</strong>.
                                <br /><br />
                                <span className="font-black text-red-600 uppercase text-[10px] tracking-widest bg-red-50 px-4 py-3 rounded-2xl block border border-red-100">
                                    Atenção: Todos os Conjuntos de Dados e Registros vinculados serão apagados permanentemente.
                                </span>
                            </p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={confirmDeleteUnit}
                                    className="w-full h-16 bg-red-600 text-white rounded-2xl hover:bg-red-700 font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-red-600/20 flex items-center justify-center gap-3"
                                >
                                    <Trash2 className="w-5 h-5" /> Confirmar Exclusão Total
                                </button>
                                <button
                                    onClick={() => setDeletingUnit(null)}
                                    className="w-full h-14 bg-pm-light text-pm-secondary rounded-2xl hover:bg-pm-secondary/10 font-black text-[10px] uppercase tracking-widest transition-all"
                                >
                                    Manter Tópico
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE EDIÇÃO E CRIAÇÃO - CAMPOS */}
            {editingField && (
                <div className="fixed inset-0 bg-pm-dark/60 backdrop-blur-md z-[55] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-premium-2xl w-full max-w-md p-8 border border-pm-secondary/10 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xl font-black text-pm-dark uppercase tracking-tight">
                                    {isCreatingField ? 'Novo Atributo' : 'Configurar Atributo'}
                                </h3>
                                <p className="text-[10px] font-bold text-pm-secondary/50 uppercase tracking-widest mt-1">Definição de Estrutura de Dados</p>
                            </div>
                            <button onClick={() => { setEditingField(null); setIsCreatingField(false); }} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-pm-light text-pm-secondary transition-all">&times;</button>
                        </div>

                        {editError && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-xl flex gap-3 text-xs mb-6 border border-red-100 items-center">
                                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                                <p className="font-semibold">{editError}</p>
                            </div>
                        )}

                        <div className="space-y-6">
                            <div>
                                <label className="input-label">LABEL (NOME DE EXIBIÇÃO)</label>
                                <input
                                    type="text"
                                    value={editingField.name}
                                    onChange={e => setEditingField({ ...editingField, name: e.target.value })}
                                    className="input-field h-14"
                                    placeholder="Ex: Efetivo Total"
                                />
                            </div>

                            <div>
                                <label className="input-label">TIPO DE ENTRADA</label>
                                <div className="relative">
                                    <select
                                        value={editingField.type}
                                        onChange={e => setEditingField({ ...editingField, type: e.target.value as FieldType })}
                                        className="input-field h-14 appearance-none cursor-pointer bg-white"
                                    >
                                        <option value="text">Texto Curto</option>
                                        <option value="textarea">Texto Longo (Relatos)</option>
                                        <option value="number">Número Inteiro</option>
                                        <option value="percentage">Percentual (%)</option>
                                        <option value="image">Imagens (Upload)</option>
                                        <option value="calculated">Campo Calculado (Automático)</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-pm-secondary">
                                        <ChevronDown className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>

                            {editingField.type === 'calculated' && (
                                <div className="space-y-4 bg-pm-primary/5 p-6 rounded-[1.5rem] border border-pm-primary/10">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Calculator className="w-4 h-4 text-pm-primary" />
                                        <label className="text-[10px] font-black text-pm-primary uppercase tracking-widest">
                                            Lógica de Cálculo
                                        </label>
                                    </div>
                                    
                                    <select
                                        value={calculationOperation}
                                        onChange={(e) => setCalculationOperation(e.target.value as CalculationOperation)}
                                        className="w-full h-12 px-4 rounded-xl border border-pm-primary/20 bg-white text-sm font-bold text-pm-dark outline-none focus:ring-2 focus:ring-pm-primary/30 transition-all"
                                    >
                                        <option value="sum">Somatória Local (+)</option>
                                        <option value="subtract">Subtração Diferencial (-)</option>
                                    </select>

                                    <div>
                                        <label className="text-[9px] font-black text-pm-secondary/60 uppercase tracking-widest block mb-3">
                                            Variáveis Numéricas Disponíveis
                                        </label>
                                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                            {groupFields
                                                .filter(f => (f.type === 'number' || f.type === 'percentage') && f.id !== editingField.id)
                                                .map(f => (
                                                    <label key={f.id} className="flex items-center gap-3 p-3 bg-white border border-pm-secondary/10 rounded-xl cursor-pointer hover:border-pm-primary/40 transition-all group">
                                                        <div className="relative flex items-center justify-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedSourceFields.includes(f.id)}
                                                                onChange={() => {
                                                                    if (selectedSourceFields.includes(f.id)) {
                                                                        setSelectedSourceFields(prev => prev.filter(id => id !== f.id));
                                                                    } else {
                                                                        setSelectedSourceFields(prev => [...prev, f.id]);
                                                                    }
                                                                }}
                                                                className="w-5 h-5 rounded-md border-pm-secondary/20 text-pm-primary focus:ring-pm-primary focus:ring-offset-0"
                                                            />
                                                        </div>
                                                        <span className="text-xs font-bold text-pm-dark group-hover:text-pm-primary transition-colors">{f.name}</span>
                                                    </label>
                                                ))}
                                            {groupFields.filter(f => f.type === 'number' || f.type === 'percentage').length === 0 && (
                                                <div className="text-center py-4 bg-white/50 rounded-xl border border-dashed border-pm-secondary/20">
                                                    <p className="text-[10px] text-pm-secondary/60 font-medium">Nenhuma variável numérica encontrada.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <label className="flex items-center gap-4 p-5 bg-pm-light/30 border-2 border-transparent hover:border-pm-primary/10 rounded-[1.5rem] cursor-pointer transition-all group">
                                <input
                                    type="checkbox"
                                    checked={editingField.required}
                                    onChange={e => setEditingField({ ...editingField, required: e.target.checked })}
                                    className="w-5 h-5 rounded-md border-pm-secondary/20 text-pm-primary focus:ring-pm-primary"
                                />
                                <div>
                                    <span className="block text-xs font-black text-pm-dark uppercase tracking-tight group-hover:text-pm-primary transition-colors">Atributo Obrigatório</span>
                                    <span className="block text-[10px] text-pm-secondary/60">Impede o envio do relatório se estiver vazio</span>
                                </div>
                            </label>
                        </div>

                        <div className="mt-10 flex flex-col gap-3">
                            <button onClick={saveEdit} className="btn btn-primary h-14 w-full">
                                <Save className="w-5 h-5" /> {isCreatingField ? 'Confirmar Criação' : 'Atualizar Estrutura'}
                            </button>
                            <button 
                                onClick={() => { setEditingField(null); setIsCreatingField(false); }} 
                                className="w-full h-12 font-black text-[10px] text-pm-secondary uppercase tracking-widest hover:bg-pm-light transition-all rounded-2xl"
                            >
                                Descartar Alterações
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE DELEÇÃO DE CAMPO */}
            {deletingField && (
                <div className="fixed inset-0 bg-pm-dark/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-premium-2xl w-full max-w-lg p-10 border border-pm-secondary/10 animate-in fade-in zoom-in-95">
                        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-6 mx-auto">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-pm-dark text-center mb-3 uppercase tracking-tight">Preservação de Integridade</h3>
                        <p className="text-sm text-center text-pm-secondary leading-relaxed mb-8">
                            O campo <strong className="text-pm-dark whitespace-nowrap">"{deletingField.name}"</strong> possui <span className="font-black text-pm-dark bg-pm-light px-2 py-0.5 rounded">{fieldValues.filter(fv => fv.fieldId === deletingField.id).length} preenchimentos</span> históricos.
                        </p>

                        <div className="space-y-4">
                            <button onClick={() => confirmDelete(true)} className="w-full text-left p-6 rounded-3xl border-2 border-pm-primary/20 hover:border-pm-primary hover:bg-pm-primary/5 transition-all group relative overflow-hidden">
                                <p className="font-black text-pm-dark uppercase text-xs tracking-tight group-hover:text-pm-primary transition-colors">Ação Recomendada: Desativar Atributo</p>
                                <p className="text-[11px] text-pm-secondary/70 mt-2 leading-snug">Oculte o campo de novos relatórios, mas mantenha todos os dados históricos para auditoria e BI.</p>
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-10 group-hover:opacity-30 transition-all">
                                    <Archive className="w-10 h-10" />
                                </div>
                            </button>

                            <button onClick={() => confirmDelete(false)} className="w-full text-left p-6 rounded-3xl border-2 border-red-50 hover:border-red-500 hover:bg-red-50 transition-all group relative overflow-hidden">
                                <p className="font-black text-red-600 uppercase text-xs tracking-tight">Exclusão Destrutiva Crítica</p>
                                <p className="text-[11px] text-red-500/60 mt-2 leading-snug">Apaga o atributo e remove permanentemente todos os dados já registrados em cascata.</p>
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-10 group-hover:opacity-30 transition-all text-red-600">
                                    <Trash2 className="w-10 h-10" />
                                </div>
                            </button>
                        </div>

                        <div className="mt-8 pt-8 border-t border-pm-secondary/10 text-center">
                            <button 
                                onClick={() => setDeletingField(null)} 
                                className="px-8 py-3 text-[10px] font-black text-pm-secondary uppercase tracking-widest hover:text-pm-dark transition-colors"
                            >
                                Manter como está
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL EDITAR CONJUNTO DE DADOS */}
            {editingGroup && (
                <div className="fixed inset-0 bg-pm-dark/60 backdrop-blur-md z-[55] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-premium-2xl w-full max-w-sm p-8 border border-pm-secondary/10 animate-in fade-in zoom-in-95">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xl font-black text-pm-dark uppercase tracking-tight">Nomear Seção</h3>
                                <p className="text-[10px] font-bold text-pm-secondary/50 uppercase tracking-widest mt-1">Identificação do Conjunto</p>
                            </div>
                            <button onClick={() => setEditingGroup(null)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-pm-light text-pm-secondary transition-all">&times;</button>
                        </div>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="input-label">TÍTULO OFICIAL</label>
                                <input
                                    type="text"
                                    value={editGroupTitle}
                                    onChange={e => setEditGroupTitle(e.target.value)}
                                    className="input-field h-14"
                                    placeholder="Ex: Recursos Logísticos"
                                />
                            </div>
                            <div>
                                <label className="input-label">CATEGORIA DO RELATÓRIO</label>
                                <input
                                    list="edit-category-options"
                                    type="text"
                                    value={editGroupCategory}
                                    onChange={e => setEditGroupCategory(e.target.value)}
                                    className="input-field h-14"
                                    placeholder="Ex: Operacional, Administrativo..."
                                />
                                <datalist id="edit-category-options">
                                    {categoryOptions.map(category => (
                                        <option key={category} value={category} />
                                    ))}
                                </datalist>
                                <p className="text-[10px] text-pm-secondary/60 font-bold mt-2 uppercase tracking-wider">
                                    Seções com a mesma categoria aparecem juntas no relatório.
                                </p>
                            </div>
                        </div>

                        <div className="mt-10 flex flex-col gap-3">
                            <button onClick={saveGroupEdit} className="btn btn-primary h-14 w-full">
                                <Save className="w-5 h-5" /> Salvar Seção
                            </button>
                            <button 
                                onClick={() => setEditingGroup(null)} 
                                className="w-full h-12 font-black text-[10px] text-pm-secondary uppercase tracking-widest hover:bg-pm-light transition-all rounded-2xl"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DELETAR CONJUNTO DE DADOS CASCATA */}
            {deletingGroup && (
                <div className="fixed inset-0 bg-pm-dark/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 text-center">
                    <div className="bg-white rounded-[2.5rem] shadow-premium-2xl w-full max-w-md border border-red-500/20 animate-in fade-in zoom-in-95 overflow-hidden">
                        <div className="bg-gradient-to-br from-red-600 to-red-700 p-12 text-white">
                            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6 mx-auto animate-pulse">
                                <Trash2 className="w-10 h-10" />
                            </div>
                            <h3 className="text-2xl font-black uppercase tracking-tighter leading-tight">Eliminar Conjunto Inteiro?</h3>
                        </div>
                        
                        <div className="p-10">
                            <p className="text-sm text-center text-pm-secondary mb-8 leading-relaxed">
                                Você está removendo <strong>"{deletingGroup.title}"</strong>.
                                <br /><br />
                                <span className="font-black text-red-600 uppercase text-[10px] tracking-widest bg-red-50 p-5 rounded-[1.5rem] border border-red-100 block">
                                    Isso apagará permanentemente todos os dados vinculados em todas as Unidades sem possibilidade de recuperação.
                                </span>
                            </p>

                            <div className="flex flex-col gap-3">
                                <button onClick={() => {
                                    deleteDataGroup(deletingGroup.id);
                                    setDeletingGroup(null);
                                    if (selectedGroup === deletingGroup.id) setSelectedGroup(null);
                                }} className="w-full h-16 bg-red-600 text-white rounded-2xl hover:bg-red-700 font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-red-600/20 flex items-center justify-center gap-3">
                                    <Trash2 className="w-5 h-5" /> Confirmar Destruição
                                </button>
                                <button onClick={() => setDeletingGroup(null)} className="w-full h-14 bg-pm-light text-pm-secondary rounded-2xl hover:bg-pm-secondary/10 font-black text-[10px] uppercase tracking-widest transition-all">
                                    Abortar Operação
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
