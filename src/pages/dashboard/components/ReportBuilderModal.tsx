import { useState, useRef } from 'react';
import { useAuth } from '../../../store/AuthContext';
import { X, CheckSquare, Square, Printer, Filter, ChevronDown, ChevronRight } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import ReportPdfRenderer from './ReportPdfRenderer';

export default function ReportBuilderModal({ onClose }: { onClose: () => void }) {
    const { units: allUnits, dataGroups, user } = useAuth();
    const units = user?.role === 'editor' && user.unitId ? allUnits.filter(u => u.id === user.unitId) : allUnits;

    const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [expandedUnits, setExpandedUnits] = useState<string[]>([]);

    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Relatório Executivo PMBA - ${new Date().toISOString().split('T')[0]}`
    });

    const toggleUnit = (unitId: string) => {
        if (selectedUnits.includes(unitId)) {
            setSelectedUnits(prev => prev.filter(id => id !== unitId));
            // Desmarcar todos os grupos atrelados
            const unitGroups = dataGroups.filter(g => g.unitId === unitId).map(g => g.id);
            setSelectedGroups(prev => prev.filter(id => !unitGroups.includes(id)));
        } else {
            setSelectedUnits(prev => [...prev, unitId]);
            // Marcar todos os grupos dessa unidade por padrão
            const unitGroups = dataGroups.filter(g => g.unitId === unitId).map(g => g.id);
            setSelectedGroups(prev => [...prev, ...unitGroups]);
        }
    };

    const toggleGroup = (groupId: string, unitId: string) => {
        if (selectedGroups.includes(groupId)) {
            setSelectedGroups(prev => prev.filter(id => id !== groupId));
            // Se nenhum grupo sobrar, talvez desmarcar a unidade? Vamos manter simples: não fazemos auto-desmarque da unidade aqui.
        } else {
            setSelectedGroups(prev => [...prev, groupId]);
            // Marcar unidade automaticamente se não estiver
            if (!selectedUnits.includes(unitId)) {
                setSelectedUnits(prev => [...prev, unitId]);
            }
        }
    };

    const toggleExpandUnit = (unitId: string) => {
        setExpandedUnits(prev =>
            prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]
        );
    };

    const handleSelectAll = () => {
        setSelectedUnits(units.map(u => u.id));
        setSelectedGroups(dataGroups.map(g => g.id));
        setExpandedUnits(units.map(u => u.id));
    };

    const handleClearAll = () => {
        setSelectedUnits([]);
        setSelectedGroups([]);
    };

    // Tem dados para imprimir?
    const isPrintable = selectedUnits.length > 0 && selectedGroups.length > 0;

    return (
        <div className="fixed inset-0 bg-pm-dark/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl px-6 py-8 border border-pm-secondary/20 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-6 shrink-0 border-b border-pm-secondary/20 pb-4">
                    <div>
                        <h2 className="text-xl font-bold text-pm-dark flex items-center gap-2">
                            <Filter className="w-5 h-5 text-pm-primary" />
                            Construtor de Relatório PDF
                        </h2>
                        <p className="text-sm text-pm-secondary mt-1">
                            Selecione os Tópicos e seus Conjuntos de Dados a serem incluídos no documento.
                        </p>
                    </div>
                    <button onClick={onClose} className="text-pm-secondary hover:text-pm-dark p-2 hover:bg-pm-light rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Conteúdo Rolável do Checklist */}
                <div className="overflow-y-auto flex-1 custom-scrollbar pr-2 space-y-4">
                    <div className="flex gap-3 mb-4">
                        <button onClick={handleSelectAll} className="px-3 py-1.5 text-xs font-semibold bg-pm-light text-pm-dark hover:bg-pm-primary/20 rounded transition-colors flex items-center gap-1.5 border border-pm-secondary/20">
                            <CheckSquare className="w-3.5 h-3.5" /> Selecionar Tudo
                        </button>
                        <button onClick={handleClearAll} className="px-3 py-1.5 text-xs font-semibold bg-pm-light text-pm-dark hover:bg-pm-secondary/20 rounded transition-colors flex items-center gap-1.5 border border-pm-secondary/20">
                            <Square className="w-3.5 h-3.5" /> Limpar Seleção
                        </button>
                    </div>

                    {units.length === 0 && (
                        <p className="text-sm text-pm-secondary text-center py-8">Nenhum Tópico cadastrado.</p>
                    )}

                    {units.map(unit => {
                        const unitGroups = dataGroups.filter(g => g.unitId === unit.id);
                        const isUnitSelected = selectedUnits.includes(unit.id);
                        const isExpanded = expandedUnits.includes(unit.id);

                        return (
                            <div key={unit.id} className="border border-pm-secondary/20 rounded-lg overflow-hidden transition-all bg-white mb-3">
                                <div className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${isUnitSelected ? 'bg-pm-primary/10 border-b border-pm-primary/20' : 'hover:bg-pm-light'}`}>
                                    <div className="flex items-center gap-3" onClick={() => toggleUnit(unit.id)}>
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isUnitSelected ? 'bg-pm-primary border-pm-primary text-white' : 'border-pm-secondary/40 bg-white'}`}>
                                            {isUnitSelected && <CheckSquare className="w-3.5 h-3.5" />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-pm-dark leading-tight">{unit.name}</p>
                                            <p className="text-[10px] text-pm-secondary uppercase tracking-wider mt-0.5">{unitGroups.length} Conjuntos de Dados</p>
                                        </div>
                                    </div>
                                    <button
                                        className="p-1.5 text-pm-secondary hover:text-pm-primary rounded-full hover:bg-white/50 transition-colors"
                                        onClick={() => toggleExpandUnit(unit.id)}
                                    >
                                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </button>
                                </div>

                                {isExpanded && (
                                    <div className="bg-pm-light/30 p-3 space-y-2 border-t border-pm-secondary/10">
                                        {unitGroups.length === 0 ? (
                                            <p className="text-xs text-pm-secondary italic text-center py-2">Este tópico ainda não possui conjuntos de dados.</p>
                                        ) : (
                                            unitGroups.map(group => {
                                                const isGroupSelected = selectedGroups.includes(group.id);
                                                return (
                                                    <div
                                                        key={group.id}
                                                        onClick={() => toggleGroup(group.id, unit.id)}
                                                        className="flex items-center gap-3 px-3 py-2 bg-white rounded border border-pm-secondary/10 cursor-pointer hover:border-pm-primary/30 transition-colors"
                                                    >
                                                        <div className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors ${isGroupSelected ? 'bg-pm-primary border-pm-primary text-white' : 'border-pm-secondary/40 bg-white'}`}>
                                                            {isGroupSelected && <CheckSquare className="w-3 h-3" />}
                                                        </div>
                                                        <span className="text-sm font-medium text-pm-dark">{group.title}</span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="mt-6 pt-4 border-t border-pm-secondary/20 flex items-center justify-between shrink-0">
                    <p className="text-xs text-pm-secondary">
                        <span className="font-bold text-pm-dark">{selectedUnits.length}</span> Tópicos e <span className="font-bold text-pm-dark">{selectedGroups.length}</span> Conjuntos selecionados.
                    </p>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-pm-secondary hover:bg-pm-light rounded-lg transition-colors border border-transparent hover:border-pm-secondary/20">
                            Cancelar
                        </button>
                        <button
                            onClick={() => handlePrint()}
                            disabled={!isPrintable}
                            className="px-6 py-2.5 text-sm font-semibold bg-pm-primary text-pm-light rounded-lg hover:bg-pm-primary/90 transition-all shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Printer className="w-4 h-4" />
                            Gerar PDF
                        </button>
                    </div>
                </div>
            </div>

            {/* Renderer Invisível do PDF */}
            <div style={{ display: 'none' }}>
                <div ref={printRef}>
                    <ReportPdfRenderer
                        selectedUnits={selectedUnits}
                        selectedGroups={selectedGroups}
                    />
                </div>
            </div>
        </div>
    );
}
