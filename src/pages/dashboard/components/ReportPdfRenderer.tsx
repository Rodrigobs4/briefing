import { useAuth, calculateFieldValue } from '../../../store/AuthContext';
import { useSettings } from '../../../store/SettingsContext';
import { formatBrazilianNumber } from '../../../utils/brazilianNumbers';
import { getPublicUploadUrl } from '../../../utils/storageUrls';
import { Building2, CalendarDays, ClipboardList, Clock, Layers3, MapPinned, MessageSquareText } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';

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

interface ReportPdfRendererProps {
    selectedUnits: string[];
    selectedGroups: string[];
    reportCategoryConfig?: {
        groupAssignments: Record<string, string>;
        categoryOrder: string[];
        unitOrder?: string[];
        groupOrder?: string[];
        fieldOrder?: Record<string, string[]>;
        tableHighlights?: ReportTableHighlightRule[];
    };
    reportSectionsConfig?: {
        showExecutiveSummary?: boolean;
        showSubjectMap?: boolean;
    };
    fontSize?: 'standard' | 'large';
}

type TableRow = ReactNode[] | { type: 'section'; label: string; groupId?: string };
type RawMetricRow = TableRow | { type: 'yearly'; label: string; valuesByYear: Record<string, ReactNode>; showTotal: boolean; isCurrency: boolean; periodType?: 'yearly' | 'monthly' };
type IconStatCardProps = {
    icon: ReactNode;
    label: string;
    value: string;
    description: string;
    tone?: 'khaki' | 'emerald' | 'amber' | 'slate';
};

const FIRST_REPORT_YEAR = 2023;
const CURRENT_REPORT_YEAR = Math.max(FIRST_REPORT_YEAR, new Date().getFullYear());
const REPORT_YEARS = Array.from({ length: CURRENT_REPORT_YEAR - FIRST_REPORT_YEAR + 1 }, (_, index) => String(FIRST_REPORT_YEAR + index));
const formatMonthlyPeriod = (period: string) => {
    const [year, month] = period.split('-').map(Number);
    return new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');
};

// ==================================================================================
// COMPONENTES AUXILIARES PARA RELATÓRIO EXECUTIVO (COMPACTOS)
// ==================================================================================

const SectionHeader = ({ title }: { title: string }) => (
    <div className="report-section-header bg-slate-100 border-l-4 border-slate-900 px-3 py-2 mb-2">
        <h2 className="text-[12px] font-black text-slate-900 uppercase tracking-tight">{title}</h2>
    </div>
);

const TextSection = ({ title, values }: { title: string; values: ReactNode[] }) => (
    <div className="report-text-panel break-inside-avoid">
        <SectionHeader title={title} />
        <div className="report-text-content">
            {values.length > 0
                ? values.map((value, index) => <p key={index}>{value}</p>)
                : <p className="report-text-empty">Sem observações registradas.</p>}
        </div>
    </div>
);

const IconStatCard = ({ icon, label, value, description, tone = 'slate' }: IconStatCardProps) => (
    <div className={`executive-stat-card executive-stat-card-${tone}`}>
        <div className="executive-stat-icon">{icon}</div>
        <div>
            <span>{label}</span>
            <strong>{value}</strong>
            <p>{description}</p>
        </div>
    </div>
);

const parseDisplayNumber = (value: ReactNode) => {
    if (typeof value !== 'string') return null;
    if (value.includes('%')) return null;
    const numericValue = Number(value.replace(/R\$/gi, '').replace(/\./g, '').replace(',', '.').replace('%', '').trim());
    return Number.isFinite(numericValue) ? numericValue : null;
};

const formatDisplayNumber = (value: number) => value.toLocaleString('pt-BR');

const getMetricTotal = (valuesByYear: Record<string, ReactNode>, years: string[], isCurrency = false) => {
    const values = years.map(year => valuesByYear[year]).filter(value => value !== undefined && value !== null && value !== '-');
    if (values.length === 0) return '-';

    const numericValues = values.map(parseDisplayNumber);
    if (numericValues.length > 1 && numericValues.every(value => value !== null)) {
        const total = numericValues.reduce((sum, value) => sum + (value ?? 0), 0);
        return isCurrency ? formatBrazilianNumber(total, true) : formatDisplayNumber(total);
    }

    return values[0];
};

const MetricValue = ({ value, label }: { value: ReactNode; label: ReactNode }) => {
    const numericValue = parseDisplayNumber(value);
    const isCurrency = typeof value === 'string' && value.includes('R$');
    const valueLength = typeof value === 'string' ? value.replace(/\s/g, '').length : 0;
    const compactSizeClass = valueLength >= (isCurrency ? 17 : 20)
        ? 'report-metric-value-xlong'
        : valueLength >= (isCurrency ? 13 : 16)
            ? 'report-metric-value-long'
            : '';
    const toneClass = getValueToneClass(value, 1, label);

    if (numericValue === null || value === '-') {
        return <span className="report-value-neutral">{value}</span>;
    }

    return (
        <span className={`report-metric-value ${isCurrency ? 'report-metric-value-currency' : ''} ${compactSizeClass} ${toneClass}`}>
            {value}
        </span>
    );
};

const getValueToneClass = (cell: ReactNode, columnIndex: number, rowLabel: ReactNode) => {
    if (columnIndex === 0 || typeof cell !== 'string') return 'text-slate-800';
    if (typeof rowLabel !== 'string') return 'text-slate-800';

    const label = rowLabel.toLowerCase();
    const deficitMetric = ['déficit', 'deficit'].some(term => label.includes(term));
    const shouldHighlightBalance = ['saldo', 'resultado', 'variação', 'variacao', 'diferença', 'diferenca', 'superávit', 'superavit', 'déficit', 'deficit']
        .some(term => label.includes(term));
    if (!shouldHighlightBalance) return 'text-slate-800';

    const normalized = cell
        .replace(/R\$/gi, '')
        .replace(/\./g, '')
        .replace(',', '.')
        .replace('%', '')
        .trim();
    const numericValue = Number(normalized);

    if (!Number.isFinite(numericValue) || numericValue === 0) return 'text-slate-800';
    if (deficitMetric) return numericValue > 0 ? 'text-red-700' : 'text-emerald-700';
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
    const baseName = normalizeMetricBaseName(fieldName, year);

    return {
        year,
        baseName
    };
};

const normalizeMetricBaseName = (value: string, yearToRemove?: string) => {
    const withoutYear = yearToRemove
        ? value.replace(new RegExp(`\\b${yearToRemove}\\b`, 'g'), '')
        : value.replace(/\b(19|20)\d{2}\b/g, '');

    return withoutYear
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\b(ano|periodo|periodo de|competencia|exercicio|referente|ref)\b/gi, ' ')
        .replace(/[()\-–—:|/]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const getMetricGroupKey = (value: string) => normalizeMetricBaseName(value).toLowerCase();

const getMetricLabelWithoutYear = (fieldName: string, fallback = 'Total') => {
    const normalized = normalizeMetricBaseName(fieldName);
    return normalized || fallback;
};

const getYearFromText = (value: string) => value.match(/\b(19|20)\d{2}\b/)?.[0] ?? null;

const formatCollectionValue = (field: any, value: any) => {
    if (!value) return null;

    if (field?.type === 'number' || field?.type === 'calculated') {
        return value.valueNumber !== null && value.valueNumber !== undefined ? Number(value.valueNumber).toLocaleString('pt-BR') : null;
    }
    if (field?.type === 'currency') {
        return value.valueNumber !== null && value.valueNumber !== undefined ? formatBrazilianNumber(Number(value.valueNumber), true) : null;
    }
    if (field?.type === 'percentage') {
        return value.valueNumber !== null && value.valueNumber !== undefined ? `${Number(value.valueNumber).toLocaleString('pt-BR')}%` : null;
    }
    if (field?.type === 'image') {
        const total = Array.isArray(value.valueJson) ? value.valueJson.length : 0;
        return total > 0 ? `${total} anexo(s)` : null;
    }

    return value.valueText || null;
};

const getCollectionColumnWidths = (collectionFields: any[]) => {
    if (collectionFields.length === 0) return [];

    const weights = collectionFields.map(field => {
        if (field.type === 'currency') return 1.35;
        if (['number', 'percentage', 'calculated'].includes(field.type)) return 0.85;
        if (field.type === 'textarea') return 2.6;
        if (isDateOrPeriodField(field.name)) return 1;
        return 1.8;
    });
    const totalWeight = weights.reduce((total, weight) => total + weight, 0);

    return weights.map(weight => `${((weight / totalWeight) * 100).toFixed(2)}%`);
};

const HIGHLIGHT_CLASS_BY_COLOR: Record<ReportHighlightColor, string> = {
    khaki: 'report-highlight-khaki',
    blue: 'report-highlight-blue',
    green: 'report-highlight-green',
    amber: 'report-highlight-amber',
    red: 'report-highlight-red'
};

const getCellHighlightClass = (highlightRules: ReportTableHighlightRule[], rowIndex: number, columnIndex: number) => {
    const reversedRules = [...highlightRules].reverse();
    const rule = reversedRules.find(item => item.target === 'cell' && item.rowIndex === rowIndex && item.columnIndex === columnIndex)
        ?? reversedRules.find(item => item.target === 'row' && item.rowIndex === rowIndex)
        ?? reversedRules.find(item => item.target === 'column' && item.columnIndex === columnIndex);

    return rule ? HIGHLIGHT_CLASS_BY_COLOR[rule.color] : '';
};

const getColumnHighlightClass = (highlightRules: ReportTableHighlightRule[], columnIndex: number) => {
    const rule = [...highlightRules].reverse().find(item => item.target === 'column' && item.columnIndex === columnIndex);
    return rule ? HIGHLIGHT_CLASS_BY_COLOR[rule.color] : '';
};

const CompactTable = ({
    headers,
    rows,
    colWidths,
    variant = 'default',
    highlightRules = [],
    financial = false,
    narrative = false
}: {
    headers: string[];
    rows: TableRow[];
    colWidths?: string[];
    variant?: 'default' | 'metrics';
    highlightRules?: ReportTableHighlightRule[];
    financial?: boolean;
    narrative?: boolean;
}) => (
    <div className="report-table report-table-keep-together mb-5 overflow-hidden border border-slate-300 rounded-lg">
        <table className={`w-full text-left border-collapse bg-white table-fixed report-table-${variant} ${financial ? 'report-table-financial' : ''} ${narrative ? 'report-table-narrative' : ''}`}>
            <thead>
                <tr className="bg-slate-900 text-white">
                    {headers.map((h, i) => (
                        <th 
                            key={i} 
                            style={colWidths ? { width: colWidths[i] } : {}}
                            className={`px-3 py-2 text-[10px] font-black uppercase tracking-wide border-r border-white/10 last:border-0 ${getColumnHighlightClass(highlightRules, i)}`}
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

                    const dataRowIndex = rows.slice(0, i).filter(previousRow => Array.isArray(previousRow)).length;
                    return (
                        <tr key={i} className="report-table-row hover:bg-slate-50 transition-colors">
                            {row.map((cell, j) => (
                                <td key={j} className={`px-3 py-2 text-[11px] font-bold border-r border-slate-100 last:border-0 ${j === 0 ? 'bg-slate-50/40 text-slate-900' : getValueToneClass(cell, j, row[0])} ${getCellHighlightClass(highlightRules, dataRowIndex, j)}`}>
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

export default function ReportPdfRenderer({ selectedUnits, selectedGroups, reportCategoryConfig, reportSectionsConfig, fontSize = 'standard' }: ReportPdfRendererProps) {
    const { units, dataGroups, fields, entries, getValuesForEntry, collectionItems, getValuesForItem, users } = useAuth();
    const { settings } = useSettings();
    const showExecutiveSummary = reportSectionsConfig?.showExecutiveSummary ?? true;
    const showSubjectMap = reportSectionsConfig?.showSubjectMap ?? true;
    const showCoverPage = showExecutiveSummary || showSubjectMap;

    const logoUrl = settings?.logo_path ? getPublicUploadUrl(settings.logo_path) : null;
    const unitsToRender = useMemo(() => {
        const unitOrder = reportCategoryConfig?.unitOrder ?? [];
        const getUnitOrder = (unitId: string) => {
            const configuredIndex = unitOrder.indexOf(unitId);
            return configuredIndex >= 0 ? configuredIndex : 9999;
        };

        return units
            .filter(unit => selectedUnits.includes(unit.id))
            .sort((a, b) => getUnitOrder(a.id) - getUnitOrder(b.id) || (a.order_index ?? 999) - (b.order_index ?? 999));
    }, [reportCategoryConfig?.unitOrder, selectedUnits, units]);
    const getRuntimeCategoryLabel = (group: { id: string; unitId: string; categoryTitle?: string | null }) => {
        const unit = units.find(item => item.id === group.unitId);
        return reportCategoryConfig?.groupAssignments[unit?.id || '']?.trim()
            || unit?.reportCategoryTitle?.trim()
            || group.categoryTitle?.trim()
            || 'Geral';
    };
    const getRuntimeCategoryFallbackOrder = (group: { unitId: string; categoryOrder?: number }) => (
        units.find(unit => unit.id === group.unitId)?.reportCategoryOrder ?? group.categoryOrder ?? 999
    );
    const getRuntimeCategoryOrder = (category: string, fallback = 999) => {
        const configuredIndex = reportCategoryConfig?.categoryOrder.findIndex(item => item === category) ?? -1;
        return configuredIndex >= 0 ? configuredIndex + 1 : fallback;
    };
    const getRuntimeGroupOrder = (groupId: string, fallback = 9999) => {
        const configuredIndex = reportCategoryConfig?.groupOrder?.findIndex(item => item === groupId) ?? -1;
        return configuredIndex >= 0 ? configuredIndex + 1 : fallback;
    };
    const getSortedFields = (groupId: string) => {
        const configuredOrder = reportCategoryConfig?.fieldOrder?.[groupId] ?? [];
        const getRuntimeFieldOrder = (fieldId: string, fallback: number) => {
            const configuredIndex = configuredOrder.indexOf(fieldId);
            return configuredIndex >= 0 ? configuredIndex : 9999 + fallback;
        };

        return fields
            .filter(field => field.dataGroupId === groupId && field.isActive && field.type !== 'image')
            .sort((a, b) => getRuntimeFieldOrder(a.id, a.order) - getRuntimeFieldOrder(b.id, b.order));
    };
    const getSortedGroups = (groups: typeof dataGroups) => [...groups]
        .sort((a, b) => getRuntimeCategoryOrder(getRuntimeCategoryLabel(a), getRuntimeCategoryFallbackOrder(a)) - getRuntimeCategoryOrder(getRuntimeCategoryLabel(b), getRuntimeCategoryFallbackOrder(b)) || getRuntimeGroupOrder(a.id, a.order) - getRuntimeGroupOrder(b.id, b.order) || a.order - b.order);
    const selectedDataGroups = getSortedGroups(dataGroups.filter(group => selectedGroups.includes(group.id)));
    const reportCategories = Array.from(new Set(selectedDataGroups.map(getRuntimeCategoryLabel)))
        .sort((a, b) => getRuntimeCategoryOrder(a) - getRuntimeCategoryOrder(b));
    const executiveSummary = useMemo(() => {
        let totalRegistros = 0;
        let totalOcorrencias = 0;
        const selectedUpdates = [
            ...entries
                .filter(entry => selectedUnits.includes(entry.unitId) && selectedGroups.includes(entry.dataGroupId))
                .map(entry => ({ updatedAt: entry.updatedAt, updatedBy: entry.updatedBy })),
            ...collectionItems
                .filter(item => selectedUnits.includes(item.unitId) && selectedGroups.includes(item.dataGroupId) && item.status !== 'archived')
                .map(item => ({ updatedAt: item.updatedAt, updatedBy: item.updatedBy }))
        ].filter(item => item.updatedAt);
        const latestUpdate = selectedUpdates
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
        const latestUpdateDate = latestUpdate ? new Date(latestUpdate.updatedAt) : null;
        const latestUpdateUser = latestUpdate?.updatedBy
            ? users.find(item => item.id === latestUpdate.updatedBy)?.name || null
            : null;
        unitsToRender.forEach(unit => {
            const unitRegistros = entries.filter(e => e.unitId === unit.id && selectedGroups.includes(e.dataGroupId)).length;
            const unitOcorrencias = collectionItems.filter(i => i.unitId === unit.id && selectedGroups.includes(i.dataGroupId) && i.status !== 'archived').length;
            totalRegistros += unitRegistros;
            totalOcorrencias += unitOcorrencias;
        });

        return {
            date: new Date().toLocaleDateString('pt-BR'),
            time: new Date().toLocaleTimeString('pt-BR'),
            unitsCount: unitsToRender.length,
            groupsCount: dataGroups.filter(group => selectedGroups.includes(group.id)).length,
            totalRegistros,
            totalOcorrencias,
            lastUpdate: latestUpdateDate ? {
                date: latestUpdateDate.toLocaleDateString('pt-BR'),
                time: latestUpdateDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                author: latestUpdateUser || 'Responsável não identificado'
            } : null
        };
    }, [unitsToRender, entries, collectionItems, dataGroups, selectedGroups, selectedUnits, users]);

    return (
        <div className={`report-pdf-root bg-white text-black font-sans w-full print:max-w-none ${fontSize === 'large' ? 'report-font-large' : ''}`}>
            {/* PÁGINA 1: RESUMO EXECUTIVO COMPACTO */}
            {showCoverPage && <div className="p-8 flex flex-col page-break-after-always min-h-[250mm]">
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

                {showExecutiveSummary && <div className="mb-5">
                    <SectionHeader title="RESUMO EXECUTIVO" />
                    <div className="executive-stat-grid">
                        <IconStatCard
                            icon={<Building2 className="w-5 h-5" />}
                            label="Unidades"
                            value={`${executiveSummary.unitsCount}`}
                            description="Comandos incluídos no briefing"
                            tone="khaki"
                        />
                        <IconStatCard
                            icon={<Layers3 className="w-5 h-5" />}
                            label="Assuntos"
                            value={`${executiveSummary.groupsCount}`}
                            description="Grupos de informação selecionados"
                            tone="slate"
                        />
                        <IconStatCard
                            icon={<ClipboardList className="w-5 h-5" />}
                            label="Indicadores"
                            value={`${executiveSummary.totalRegistros}`}
                            description="Bases operacionais preenchidas"
                            tone="emerald"
                        />
                        <IconStatCard
                            icon={<MessageSquareText className="w-5 h-5" />}
                            label="Narrativas"
                            value={`${executiveSummary.totalOcorrencias}`}
                            description="Ocorrências e relatos publicados"
                            tone="amber"
                        />
                    </div>
                </div>}

                {showSubjectMap && <div className="mb-5">
                    <SectionHeader title="MAPA DE ASSUNTOS" />
                    <div className="report-reading-map">
                        {unitsToRender.map(unit => {
                            const unitGroups = selectedDataGroups.filter(group => group.unitId === unit.id);
                            const categoryNames = Array.from(new Set(unitGroups.map(getRuntimeCategoryLabel)));

                            return (
                                <div key={unit.id} className="report-reading-item">
                                    <strong><MapPinned className="w-3.5 h-3.5" /> {unit.name}</strong>
                                    <span>{categoryNames.join(' • ') || 'Sem categoria selecionada'}</span>
                                    {unit.responsibleSector && <em>Setor responsável: {unit.responsibleSector}</em>}
                                </div>
                            );
                        })}
                    </div>
                    <div className="report-emission-box">
                        <span><CalendarDays className="w-3.5 h-3.5" /> Documento gerado em</span>
                        <strong>{executiveSummary.date} às {executiveSummary.time}</strong>
                    </div>
                    <div className="report-emission-box report-last-update-box">
                        <span><Clock className="w-3.5 h-3.5" /> Última atualização</span>
                        <strong>
                            {executiveSummary.lastUpdate
                                ? `${executiveSummary.lastUpdate.date} às ${executiveSummary.lastUpdate.time} - ${executiveSummary.lastUpdate.author}`
                            : 'Sem atualização registrada'}
                        </strong>
                    </div>
                </div>}

                {!showSubjectMap && (
                    <div className="mb-5">
                        <div className="report-emission-box">
                            <span><CalendarDays className="w-3.5 h-3.5" /> Documento gerado em</span>
                            <strong>{executiveSummary.date} às {executiveSummary.time}</strong>
                        </div>
                        <div className="report-emission-box report-last-update-box">
                            <span><Clock className="w-3.5 h-3.5" /> Última atualização</span>
                            <strong>
                                {executiveSummary.lastUpdate
                                    ? `${executiveSummary.lastUpdate.date} às ${executiveSummary.lastUpdate.time} - ${executiveSummary.lastUpdate.author}`
                                    : 'Sem atualização registrada'}
                            </strong>
                        </div>
                    </div>
                )}

                <div className="mt-auto pt-4 border-t border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] italic">
                    CONFIDENCIAL — USO EXCLUSIVO
                </div>
            </div>}

            {/* PÁGINAS DE DETALHAMENTO TOTALMENTE EM TABELAS */}
            <div className="p-8 space-y-6">
                {reportCategories.map((category, categoryIndex) => {
                    const unitsForCategory = unitsToRender.filter(unit =>
                        selectedDataGroups.some(group => group.unitId === unit.id && getRuntimeCategoryLabel(group) === category)
                    );
                    if (unitsForCategory.length === 0) return null;

                    return (
                        <div key={category} className="report-category-block">
                            <div className="report-category-header">
                                <span>{String(categoryIndex + 1).padStart(2, '0')}</span>
                                <div>
                                    <h2>{category}</h2>
                                    <p>{unitsForCategory.length} tópico(s) completo(s)</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                {unitsForCategory.map((unit) => {
                    const groupsForUnit = selectedDataGroups
                        .filter(g => g.unitId === unit.id && getRuntimeCategoryLabel(g) === category);
                    if (groupsForUnit.length === 0) return null;

                    const unitEntries = entries.filter(e => e.unitId === unit.id);
                    const textGroupsForUnit = groupsForUnit.filter(group => group.mode === 'snapshot' && group.reportLayout === 'text');
                    const groupIdsForUnit = groupsForUnit.map(group => group.id);
                    const latestUnitUpdate = [
                        ...unitEntries
                            .filter(entry => groupIdsForUnit.includes(entry.dataGroupId))
                            .map(entry => ({ updatedAt: entry.updatedAt, updatedBy: entry.updatedBy })),
                        ...collectionItems
                            .filter(item => item.unitId === unit.id && groupIdsForUnit.includes(item.dataGroupId) && item.status !== 'archived')
                            .map(item => ({ updatedAt: item.updatedAt, updatedBy: item.updatedBy }))
                    ]
                        .filter(item => item.updatedAt)
                        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
                    const latestUnitUpdateDate = latestUnitUpdate ? new Date(latestUnitUpdate.updatedAt) : null;
                    const latestUnitUpdateAuthor = latestUnitUpdate?.updatedBy
                        ? users.find(item => item.id === latestUnitUpdate.updatedBy)?.name || 'Responsável não identificado'
                        : 'Responsável não identificado';
                    const getTableHighlights = (groupId?: string) =>
                        groupId ? (reportCategoryConfig?.tableHighlights ?? []).filter(rule => rule.groupId === groupId) : [];
                    const preserveOriginalMetrics = /graer|grupamento aéreo/i.test(unit.name);
                    const getVal = (field: any, snapshotValues: any[]) => {
                        const fv = snapshotValues.find(v => v.fieldId === field.id);
                        let val = fv ? fv.value : null;
                        if ((val === null || val === undefined || val === '') && field.type === 'calculated') {
                            const allValues = snapshotValues.reduce((acc, curr) => {
                                acc[curr.fieldId] = curr.value;
                                return acc;
                            }, {} as Record<string, any>);
                            const calculated = calculateFieldValue(field, allValues, fields, true);
                            if (calculated !== null) val = calculated;
                        }
                        if (val === null || val === undefined || val === '') return '-';
                        if (field.type === 'percentage') return `${Number(val).toLocaleString('pt-BR')}%`;
                        if (field.type === 'currency') return formatBrazilianNumber(Number(val), true);
                        if (field.type === 'number' || field.type === 'calculated') return Number(val).toLocaleString('pt-BR');
                        return val;
                    };
                    const textSectionsForUnit = textGroupsForUnit.map(group => {
                        const groupEntry = unitEntries.find(entry => entry.dataGroupId === group.id && !entry.referenceYear && !entry.referenceMonth)
                            ?? unitEntries.find(entry => entry.dataGroupId === group.id);
                        const snapshotValues = groupEntry ? getValuesForEntry(groupEntry.id) : [];
                        const values = getSortedFields(group.id)
                            .map(field => getVal(field, snapshotValues))
                            .filter(value => value !== '-');

                        return { group, values };
                    });

                    const metricData = groupsForUnit.reduce<{
                        years: string[];
                        rows: RawMetricRow[];
                        pendingYearBlock: null | {
                            groupId: string;
                            title: string;
                            years: string[];
                            rowsByLabel: Map<string, { label: string; valuesByYear: Record<string, ReactNode>; order: number; showTotal: boolean; isCurrency: boolean }>;
                        };
                    }>((acc, group) => {
                        const flushYearBlock = () => {
                            if (!acc.pendingYearBlock || acc.pendingYearBlock.rowsByLabel.size === 0) return;

                            acc.rows.push(
                                { type: 'section', label: acc.pendingYearBlock.title, groupId: acc.pendingYearBlock.groupId },
                                ...Array.from(acc.pendingYearBlock.rowsByLabel.values())
                                    .sort((a, b) => a.order - b.order)
                                    .map(item => ({ type: 'yearly', label: item.label, valuesByYear: item.valuesByYear, showTotal: item.showTotal, isCurrency: item.isCurrency } as RawMetricRow))
                            );
                            acc.pendingYearBlock = null;
                        };

                        if (group.mode === 'collection' || group.reportLayout === 'text') {
                            flushYearBlock();
                            return acc;
                        }

                        const groupFields = getSortedFields(group.id);
                        if (groupFields.length === 0) return acc;

                        if (group.updateFrequency === 'yearly') {
                            flushYearBlock();
                            const groupEntriesByYear = new Map(
                                unitEntries
                                    .filter(entry => entry.dataGroupId === group.id && entry.referenceYear && !entry.referenceMonth)
                                    .map(entry => [String(entry.referenceYear), entry])
                            );
                            const legacyEntry = unitEntries.find(entry => entry.dataGroupId === group.id && !entry.referenceYear && !entry.referenceMonth);
                            const currentYear = String(CURRENT_REPORT_YEAR);
                            if (legacyEntry && !groupEntriesByYear.has(currentYear)) {
                                groupEntriesByYear.set(currentYear, legacyEntry);
                            }

                            acc.rows.push(
                                { type: 'section', label: group.title, groupId: group.id },
                                ...groupFields.map(field => ({
                                    type: 'yearly' as const,
                                    label: field.name,
                                    valuesByYear: Object.fromEntries(REPORT_YEARS.map(year => {
                                        const entry = groupEntriesByYear.get(year);
                                        const values = entry ? getValuesForEntry(entry.id) : [];
                                        return [year, entry ? getVal(field, values) : '-'];
                                    })),
                                    showTotal: group.showTotal && ['number', 'currency', 'percentage', 'calculated'].includes(field.type),
                                    isCurrency: field.type === 'currency',
                                    periodType: 'yearly' as const
                                }))
                            );
                            return acc;
                        }

                        if (group.updateFrequency === 'monthly') {
                            flushYearBlock();
                            const entriesByMonth = new Map(
                                unitEntries
                                    .filter(entry => entry.dataGroupId === group.id && entry.referenceYear && entry.referenceMonth)
                                    .map(entry => [
                                        `${entry.referenceYear}-${String(entry.referenceMonth).padStart(2, '0')}`,
                                        entry
                                    ])
                            );
                            const periods = Array.from(entriesByMonth.keys()).sort();

                            acc.rows.push(
                                { type: 'section', label: group.title, groupId: group.id },
                                ...groupFields.map(field => ({
                                    type: 'yearly' as const,
                                    label: field.name,
                                    valuesByYear: Object.fromEntries(periods.map(period => {
                                        const entry = entriesByMonth.get(period);
                                        const values = entry ? getValuesForEntry(entry.id) : [];
                                        return [period, entry ? getVal(field, values) : '-'];
                                    })),
                                    showTotal: group.showTotal && ['number', 'currency', 'percentage', 'calculated'].includes(field.type),
                                    isCurrency: field.type === 'currency',
                                    periodType: 'monthly' as const
                                }))
                            );
                            return acc;
                        }

                        const groupEntry = unitEntries.find(e => e.dataGroupId === group.id);
                        const snapshotValues = groupEntry ? getValuesForEntry(groupEntry.id) : [];
                        const groupYear = preserveOriginalMetrics ? null : getYearFromText(group.title);
                        const yearlyGroups = new Map<string, { label: string; valuesByYear: Record<string, ReactNode>; order: number; showTotal: boolean; isCurrency: boolean }>();
                        const regularRows: { order: number; row: ReactNode[] }[] = [];

                        groupFields.forEach((field, index) => {
                            const value = getVal(field, snapshotValues);
                            const yearInfo = preserveOriginalMetrics ? null : getYearMetricInfo(field.name);

                            if (groupYear) {
                                if (!acc.years.includes(groupYear)) {
                                    acc.years.push(groupYear);
                                }
                                if (!acc.pendingYearBlock) {
                                    acc.pendingYearBlock = { groupId: group.id, title: group.title, years: [], rowsByLabel: new Map() };
                                }
                                if (!acc.pendingYearBlock.years.includes(groupYear)) {
                                    acc.pendingYearBlock.years.push(groupYear);
                                }

                                const fieldBaseName = yearInfo?.baseName || getMetricLabelWithoutYear(field.name, unit.name);
                                const fieldKey = getMetricGroupKey(fieldBaseName) || fieldBaseName.toLowerCase();
                                const current = acc.pendingYearBlock.rowsByLabel.get(fieldKey) ?? {
                                    label: fieldBaseName,
                                    valuesByYear: {},
                                    order: group.order * 1000 + index,
                                    showTotal: ['number', 'currency', 'percentage', 'calculated'].includes(field.type),
                                    isCurrency: field.type === 'currency'
                                };
                                current.valuesByYear[groupYear] = value;
                                current.showTotal = current.showTotal || ['number', 'currency', 'percentage', 'calculated'].includes(field.type);
                                current.isCurrency = current.isCurrency || field.type === 'currency';
                                current.order = Math.min(current.order, group.order * 1000 + index);
                                acc.pendingYearBlock.rowsByLabel.set(fieldKey, current);
                                return;
                            }

                            if (!yearInfo) {
                                regularRows.push({ order: index, row: [field.name, value] });
                                return;
                            }

                            if (!acc.years.includes(yearInfo.year)) {
                                acc.years.push(yearInfo.year);
                            }

                            const fieldBaseName = yearInfo.baseName || getMetricLabelWithoutYear(field.name, unit.name);
                            const fieldKey = getMetricGroupKey(fieldBaseName) || fieldBaseName.toLowerCase();
                            const current = yearlyGroups.get(fieldKey) ?? {
                                label: fieldBaseName,
                                valuesByYear: {},
                                order: index,
                                showTotal: ['number', 'currency', 'percentage', 'calculated'].includes(field.type),
                                isCurrency: field.type === 'currency'
                            };
                            current.valuesByYear[yearInfo.year] = value;
                            current.showTotal = current.showTotal || ['number', 'currency', 'percentage', 'calculated'].includes(field.type);
                            current.isCurrency = current.isCurrency || field.type === 'currency';
                            current.order = Math.min(current.order, index);
                            yearlyGroups.set(fieldKey, current);
                        });

                        if (groupYear) return acc;
                        flushYearBlock();

                        const groupRows = [
                            ...regularRows,
                            ...Array.from(yearlyGroups.values()).map(item => ({
                                order: item.order,
                                row: { type: 'yearly', label: item.label, valuesByYear: item.valuesByYear, showTotal: item.showTotal, isCurrency: item.isCurrency } as RawMetricRow
                            }))
                        ].sort((a, b) => a.order - b.order);

                        if (groupRows.length === 0) return acc;

                        acc.rows.push(
                            { type: 'section', label: group.title, groupId: group.id },
                            ...groupRows.map(item => item.row)
                        );

                        return acc;
                    }, { years: [], rows: [], pendingYearBlock: null });

                    if (metricData.pendingYearBlock && metricData.pendingYearBlock.rowsByLabel.size > 0) {
                        metricData.rows.push(
                            { type: 'section', label: metricData.pendingYearBlock.title, groupId: metricData.pendingYearBlock.groupId },
                            ...Array.from(metricData.pendingYearBlock.rowsByLabel.values())
                                .sort((a, b) => a.order - b.order)
                                .map(item => ({ type: 'yearly', label: item.label, valuesByYear: item.valuesByYear, showTotal: item.showTotal, isCurrency: item.isCurrency } as RawMetricRow))
                        );
                    }

                    const metricTableBlocks: {
                        id: string;
                        groupId?: string;
                        headers: string[];
                        rows: TableRow[];
                        colWidths: string[];
                        financial: boolean;
                    }[] = [];

                    let activeSection: string | null = null;
                    let activeSectionGroupId: string | undefined;
                    let regularRows: ReactNode[][] = [];
                    let yearlyRows: Extract<RawMetricRow, { type: 'yearly' }>[] = [];

                    const flushMetricSection = () => {
                        if (regularRows.length > 0) {
                            metricTableBlocks.push({
                                id: `${activeSection || 'indicadores'}-regular-${metricTableBlocks.length}`,
                                groupId: activeSectionGroupId,
                                headers: ['Indicador', 'Total'],
                                rows: [
                                    ...(activeSection ? [{ type: 'section' as const, label: activeSection }] : []),
                                    ...regularRows.map(row => [row[0], <MetricValue key={`${String(row[0])}-value`} value={row[1] ?? '-'} label={row[0]} />] as ReactNode[])
                                ],
                                colWidths: ['34%', '66%'],
                                financial: false
                            });
                        }

                        if (yearlyRows.length > 0) {
                            const blockYears = Array.from(new Set(yearlyRows.flatMap(row => Object.keys(row.valuesByYear)))).sort();
                            const showTotalColumn = yearlyRows.some(row => row.showTotal);
                            const hasCurrencyValues = yearlyRows.some(row => row.isCurrency);
                            const isMonthlyComparison = yearlyRows.some(row => row.periodType === 'monthly');
                            const periodChunks = isMonthlyComparison && blockYears.length > 4
                                ? Array.from({ length: Math.ceil(blockYears.length / 4) }, (_, index) => blockYears.slice(index * 4, index * 4 + 4))
                                : [blockYears];

                            periodChunks.forEach((periods, periodChunkIndex) => {
                                const showYearColumns = periods.length > 1 || (isMonthlyComparison && periods.length > 0);
                                const totalHeader = periodChunks.length > 1 ? 'Total geral' : 'Total';
                                const headers = showYearColumns
                                    ? ['Indicador', ...periods.map(period => isMonthlyComparison ? formatMonthlyPeriod(period) : `Ano ${period}`), ...(showTotalColumn ? [totalHeader] : [])]
                                    : ['Indicador', 'Total'];
                                const rows = yearlyRows.map<TableRow>(row => {
                                    const total = row.showTotal ? getMetricTotal(row.valuesByYear, blockYears, row.isCurrency) : '-';
                                    if (!showYearColumns) {
                                        return [row.label, <MetricValue key={`${row.label}-total`} value={total} label={row.label} />];
                                    }

                                    return [
                                        row.label,
                                        ...periods.map(period => <MetricValue key={`${row.label}-${period}`} value={row.valuesByYear[period] ?? '-'} label={row.label} />),
                                        ...(showTotalColumn ? [<MetricValue key={`${row.label}-total`} value={total} label={row.label} />] : [])
                                    ];
                                });

                                metricTableBlocks.push({
                                    id: `${activeSection || 'comparativo'}-${isMonthlyComparison ? 'monthly' : 'annual'}-${periodChunkIndex}-${metricTableBlocks.length}`,
                                    groupId: activeSectionGroupId,
                                    headers,
                                    rows: [
                                        ...(activeSection ? [{ type: 'section' as const, label: activeSection }] : []),
                                        ...rows
                                    ],
                                    colWidths: headers.map((_, index) => {
                                        if (hasCurrencyValues && showYearColumns) {
                                            const valueColumnWidth = 84 / (headers.length - 1);
                                            return index === 0 ? '16%' : `${valueColumnWidth.toFixed(2)}%`;
                                        }
                                        if (index === 0) return showYearColumns ? '30%' : '34%';
                                        if (!showYearColumns) return '66%';
                                        if (showTotalColumn && index === headers.length - 1) return '22%';
                                        return `${Math.floor((showTotalColumn ? 48 : 70) / Math.max(periods.length, 1))}%`;
                                    }),
                                    financial: hasCurrencyValues
                                });
                            });
                        }

                        regularRows = [];
                        yearlyRows = [];
                    };

                    metricData.rows.forEach(row => {
                        if (!Array.isArray(row) && row.type === 'section') {
                            flushMetricSection();
                            activeSection = row.label;
                            activeSectionGroupId = row.groupId;
                            return;
                        }

                        if (!Array.isArray(row) && row.type === 'yearly') {
                            yearlyRows.push(row);
                            return;
                        }

                        if (Array.isArray(row)) {
                            regularRows.push(row);
                        }
                    });
                    flushMetricSection();

                    return (
                        <div key={unit.id} className="unit-section mb-8 break-after-page-avoid">
                            <div className="report-unit-header mb-4">
                                <div className="report-unit-heading">
                                    <h2 className="text-[15px] font-black text-slate-900 uppercase tracking-tight">{unit.name}</h2>
                                    <span className="text-[10px] font-black text-slate-400 italic">PÁGINA DETALHADA</span>
                                </div>
                                <div className="report-unit-meta">
                                    {unit.responsibleSector && <span>Setor responsável: <strong>{unit.responsibleSector}</strong></span>}
                                    <span>Última atualização: <strong>{latestUnitUpdateDate ? latestUnitUpdateDate.toLocaleString('pt-BR') : 'Sem registro'}</strong></span>
                                    <span>Responsável pela atualização: <strong>{latestUnitUpdateAuthor}</strong></span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {groupsForUnit.map(group => {
                                        if (group.mode !== 'collection' && group.reportLayout !== 'text') {
                                            return metricTableBlocks
                                                .filter(block => block.groupId === group.id)
                                                .map(block => (
                                                    <div key={block.id} className="report-metric-panel break-inside-avoid">
                                                        <CompactTable
                                                            headers={block.headers}
                                                            rows={block.rows}
                                                            colWidths={block.colWidths}
                                                            variant="metrics"
                                                            highlightRules={getTableHighlights(block.groupId)}
                                                            financial={block.financial}
                                                        />
                                                    </div>
                                                ));
                                        }

                                        if (group.mode === 'snapshot' && group.reportLayout === 'text') {
                                            const section = textSectionsForUnit.find(item => item.group.id === group.id);
                                            return <TextSection key={group.id} title={group.title} values={section?.values ?? []} />;
                                        }

                                        const unitCollections = collectionItems.filter(i => i.unitId === unit.id && i.dataGroupId === group.id && i.status !== 'archived');
                                        const collectionFields = getSortedFields(group.id);
                                        const getCollectionFieldValue = (itemId: string, field: any) => {
                                            const value = getValuesForItem(itemId).find((itemValue: any) => itemValue.fieldId === field.id);
                                            return formatCollectionValue(field, value) || '-';
                                        };
                                        const renderCollectionFieldValue = (itemId: string, field: any) => {
                                            const value = getCollectionFieldValue(itemId, field);
                                            if (['number', 'currency', 'percentage', 'calculated'].includes(field.type)) {
                                                return <MetricValue key={`${itemId}-${field.id}`} value={value} label={field.name} />;
                                            }
                                            return value;
                                        };
                                        const itemsToRender = [...unitCollections].sort((a, b) => {
                                            const manualOrder = (a.orderIndex ?? 999) - (b.orderIndex ?? 999);
                                            if (manualOrder !== 0) return manualOrder;
                                            if (group.collectionLayout === 'table' && collectionFields.length > 0) {
                                                return String(getCollectionFieldValue(a.id, collectionFields[0])).localeCompare(
                                                    String(getCollectionFieldValue(b.id, collectionFields[0])),
                                                    'pt-BR',
                                                    { sensitivity: 'base', numeric: true }
                                                );
                                            }
                                            return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                                        });

                                        if (itemsToRender.length === 0) return null;

                                        if (group.collectionLayout === 'table' && collectionFields.length > 0) {
                                            return (
                                                <div key={group.id} className="report-metric-panel break-inside-avoid">
                                                    <CompactTable
                                                        headers={collectionFields.map(field => field.name)}
                                                        rows={[
                                                            { type: 'section' as const, label: group.title, groupId: group.id },
                                                            ...itemsToRender.map(item =>
                                                                collectionFields.map(field => renderCollectionFieldValue(item.id, field))
                                                            )
                                                        ]}
                                                        colWidths={getCollectionColumnWidths(collectionFields)}
                                                        variant="metrics"
                                                        highlightRules={getTableHighlights(group.id)}
                                                    />
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={group.id} className="report-metric-panel break-inside-avoid">
                                                <CompactTable 
                                                    headers={['Tópico / Ocorrência', 'Data / Período', 'Informações', 'Sinc.']}
                                                    rows={[{ type: 'section' as const, label: group.title, groupId: group.id }, ...itemsToRender.map(item => {
                                                        const itemValues = getValuesForItem(item.id);
                                                        const valuesWithField = itemValues
                                                            .map((fv: any) => ({ value: fv, field: fields.find(f => f.id === fv.fieldId) }))
                                                            .filter(({ field }) => field)
                                                            .sort((left, right) => {
                                                                const leftIndex = collectionFields.findIndex(field => field.id === left.field!.id);
                                                                const rightIndex = collectionFields.findIndex(field => field.id === right.field!.id);
                                                                return (leftIndex >= 0 ? leftIndex : 9999) - (rightIndex >= 0 ? rightIndex : 9999);
                                                            });
                                                        const textValues = valuesWithField.filter(({ field }) => field?.type === 'text');
                                                        const datePeriodValues = textValues.filter(({ field }) => field ? isDateOrPeriodField(field.name) : false);
                                                        const titleValue = textValues.find(({ field, value }) => field && !isDateOrPeriodField(field.name) && value.valueText);
                                                        const datePeriodLabel = datePeriodValues
                                                            .map(({ field, value }) => {
                                                                const formatted = formatCollectionValue(field, value);
                                                                return formatted ? `${field?.name}: ${formatted}` : null;
                                                            })
                                                            .filter(Boolean)
                                                            .join(' | ');
                                                        const detailLabel = valuesWithField
                                                            .map(({ field, value }) => {
                                                                const formatted = formatCollectionValue(field, value);
                                                                if (!formatted) return null;
                                                                return `${field?.name}: ${formatted}`;
                                                            })
                                                            .filter(Boolean)
                                                            .join(' | ');

                                                        return [
                                                            titleValue?.value.valueText?.toUpperCase() || 'REGISTRO',
                                                            datePeriodLabel || '-',
                                                            detailLabel || 'Sem informações preenchidas.',
                                                            new Date(item.updatedAt).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})
                                                        ];
                                                    })]}
                                                    colWidths={['18%', '18%', '54%', '10%']}
                                                    variant="metrics"
                                                    highlightRules={getTableHighlights(group.id)}
                                                    narrative
                                                />
                                            </div>
                                        );
                                })}
                            </div>
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
                    .report-table-row,
                    .report-group-row,
                    .report-reading-item,
                    .report-unit-header,
                    .report-category-header {
                        break-inside: avoid;
                        page-break-inside: avoid;
                    }
                    .report-unit-header,
                    .report-category-header,
                    .report-section-header,
                    .report-group-row {
                        break-after: avoid;
                        page-break-after: avoid;
                    }
                    .report-section-header + .report-table,
                    .report-group-row + tr {
                        break-before: avoid;
                        page-break-before: avoid;
                    }
                    .report-collection-panel,
                    .report-metric-panel,
                    .report-text-panel,
                    .report-table-keep-together {
                        break-inside: avoid-page !important;
                        page-break-inside: avoid !important;
                    }
                    .report-table-keep-together {
                        display: inline-block !important;
                        vertical-align: top;
                        width: 100%;
                    }
                    .report-table-keep-together table,
                    .report-table-keep-together thead,
                    .report-table-keep-together tbody,
                    .report-table-keep-together tr {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                    .report-table {
                        overflow: visible !important;
                        border: 0 !important;
                        border-radius: 0 !important;
                        box-shadow: none !important;
                    }
                    .report-table table {
                        border: 1px solid #cbd5e1;
                    }
                    .report-text-content {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                    .report-font-large .report-collection-panel,
                    .report-font-large .report-metric-panel,
                    .report-font-large .report-text-panel,
                    .report-font-large .report-table-keep-together,
                    .report-font-large .report-table-keep-together table,
                    .report-font-large .report-table-keep-together tbody {
                        break-inside: avoid-page !important;
                        page-break-inside: avoid !important;
                    }
                    .report-font-large .report-section-header,
                    .report-font-large .report-table tr {
                        break-inside: avoid;
                        page-break-inside: avoid;
                    }
                    .report-table thead,
                    .report-table tbody tr:first-child,
                    .report-collection-panel .report-section-header,
                    .report-metric-panel .report-section-header {
                        break-inside: avoid;
                        page-break-inside: avoid;
                    }
                    .report-table {
                        break-before: avoid;
                        page-break-before: avoid;
                    }
                    .report-table thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                    .report-table tr,
                    .report-table td,
                    .report-table th {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                }

                .report-unit-header {
                    background: #f8fafc;
                    border: 1px solid #cbd5e1;
                    border-left: 6px solid #0f172a;
                    border-radius: 10px;
                    padding: 12px 14px;
                    margin-bottom: 14px;
                }

                .report-unit-heading {
                    display: flex;
                    justify-content: space-between;
                    align-items: end;
                    gap: 12px;
                }

                .report-unit-heading h2 {
                    margin: 0;
                }

                .report-unit-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px 14px;
                    margin-top: 7px;
                    color: #475569;
                    font-size: 10px;
                    font-weight: 850;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }

                .report-unit-meta strong {
                    color: #0f172a;
                }

                .report-category-block {
                    break-before: auto;
                    page-break-before: auto;
                    margin-bottom: 28px;
                }

                .report-category-block + .report-category-block {
                    break-before: page;
                    page-break-before: always;
                }

                .report-category-header {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    background: #d8cca1;
                    border: 1px solid #b8a979;
                    border-left: 8px solid #0f172a;
                    border-radius: 12px;
                    padding: 14px 16px;
                    margin-bottom: 18px;
                    box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
                }

                .report-category-header span {
                    width: 38px;
                    height: 38px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 10px;
                    background: #0f172a;
                    color: #ffffff;
                    font-size: 14px;
                    font-weight: 950;
                }

                .report-category-header h2 {
                    margin: 0;
                    color: #0f172a;
                    font-size: 18px;
                    line-height: 1;
                    font-weight: 950;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }

                .report-category-header p {
                    margin: 5px 0 0;
                    color: #475569;
                    font-size: 10px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                }

                .report-metric-panel,
                .report-collection-panel,
                .report-text-panel {
                    margin-bottom: 16px;
                    break-inside: avoid;
                    page-break-inside: avoid;
                }

                .report-section-header {
                    border-radius: 8px;
                    background: #eef2f7;
                    border-left-color: #8a7a3f;
                    box-shadow: inset 0 -1px 0 rgba(15, 23, 42, 0.08);
                    break-after: avoid;
                    page-break-after: avoid;
                }

                .report-section-header h2 {
                    letter-spacing: 0.03em;
                }

                .report-text-content {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 13px 14px;
                    color: #1e293b;
                    background: #ffffff;
                    font-size: 12px;
                    line-height: 1.6;
                    font-weight: 600;
                    white-space: pre-wrap;
                }

                .report-text-content p {
                    margin: 0;
                }

                .report-text-content p + p {
                    margin-top: 10px;
                }

                .report-text-empty {
                    color: #64748b;
                    font-style: italic;
                }

                .report-table {
                    border-radius: 10px;
                    border-color: #cbd5e1;
                    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
                    break-before: avoid;
                    page-break-before: avoid;
                    break-inside: avoid;
                    page-break-inside: avoid;
                }

                .report-table thead tr {
                    background: #111827;
                }

                .report-group-row td {
                    background: #e2e8f0 !important;
                    color: #0f172a !important;
                    border-top: 1px solid #cbd5e1;
                    border-bottom: 1px solid #cbd5e1;
                }

                .report-group-row {
                    break-after: avoid;
                    page-break-after: avoid;
                }

                .report-highlight-khaki {
                    background: #f7f3df !important;
                    color: #3f371e !important;
                }

                .report-highlight-blue {
                    background: #dbeafe !important;
                    color: #1e3a8a !important;
                }

                .report-highlight-green {
                    background: #dcfce7 !important;
                    color: #14532d !important;
                }

                .report-highlight-amber {
                    background: #fef3c7 !important;
                    color: #78350f !important;
                }

                .report-highlight-red {
                    background: #fee2e2 !important;
                    color: #7f1d1d !important;
                }

                .report-table-metrics th {
                    font-size: 12px;
                    padding-top: 10px;
                    padding-bottom: 10px;
                }

                .report-table-metrics th:not(:first-child):not(:last-child) {
                    background: #8a7a3f;
                    color: #ffffff;
                }

                .report-table-metrics th:last-child {
                    background: #0f172a;
                    color: #ffffff;
                }

                .report-table-metrics td {
                    font-size: 12px;
                    vertical-align: top;
                    overflow-wrap: anywhere;
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

                .report-table-financial th:not(:first-child),
                .report-table-financial td:not(:first-child) {
                    padding-left: 3px;
                    padding-right: 3px;
                }

                .report-table-financial td:first-child {
                    padding-left: 8px;
                    padding-right: 6px;
                }

                .report-table-narrative th:nth-child(2),
                .report-table-narrative th:nth-child(3),
                .report-table-narrative td:nth-child(2),
                .report-table-narrative td:nth-child(3) {
                    text-align: left;
                }

                .executive-stat-grid {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 10px;
                    break-inside: avoid;
                    page-break-inside: avoid;
                }

                .executive-stat-card {
                    min-height: 116px;
                    border: 1px solid #cbd5e1;
                    border-radius: 12px;
                    padding: 12px;
                    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
                    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
                    break-inside: avoid;
                    page-break-inside: avoid;
                }

                .executive-stat-icon {
                    display: inline-flex;
                    width: 32px;
                    height: 32px;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                    margin-bottom: 8px;
                    background: #e2e8f0;
                    color: #0f172a;
                }

                .executive-stat-card span {
                    display: block;
                    color: #475569;
                    font-size: 9px;
                    font-weight: 900;
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                }

                .executive-stat-card strong {
                    display: block;
                    color: #0f172a;
                    font-size: 30px;
                    font-weight: 950;
                    line-height: 1;
                    margin-top: 3px;
                }

                .executive-stat-card p {
                    color: #475569;
                    font-size: 9.5px;
                    font-weight: 800;
                    line-height: 1.25;
                    margin: 6px 0 0;
                }

                .executive-stat-card-khaki {
                    border-color: #d8cf9a;
                    background: linear-gradient(180deg, #ffffff 0%, #f7f3df 100%);
                }

                .executive-stat-card-khaki .executive-stat-icon {
                    background: #eee7bf;
                    color: #776734;
                }

                .executive-stat-card-emerald {
                    border-color: #bbf7d0;
                    background: linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%);
                }

                .executive-stat-card-emerald .executive-stat-icon {
                    background: #dcfce7;
                    color: #047857;
                }

                .executive-stat-card-amber {
                    border-color: #fde68a;
                    background: linear-gradient(180deg, #ffffff 0%, #fffbeb 100%);
                }

                .executive-stat-card-amber .executive-stat-icon {
                    background: #fef3c7;
                    color: #b45309;
                }

                .report-reading-map {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 8px;
                    margin-bottom: 12px;
                    break-inside: avoid;
                    page-break-inside: avoid;
                }

                .report-reading-item {
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    padding: 9px 10px;
                    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
                    break-inside: avoid;
                    page-break-inside: avoid;
                    box-shadow: 0 6px 14px rgba(15, 23, 42, 0.04);
                }

                .report-reading-item strong {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    color: #0f172a;
                    font-size: 11px;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .report-reading-item span {
                    display: block;
                    margin-top: 3px;
                    color: #475569;
                    font-size: 10px;
                    font-weight: 800;
                    line-height: 1.35;
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

                .report-last-update-box {
                    margin-top: 8px;
                    background: #ffffff;
                }

                .report-emission-box span {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                }

                .report-emission-box strong {
                    color: #0f172a;
                    font-size: 12px;
                }

                .report-metric-value {
                    display: block;
                    max-width: 100%;
                    color: #0f172a;
                    font-size: 13px;
                    font-weight: 900;
                    font-variant-numeric: tabular-nums;
                    letter-spacing: -0.01em;
                    line-height: 1.35;
                    white-space: nowrap;
                    text-align: center;
                }

                .report-metric-value.text-emerald-700 {
                    color: #047857;
                }

                .report-metric-value.text-red-700 {
                    color: #b91c1c;
                }

                .report-metric-value-currency {
                    letter-spacing: -0.02em;
                }

                .report-metric-value-long {
                    font-size: 11px;
                    letter-spacing: -0.035em;
                }

                .report-metric-value-xlong {
                    font-size: 9.5px;
                    letter-spacing: -0.05em;
                }

                .report-font-large .report-category-header h2 {
                    font-size: 21px;
                }

                .report-font-large .report-category-header p,
                .report-font-large .report-reading-item span,
                .report-font-large .report-emission-box {
                    font-size: 12px;
                    line-height: 1.45;
                }

                .report-font-large .report-reading-item strong,
                .report-font-large .report-emission-box strong {
                    font-size: 13px;
                }

                .report-font-large .report-unit-header h2 {
                    font-size: 18px;
                    line-height: 1.35;
                }

                .report-font-large .report-unit-heading span,
                .report-font-large .report-unit-meta {
                    font-size: 12px;
                }

                .report-font-large .report-section-header h2 {
                    font-size: 14px;
                    line-height: 1.35;
                }

                .report-font-large .report-text-content {
                    font-size: 14px;
                    line-height: 1.65;
                    padding: 15px 16px;
                }

                .report-font-large .report-table th {
                    font-size: 12px;
                    line-height: 1.35;
                    padding: 10px;
                }

                .report-font-large .report-table td,
                .report-font-large .report-table-metrics td {
                    font-size: 13px;
                    line-height: 1.5;
                    padding: 10px;
                }

                .report-font-large .report-table-metrics td:not(:first-child),
                .report-font-large .report-table-metrics td:last-child {
                    font-size: 14px;
                }

                .report-font-large .report-metric-value {
                    font-size: 15px;
                }

                .report-font-large .report-metric-value-long {
                    font-size: 12px;
                }

                .report-font-large .report-metric-value-xlong {
                    font-size: 10px;
                }

                .report-font-large .report-group-row td {
                    font-size: 14px;
                }

                .report-font-large .executive-stat-card span,
                .report-font-large .executive-stat-card p {
                    font-size: 11px;
                }

                .report-font-large .executive-stat-card strong {
                    font-size: 34px;
                }

                .report-value-neutral {
                    display: block;
                    color: #334155;
                    font-weight: 800;
                    overflow-wrap: anywhere;
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
