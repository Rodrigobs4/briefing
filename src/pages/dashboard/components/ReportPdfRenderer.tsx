import { useAuth, calculateFieldValue } from '../../../store/AuthContext';
import { useSettings } from '../../../store/SettingsContext';
import { getPublicUploadUrl } from '../../../utils/storageUrls';
import { useMemo } from 'react';

interface ReportPdfRendererProps {
    selectedUnits: string[];
    selectedGroups: string[];
}

// ==================================================================================
// COMPONENTES AUXILIARES PARA RELATÓRIO EXECUTIVO (COMPACTOS)
// ==================================================================================

const SectionHeader = ({ title }: { title: string }) => (
    <div className="bg-slate-100 border-l-4 border-slate-900 px-2 py-1 mb-2">
        <h2 className="text-[9px] font-black text-slate-900 uppercase tracking-tight">{title}</h2>
    </div>
);

const CompactTable = ({ headers, rows, colWidths }: { headers: string[]; rows: (any)[][]; colWidths?: string[] }) => (
    <div className="mb-4 overflow-hidden border border-slate-200 rounded-lg">
        <table className="w-full text-left border-collapse bg-white table-fixed">
            <thead>
                <tr className="bg-slate-900 text-white">
                    {headers.map((h, i) => (
                        <th 
                            key={i} 
                            style={colWidths ? { width: colWidths[i] } : {}}
                            className="px-2 py-1 text-[7.5px] font-black uppercase tracking-widest border-r border-white/10 last:border-0"
                        >
                            {h}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                        {row.map((cell, j) => (
                            <td key={j} className={`px-2 py-1 text-[8.5px] font-bold text-slate-700 border-r border-slate-100 last:border-0 ${j === 0 ? 'bg-slate-50/20' : ''}`}>
                                {cell}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

// ==================================================================================
// RENDERIZADOR PRINCIPAL
// ==================================================================================

export default function ReportPdfRenderer({ selectedUnits, selectedGroups }: ReportPdfRendererProps) {
    const { units, dataGroups, fields, entries, getValuesForEntry, collectionItems, getValuesForItem } = useAuth();
    const { settings } = useSettings();

    const logoUrl = settings?.logo_path ? getPublicUploadUrl(settings.logo_path) : null;
    const unitsToRender = useMemo(() => units.filter(u => selectedUnits.includes(u.id)), [units, selectedUnits]);

    const executiveSummary = useMemo(() => {
        let totalRegistros = 0;
        let totalOcorrencias = 0;
        unitsToRender.forEach(unit => {
            totalRegistros += entries.filter(e => e.unitId === unit.id && selectedGroups.includes(e.dataGroupId)).length;
            totalOcorrencias += collectionItems.filter(i => i.unitId === unit.id && selectedGroups.includes(i.dataGroupId) && i.status !== 'archived').length;
        });
        return {
            date: new Date().toLocaleDateString('pt-BR'),
            time: new Date().toLocaleTimeString('pt-BR'),
            unitsCount: unitsToRender.length,
            totalRegistros,
            totalOcorrencias
        };
    }, [unitsToRender, entries, collectionItems, selectedGroups]);

    return (
        <div className="bg-white text-black font-sans w-full print:max-w-none">
            {/* PÁGINA 1: RESUMO EXECUTIVO COMPACTO */}
            <div className="p-8 flex flex-col page-break-after-always min-h-[250mm]">
                <div className="flex justify-between items-center border-b-2 border-slate-900 pb-2 mb-6">
                    <div className="flex items-center gap-4">
                        {logoUrl && (
                            <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain" />
                        )}
                        <div className="flex flex-col">
                            <span className="text-[7.5px] font-black tracking-widest text-slate-400 uppercase leading-none mb-1">PMBA — COMANDO GERAL</span>
                            <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase leading-none">Briefing Estratégico Diário</h1>
                            <p className="text-[7.5px] font-bold text-slate-500 uppercase tracking-widest mt-1">DCS / GABINETE DE GESTÃO</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="block text-base font-black text-slate-900">{executiveSummary.date}</span>
                        <span className="block text-[7.5px] font-bold text-slate-500 uppercase tracking-widest">RELATÓRIO DE COMANDO</span>
                    </div>
                </div>

                <div className="mb-6">
                    <SectionHeader title="DADOS CONSOLIDADOS" />
                    <CompactTable 
                        headers={['Item Estratégico', 'Valor']}
                        rows={[
                            ['Comandos Reportados', `${executiveSummary.unitsCount} unidades`],
                            ['Registros Operacionais', `${executiveSummary.totalRegistros} itens`],
                            ['Ocorrências Narradas', `${executiveSummary.totalOcorrencias} descrições`],
                            ['Data de Emissão', `${executiveSummary.date} — ${executiveSummary.time}`]
                        ]}
                        colWidths={['70%', '30%']}
                    />
                </div>

                <div>
                    <SectionHeader title="UNIDADES INCLUÍDAS NO BRIEFING" />
                    <div className="grid grid-cols-4 gap-1">
                        {unitsToRender.map(unit => (
                            <div key={unit.id} className="text-[8px] font-bold text-slate-600 bg-slate-50 p-1 rounded border border-slate-200">
                                {unit.name}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100 text-[8px] text-slate-400 font-bold uppercase tracking-[0.2em] italic">
                    CONFIDENCIAL — USO EXCLUSIVO
                </div>
            </div>

            {/* PÁGINAS DE DETALHAMENTO TOTALMENTE EM TABELAS */}
            <div className="p-8 space-y-6">
                {unitsToRender.map((unit) => {
                    const groupsForUnit = dataGroups.filter(g => g.unitId === unit.id && selectedGroups.includes(g.id)).sort((a, b) => a.order - b.order);
                    if (groupsForUnit.length === 0) return null;

                    const unitEntries = entries.filter(e => e.unitId === unit.id);

                    return (
                        <div key={unit.id} className="unit-section mb-6 break-after-page-avoid">
                            <div className="flex justify-between items-end border-b-[2px] border-slate-900 pb-1 mb-4">
                                <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-tighter">
                                    {unit.name} <span className="text-slate-400 text-[8px] ml-1">— {unit.full_name || 'COMANDO GERAL'}</span>
                                </h2>
                                <span className="text-[7.5px] font-black text-slate-300 italic">PÁGINA DETALHADA</span>
                            </div>

                            <div className="space-y-4">
                                {groupsForUnit.map(group => {
                                    if (group.mode === 'collection') {
                                        const unitCollections = collectionItems.filter(i => i.unitId === unit.id && i.dataGroupId === group.id && i.status !== 'archived');
                                        const itemsToRender = [...unitCollections].sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

                                        if (itemsToRender.length === 0) return null;

                                        return (
                                            <div key={group.id} className="break-inside-avoid">
                                                <SectionHeader title={group.title} />
                                                <CompactTable 
                                                    headers={['Tópico / Ocorrência', 'Descrição Narrativa', 'Sinc.']}
                                                    rows={itemsToRender.map(item => {
                                                        const itemValues = getValuesForItem(item.id);
                                                        const txtFields = itemValues.filter((fv: any) => fields.find(f => f.id === fv.fieldId)?.type === 'text');
                                                        const descFields = itemValues.filter((fv: any) => fields.find(f => f.id === fv.fieldId)?.type === 'textarea');
                                                        return [
                                                            txtFields[0]?.valueText?.toUpperCase() || 'REGISTRO',
                                                            descFields[0]?.valueText || 'Sem descrição.',
                                                            new Date(item.updatedAt).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})
                                                        ];
                                                    })}
                                                    colWidths={['20%', '70%', '10%']}
                                                />
                                            </div>
                                        );
                                    } else {
                                        const groupFields = fields.filter(f => f.dataGroupId === group.id && f.isActive).sort((a, b) => a.order - b.order);
                                        if (groupFields.length === 0) return null;

                                        const groupEntry = unitEntries.find(e => e.dataGroupId === group.id);
                                        const snapshotValues = groupEntry ? getValuesForEntry(groupEntry.id) : [];

                                        const getVal = (field: any) => {
                                            const fv = snapshotValues.find(v => v.fieldId === field.id);
                                            let val = fv ? fv.value : null;
                                            if ((val === null || val === undefined || val === '') && field.type === 'calculated') {
                                                const allValues = snapshotValues.reduce((acc, curr) => {
                                                    acc[curr.fieldId] = curr.value;
                                                    return acc;
                                                }, {} as Record<string, any>);
                                                const calculated = calculateFieldValue(field, allValues, fields);
                                                if (calculated !== null) val = calculated;
                                            }
                                            if (val === null || val === undefined || val === '') return '-';
                                            if (field.type === 'percentage') return `${Number(val).toLocaleString('pt-BR')}%`;
                                            if (field.type === 'number' || field.type === 'calculated') return Number(val).toLocaleString('pt-BR');
                                            return val;
                                        };

                                        return (
                                            <div key={group.id} className="break-inside-avoid">
                                                <SectionHeader title={group.title} />
                                                <CompactTable 
                                                    headers={['Indicador / Métrica', 'Valor']}
                                                    rows={groupFields.filter(f => f.type !== 'image').map(f => [f.name, getVal(f)])}
                                                    colWidths={['80%', '20%']}
                                                />
                                            </div>
                                        );
                                    }
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            <style>{`
                @media print {
                    @page { 
                        size: A4 portrait; 
                        margin: 10mm; 
                    }
                    body { 
                        background: white !important;
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important; 
                    }
                    .page-break-after-always { page-break-after: always; break-after: page; }
                    .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
                }

                * {
                    font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
                    -webkit-font-smoothing: antialiased;
                }

                td {
                    line-height: 1.25;
                    word-break: break-word;
                }
            `}</style>
        </div>
    );
}
