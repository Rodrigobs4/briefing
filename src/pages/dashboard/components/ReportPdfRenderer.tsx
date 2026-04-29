import { useAuth, calculateFieldValue } from '../../../store/AuthContext';
import { useSettings } from '../../../store/SettingsContext';
import { getPublicUploadUrl } from '../../../utils/storageUrls';
import { type ReactNode, useMemo } from 'react';

interface ReportPdfRendererProps {
    selectedUnits: string[];
    selectedGroups: string[];
}

type TableRow = ReactNode[] | { type: 'section'; label: string };
type RawMetricRow = TableRow | { type: 'yearly'; label: string; valuesByYear: Record<string, ReactNode> };

// ==================================================================================
// COMPONENTES AUXILIARES PARA RELATÓRIO EXECUTIVO (COMPACTOS)
// ==================================================================================

const SectionHeader = ({ title }: { title: string }) => (
    <div className="report-section-header bg-slate-100 border-l-4 border-slate-900 px-3 py-2 mb-2">
        <h2 className="text-[12px] font-black text-slate-900 uppercase tracking-tight">{title}</h2>
    </div>
);

const SummaryCard = ({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'blue' | 'emerald' | 'amber' }) => {
    const toneClass = {
        slate: 'border-slate-300 bg-slate-50 text-slate-900',
        blue: 'border-blue-200 bg-blue-50 text-blue-900',
        emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
        amber: 'border-amber-200 bg-amber-50 text-amber-900'
    }[tone];

    return (
        <div className={`report-summary-card border rounded-lg p-4 ${toneClass}`}>
            <span className="block text-[10px] font-black uppercase tracking-wide opacity-70">{label}</span>
            <strong className="block text-3xl font-black leading-tight mt-1">{value}</strong>
        </div>
    );
};

const parseDisplayNumber = (value: ReactNode) => {
    if (typeof value !== 'string') return null;
    const numericValue = Number(value.replace(/\./g, '').replace(',', '.').replace('%', '').trim());
    return Number.isFinite(numericValue) ? numericValue : null;
};

const MetricValue = ({ value, label }: { value: ReactNode; label: ReactNode }) => {
    const numericValue = parseDisplayNumber(value);
    const isPercentage = typeof value === 'string' && value.includes('%');
    const toneClass = getValueToneClass(value, 1, label);
    const barWidth = numericValue === null ? 0 : Math.min(Math.abs(numericValue), 100);

    if (numericValue === null || value === '-') {
        return <span className="report-value-neutral">{value}</span>;
    }

    return (
        <span className={`report-value-pill ${toneClass}`}>
            <span className="report-value-number">{value}</span>
            {isPercentage && (
                <span className="report-value-bar" aria-hidden="true">
                    <span style={{ width: `${barWidth}%` }} />
                </span>
            )}
        </span>
    );
};

const getValueToneClass = (cell: ReactNode, columnIndex: number, rowLabel: ReactNode) => {
    if (columnIndex === 0 || typeof cell !== 'string') return 'text-slate-800';
    if (typeof rowLabel !== 'string') return 'text-slate-800';

    const label = rowLabel.toLowerCase();
    const shouldHighlightBalance = ['saldo', 'resultado', 'variação', 'variacao', 'diferença', 'diferenca', 'superávit', 'superavit', 'déficit', 'deficit']
        .some(term => label.includes(term));
    if (!shouldHighlightBalance) return 'text-slate-800';

    const normalized = cell
        .replace(/\./g, '')
        .replace(',', '.')
        .replace('%', '')
        .trim();
    const numericValue = Number(normalized);

    if (!Number.isFinite(numericValue) || numericValue === 0) return 'text-slate-800';
    return numericValue > 0 ? 'text-emerald-700' : 'text-red-700';
};

const isDateOrPeriodField = (fieldName: string) => {
    const normalized = fieldName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    return ['data', 'periodo', 'prazo', 'inicio', 'fim', 'vigencia', 'competencia', 'mes', 'ano']
        .some(term => normalized.includes(term));
};

const getYearMetricInfo = (fieldName: string) => {
    const yearMatch = fieldName.match(/\b(19|20)\d{2}\b/);
    if (!yearMatch) return null;

    const year = yearMatch[0];
    const baseName = fieldName
        .replace(new RegExp(`\\b${year}\\b`), '')
        .replace(/[()\-–—:|/]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return {
        year,
        baseName: baseName || fieldName
    };
};

const CompactTable = ({ headers, rows, colWidths, variant = 'default' }: { headers: string[]; rows: TableRow[]; colWidths?: string[]; variant?: 'default' | 'metrics' | 'collection' }) => (
    <div className="report-table mb-5 overflow-hidden border border-slate-300 rounded-lg">
        <table className={`w-full text-left border-collapse bg-white table-fixed report-table-${variant}`}>
            <thead>
                <tr className="bg-slate-900 text-white">
                    {headers.map((h, i) => (
                        <th 
                            key={i} 
                            style={colWidths ? { width: colWidths[i] } : {}}
                            className="px-3 py-2 text-[10px] font-black uppercase tracking-wide border-r border-white/10 last:border-0"
                        >
                            {h}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {rows.map((row, i) => {
                    if (!Array.isArray(row)) {
                        return (
                            <tr key={i} className="report-table-row report-group-row">
                                <td colSpan={headers.length} className="px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-900 bg-slate-200 border-t border-slate-300">
                                    {row.label}
                                </td>
                            </tr>
                        );
                    }

                    return (
                        <tr key={i} className="report-table-row hover:bg-slate-50 transition-colors">
                            {row.map((cell, j) => (
                                <td key={j} className={`px-3 py-2 text-[11px] font-bold border-r border-slate-100 last:border-0 ${j === 0 ? 'bg-slate-50/40 text-slate-900' : getValueToneClass(cell, j, row[0])}`}>
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    );
                })}
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
                            <img src={logoUrl} alt="Logo" className="w-14 h-14 object-contain" />
                        )}
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase leading-none mb-1">PMBA — COMANDO GERAL</span>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">Briefing Estratégico Diário</h1>
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-2">DCS / GABINETE DE GESTÃO</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="block text-xl font-black text-slate-900">{executiveSummary.date}</span>
                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">RELATÓRIO DE COMANDO</span>
                    </div>
                </div>

                <div className="mb-6">
                    <SectionHeader title="DADOS CONSOLIDADOS" />
                    <div className="grid grid-cols-3 gap-3 mb-3">
                        <SummaryCard label="Comandos" value={`${executiveSummary.unitsCount}`} tone="blue" />
                        <SummaryCard label="Registros" value={`${executiveSummary.totalRegistros}`} tone="emerald" />
                        <SummaryCard label="Ocorrências" value={`${executiveSummary.totalOcorrencias}`} tone="amber" />
                    </div>
                    <div className="report-emission-box">
                        <span>Documento gerado em</span>
                        <strong>{executiveSummary.date} às {executiveSummary.time}</strong>
                    </div>
                </div>

                <div>
                    <SectionHeader title="UNIDADES INCLUÍDAS NO BRIEFING" />
                    <div className="grid grid-cols-4 gap-1">
                        {unitsToRender.map(unit => (
                            <div key={unit.id} className="text-[10px] font-bold text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                                {unit.name}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] italic">
                    CONFIDENCIAL — USO EXCLUSIVO
                </div>
            </div>

            {/* PÁGINAS DE DETALHAMENTO TOTALMENTE EM TABELAS */}
            <div className="p-8 space-y-6">
                {unitsToRender.map((unit) => {
                    const groupsForUnit = dataGroups.filter(g => g.unitId === unit.id && selectedGroups.includes(g.id)).sort((a, b) => a.order - b.order);
                    if (groupsForUnit.length === 0) return null;

                    const unitEntries = entries.filter(e => e.unitId === unit.id);
                    const metricGroupsForUnit = groupsForUnit.filter(group => group.mode !== 'collection');
                    const collectionGroupsForUnit = groupsForUnit.filter(group => group.mode === 'collection');

                    const getVal = (field: any, snapshotValues: any[]) => {
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

                    const metricData = metricGroupsForUnit.reduce<{ years: string[]; rows: RawMetricRow[] }>((acc, group) => {
                        const groupFields = fields.filter(f => f.dataGroupId === group.id && f.isActive && f.type !== 'image').sort((a, b) => a.order - b.order);
                        if (groupFields.length === 0) return acc;

                        const groupEntry = unitEntries.find(e => e.dataGroupId === group.id);
                        const snapshotValues = groupEntry ? getValuesForEntry(groupEntry.id) : [];
                        const yearlyGroups = new Map<string, { label: string; valuesByYear: Record<string, ReactNode>; order: number }>();
                        const regularRows: { order: number; row: ReactNode[] }[] = [];

                        groupFields.forEach((field, index) => {
                            const value = getVal(field, snapshotValues);
                            const yearInfo = getYearMetricInfo(field.name);

                            if (!yearInfo) {
                                regularRows.push({ order: index, row: [field.name, value] });
                                return;
                            }

                            if (!acc.years.includes(yearInfo.year)) {
                                acc.years.push(yearInfo.year);
                            }

                            const current = yearlyGroups.get(yearInfo.baseName) ?? {
                                label: yearInfo.baseName,
                                valuesByYear: {},
                                order: index
                            };
                            current.valuesByYear[yearInfo.year] = value;
                            current.order = Math.min(current.order, index);
                            yearlyGroups.set(yearInfo.baseName, current);
                        });

                        const groupRows = [
                            ...regularRows,
                            ...Array.from(yearlyGroups.values()).map(item => ({
                                order: item.order,
                                row: { type: 'yearly', label: item.label, valuesByYear: item.valuesByYear } as RawMetricRow
                            }))
                        ].sort((a, b) => a.order - b.order);

                        if (groupRows.length === 0) return acc;

                        acc.rows.push(
                            { type: 'section', label: group.title },
                            ...groupRows.map(item => item.row)
                        );

                        return acc;
                    }, { years: [], rows: [] });

                    const metricYears = [...metricData.years].sort();
                    const metricHeaders = metricYears.length > 0
                        ? ['Indicador / Métrica', ...metricYears, 'Valor']
                        : ['Indicador / Métrica', 'Valor'];
                    const metricRows = metricYears.length > 0
                        ? metricData.rows.map<TableRow>(row => {
                            if (!Array.isArray(row)) {
                                if (row.type === 'yearly') {
                                    return [
                                        row.label,
                                        ...metricYears.map(year => <MetricValue key={`${row.label}-${year}`} value={row.valuesByYear[year] ?? '-'} label={row.label} />),
                                        '-'
                                    ];
                                }
                                return row;
                            }

                            return [row[0], ...metricYears.map(() => '-'), <MetricValue key={`${String(row[0])}-value`} value={row[1] ?? '-'} label={row[0]} />];
                        })
                        : metricData.rows
                            .filter((row): row is TableRow => Array.isArray(row) || row.type === 'section')
                            .map<TableRow>(row => Array.isArray(row) ? [row[0], <MetricValue key={`${String(row[0])}-value`} value={row[1] ?? '-'} label={row[0]} />] : row);
                    const metricColWidths = metricHeaders.map((_, index) => {
                        if (index === 0) return metricYears.length > 0 ? '30%' : '34%';
                        if (metricYears.length === 0) return '66%';
                        if (index === metricHeaders.length - 1) return '22%';
                        return `${Math.floor(48 / metricYears.length)}%`;
                    });

                    return (
                        <div key={unit.id} className="unit-section report-block mb-8 break-after-page-avoid">
                            <div className="flex justify-between items-end border-b-[2px] border-slate-900 pb-1 mb-4">
                                <h2 className="text-[15px] font-black text-slate-900 uppercase tracking-tight">
                                    {unit.name} <span className="text-slate-500 text-[11px] ml-1">— {unit.full_name || 'COMANDO GERAL'}</span>
                                </h2>
                                <span className="text-[10px] font-black text-slate-400 italic">PÁGINA DETALHADA</span>
                            </div>

                            <div className="space-y-4">
                                {metricRows.length > 0 && (
                                    <div className="report-block break-inside-avoid">
                                        <CompactTable
                                            headers={metricHeaders}
                                            rows={metricRows}
                                            colWidths={metricColWidths}
                                            variant="metrics"
                                        />
                                    </div>
                                )}

                                {collectionGroupsForUnit.map(group => {
                                        const unitCollections = collectionItems.filter(i => i.unitId === unit.id && i.dataGroupId === group.id && i.status !== 'archived');
                                        const itemsToRender = [...unitCollections].sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

                                        if (itemsToRender.length === 0) return null;

                                        return (
                                            <div key={group.id} className="report-block break-inside-avoid">
                                                <SectionHeader title={group.title} />
                                                <CompactTable 
                                                    headers={['Tópico / Ocorrência', 'Data / Período', 'Descrição Narrativa', 'Sinc.']}
                                                    rows={itemsToRender.map(item => {
                                                        const itemValues = getValuesForItem(item.id);
                                                        const textValues = itemValues.filter((fv: any) => fields.find(f => f.id === fv.fieldId)?.type === 'text');
                                                        const datePeriodValues = textValues.filter((fv: any) => {
                                                            const field = fields.find(f => f.id === fv.fieldId);
                                                            return field ? isDateOrPeriodField(field.name) : false;
                                                        });
                                                        const titleValues = textValues.filter((fv: any) => {
                                                            const field = fields.find(f => f.id === fv.fieldId);
                                                            return field ? !isDateOrPeriodField(field.name) : true;
                                                        });
                                                        const descFields = itemValues.filter((fv: any) => fields.find(f => f.id === fv.fieldId)?.type === 'textarea');
                                                        const datePeriodLabel = datePeriodValues
                                                            .map((fv: any) => {
                                                                const field = fields.find(f => f.id === fv.fieldId);
                                                                return field?.name ? `${field.name}: ${fv.valueText}` : fv.valueText;
                                                            })
                                                            .filter(Boolean)
                                                            .join(' | ');
                                                        return [
                                                            titleValues[0]?.valueText?.toUpperCase() || 'REGISTRO',
                                                            datePeriodLabel || '-',
                                                            descFields[0]?.valueText || 'Sem descrição.',
                                                            new Date(item.updatedAt).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})
                                                        ];
                                                    })}
                                                    colWidths={['20%', '22%', '48%', '10%']}
                                                    variant="collection"
                                                />
                                            </div>
                                        );
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
                    .break-inside-avoid,
                    .report-block,
                    .report-section-header,
                    .report-table,
                    .report-table-row {
                        break-inside: avoid;
                        page-break-inside: avoid;
                    }
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                    tr, td, th { page-break-inside: avoid; break-inside: avoid; }
                }

                .report-table-metrics th {
                    font-size: 12px;
                    padding-top: 10px;
                    padding-bottom: 10px;
                }

                .report-table-metrics td {
                    font-size: 12px;
                    vertical-align: top;
                }

                .report-table-metrics td:first-child {
                    width: 34%;
                    white-space: normal;
                }

                .report-table-metrics td:nth-child(2) {
                    font-size: 13px;
                    line-height: 1.4;
                }

                .report-table-metrics th:not(:first-child),
                .report-table-metrics td:not(:first-child) {
                    text-align: center;
                }

                .report-table-metrics td:last-child {
                    font-size: 13px;
                    line-height: 1.4;
                    color: #0f172a;
                }

                .report-table-collection td {
                    vertical-align: top;
                }

                .report-table-collection td:nth-child(2) {
                    font-size: 11.5px;
                    line-height: 1.35;
                    color: #334155;
                    background: #f8fafc;
                }

                .report-summary-card {
                    min-height: 86px;
                    break-inside: avoid;
                    page-break-inside: avoid;
                }

                .report-emission-box {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border: 1px solid #cbd5e1;
                    background: #f8fafc;
                    border-radius: 8px;
                    padding: 10px 12px;
                    color: #334155;
                    font-size: 11px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }

                .report-emission-box strong {
                    color: #0f172a;
                    font-size: 12px;
                }

                .report-value-pill {
                    display: inline-flex;
                    flex-direction: column;
                    align-items: stretch;
                    justify-content: center;
                    min-width: 72px;
                    max-width: 100%;
                    border: 1px solid #cbd5e1;
                    border-radius: 999px;
                    padding: 4px 9px;
                    background: #f8fafc;
                    color: #0f172a;
                    font-weight: 900;
                }

                .report-value-pill.text-emerald-700 {
                    border-color: #86efac;
                    background: #f0fdf4;
                    color: #047857;
                }

                .report-value-pill.text-red-700 {
                    border-color: #fecaca;
                    background: #fef2f2;
                    color: #b91c1c;
                }

                .report-value-number {
                    line-height: 1.1;
                }

                .report-value-bar {
                    display: block;
                    width: 100%;
                    height: 4px;
                    margin-top: 4px;
                    border-radius: 999px;
                    background: #e2e8f0;
                    overflow: hidden;
                }

                .report-value-bar span {
                    display: block;
                    height: 100%;
                    border-radius: inherit;
                    background: currentColor;
                }

                .report-value-neutral {
                    color: #334155;
                    font-weight: 800;
                }

                * {
                    font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
                    -webkit-font-smoothing: antialiased;
                }

                td {
                    line-height: 1.35;
                    word-break: break-word;
                }
            `}</style>
        </div>
    );
}
