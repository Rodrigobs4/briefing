import { useAuth, calculateFieldValue } from '../../../store/AuthContext';
import { useSettings } from '../../../store/SettingsContext';
import { getPublicUploadUrl } from '../../../utils/storageUrls';
import { BarChart3, Building2, CalendarDays, ClipboardList, Layers3, MapPinned, MessageSquareText } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';

interface ReportPdfRendererProps {
    selectedUnits: string[];
    selectedGroups: string[];
    reportCategoryConfig?: {
        groupAssignments: Record<string, string>;
        categoryOrder: string[];
        groupOrder?: string[];
    };
}

type TableRow = ReactNode[] | { type: 'section'; label: string };
type RawMetricRow = TableRow | { type: 'yearly'; label: string; valuesByYear: Record<string, ReactNode> };
type ChartItem = { label: string; value: number; tone?: 'khaki' | 'emerald' | 'amber' | 'slate' };
type IconStatCardProps = {
    icon: ReactNode;
    label: string;
    value: string;
    description: string;
    tone?: 'khaki' | 'emerald' | 'amber' | 'slate';
};

// ==================================================================================
// COMPONENTES AUXILIARES PARA RELATÓRIO EXECUTIVO (COMPACTOS)
// ==================================================================================

const SectionHeader = ({ title }: { title: string }) => (
    <div className="report-section-header bg-slate-100 border-l-4 border-slate-900 px-3 py-2 mb-2">
        <h2 className="text-[12px] font-black text-slate-900 uppercase tracking-tight">{title}</h2>
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

const MiniBarChart = ({ title, items }: { title: string; items: ChartItem[] }) => {
    const maxValue = Math.max(1, ...items.map(item => item.value));

    return (
        <div className="report-chart">
            <div className="report-chart-title"><BarChart3 className="w-3.5 h-3.5" /> {title}</div>
            <div className="report-chart-rows">
                {items.map(item => {
                    const width = Math.max(6, Math.round((item.value / maxValue) * 100));
                    return (
                        <div key={item.label} className="report-chart-row">
                            <span className="report-chart-label">{item.label}</span>
                            <span className="report-chart-track">
                                <span className={`report-chart-bar report-chart-bar-${item.tone || 'slate'}`} style={{ width: `${width}%` }} />
                            </span>
                            <strong className="report-chart-value">{item.value}</strong>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const AnnualComparisonCharts = ({ rows, years }: { rows: Extract<RawMetricRow, { type: 'yearly' }>[]; years: string[] }) => {
    const chartRows = rows
        .map(row => ({
            label: row.label,
            items: years
                .map(year => ({ label: year, value: parseDisplayNumber(row.valuesByYear[year]) }))
                .filter((item): item is { label: string; value: number } => item.value !== null)
        }))
        .filter(row => row.items.length > 1)
        .slice(0, 4);

    if (chartRows.length === 0) return null;

    return (
        <div className="annual-chart-grid report-block">
            {chartRows.map(row => (
                <MiniBarChart
                    key={row.label}
                    title={row.label}
                    items={row.items.map(item => ({ ...item, tone: 'khaki' }))}
                />
            ))}
        </div>
    );
};

const parseDisplayNumber = (value: ReactNode) => {
    if (typeof value !== 'string') return null;
    if (value.includes('%')) return null;
    const numericValue = Number(value.replace(/\./g, '').replace(',', '.').replace('%', '').trim());
    return Number.isFinite(numericValue) ? numericValue : null;
};

const formatDisplayNumber = (value: number) => value.toLocaleString('pt-BR');

const getMetricTotal = (valuesByYear: Record<string, ReactNode>, years: string[]) => {
    const values = years.map(year => valuesByYear[year]).filter(value => value !== undefined && value !== null && value !== '-');
    if (values.length === 0) return '-';

    const numericValues = values.map(parseDisplayNumber);
    if (numericValues.length > 1 && numericValues.every(value => value !== null)) {
        return formatDisplayNumber(numericValues.reduce((sum, value) => sum + (value ?? 0), 0));
    }

    return values[0];
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

const getMetricLabelWithoutYear = (fieldName: string, fallback = 'Consolidado') => {
    const normalized = normalizeMetricBaseName(fieldName);
    return normalized || fallback;
};

const getYearFromText = (value: string) => value.match(/\b(19|20)\d{2}\b/)?.[0] ?? null;

const getCategoryLabel = (group: { categoryTitle?: string | null }) => group.categoryTitle?.trim() || 'Geral';
const formatCollectionValue = (field: any, value: any) => {
    if (!value) return null;

    if (field?.type === 'number' || field?.type === 'calculated') {
        return value.valueNumber !== null && value.valueNumber !== undefined ? Number(value.valueNumber).toLocaleString('pt-BR') : null;
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

export default function ReportPdfRenderer({ selectedUnits, selectedGroups, reportCategoryConfig }: ReportPdfRendererProps) {
    const { units, dataGroups, fields, entries, getValuesForEntry, collectionItems, getValuesForItem } = useAuth();
    const { settings } = useSettings();

    const logoUrl = settings?.logo_path ? getPublicUploadUrl(settings.logo_path) : null;
    const unitsToRender = useMemo(() => units.filter(u => selectedUnits.includes(u.id)), [units, selectedUnits]);
    const getRuntimeCategoryLabel = (group: { id: string; categoryTitle?: string | null }) => reportCategoryConfig?.groupAssignments[group.id]?.trim() || getCategoryLabel(group);
    const getRuntimeCategoryOrder = (category: string, fallback = 999) => {
        const configuredIndex = reportCategoryConfig?.categoryOrder.findIndex(item => item === category) ?? -1;
        return configuredIndex >= 0 ? configuredIndex + 1 : fallback;
    };
    const getRuntimeGroupOrder = (groupId: string, fallback = 9999) => {
        const configuredIndex = reportCategoryConfig?.groupOrder?.findIndex(item => item === groupId) ?? -1;
        return configuredIndex >= 0 ? configuredIndex + 1 : fallback;
    };
    const getRuntimeSectionLabel = (group: { id: string; title: string; categoryTitle?: string | null }) => {
        return group.title;
    };
    const getSortedGroups = (groups: typeof dataGroups) => [...groups]
        .sort((a, b) => getRuntimeCategoryOrder(getRuntimeCategoryLabel(a), a.categoryOrder ?? 999) - getRuntimeCategoryOrder(getRuntimeCategoryLabel(b), b.categoryOrder ?? 999) || getRuntimeGroupOrder(a.id, a.order) - getRuntimeGroupOrder(b.id, b.order) || a.order - b.order);
    const selectedDataGroups = getSortedGroups(dataGroups.filter(group => selectedGroups.includes(group.id)));
    const reportCategories = Array.from(new Set(selectedDataGroups.map(getRuntimeCategoryLabel)))
        .sort((a, b) => getRuntimeCategoryOrder(a) - getRuntimeCategoryOrder(b));
    const categoryBreakdown = reportCategories.map(category => {
        const categoryGroups = selectedDataGroups.filter(group => getRuntimeCategoryLabel(group) === category);
        const categoryUnitIds = Array.from(new Set(categoryGroups.map(group => group.unitId)));
        const categoryCollections = collectionItems.filter(item => categoryGroups.some(group => group.id === item.dataGroupId) && item.status !== 'archived').length;

        return {
            label: category,
            groups: categoryGroups.length,
            units: categoryUnitIds.length,
            collections: categoryCollections,
            total: categoryGroups.length + categoryCollections
        };
    });

    const executiveSummary = useMemo(() => {
        let totalRegistros = 0;
        let totalOcorrencias = 0;
        const unitBreakdown = unitsToRender.map(unit => {
            const unitRegistros = entries.filter(e => e.unitId === unit.id && selectedGroups.includes(e.dataGroupId)).length;
            const unitOcorrencias = collectionItems.filter(i => i.unitId === unit.id && selectedGroups.includes(i.dataGroupId) && i.status !== 'archived').length;
            const unitGroups = dataGroups.filter(group => group.unitId === unit.id && selectedGroups.includes(group.id)).length;
            totalRegistros += unitRegistros;
            totalOcorrencias += unitOcorrencias;

            return {
                label: unit.name,
                groups: unitGroups,
                registros: unitRegistros,
                ocorrencias: unitOcorrencias,
                total: unitGroups + unitRegistros + unitOcorrencias
            };
        });

        return {
            date: new Date().toLocaleDateString('pt-BR'),
            time: new Date().toLocaleTimeString('pt-BR'),
            unitsCount: unitsToRender.length,
            groupsCount: dataGroups.filter(group => selectedGroups.includes(group.id)).length,
            totalRegistros,
            totalOcorrencias,
            unitBreakdown
        };
    }, [unitsToRender, entries, collectionItems, dataGroups, selectedGroups]);

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

                <div className="mb-5">
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
                </div>

                {executiveSummary.unitBreakdown.length > 0 && (
                    <div className="mb-5">
                        <SectionHeader title="DISTRIBUIÇÃO POR UNIDADE" />
                        <MiniBarChart
                            title="Volume de informações no documento"
                            items={executiveSummary.unitBreakdown.map(item => ({
                                label: item.label,
                                value: item.total,
                                tone: item.ocorrencias > item.registros ? 'amber' : 'khaki'
                            }))}
                        />
                    </div>
                )}

                <div className="mb-5">
                    <SectionHeader title="MAPA DE ASSUNTOS" />
                    {categoryBreakdown.length > 0 && (
                        <div className="mb-3">
                            <MiniBarChart
                                title="Distribuição por categoria do relatório"
                                items={categoryBreakdown.map((item, index) => ({
                                    label: item.label,
                                    value: item.total,
                                    tone: index % 3 === 0 ? 'khaki' : index % 3 === 1 ? 'slate' : 'amber'
                                }))}
                            />
                        </div>
                    )}
                    <div className="report-reading-map">
                        {unitsToRender.map(unit => {
                            const unitGroups = selectedDataGroups.filter(group => group.unitId === unit.id);
                            const categoryNames = Array.from(new Set(unitGroups.map(getRuntimeCategoryLabel)));

                            return (
                                <div key={unit.id} className="report-reading-item">
                                    <strong><MapPinned className="w-3.5 h-3.5" /> {unit.name}</strong>
                                    <span>{categoryNames.map(category => {
                                        const titles = unitGroups.filter(group => getRuntimeCategoryLabel(group) === category).map(group => group.title).join(', ');
                                        return `${category}: ${titles}`;
                                    }).join(' • ') || 'Sem grupos selecionados'}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="report-emission-box">
                        <span><CalendarDays className="w-3.5 h-3.5" /> Documento gerado em</span>
                        <strong>{executiveSummary.date} às {executiveSummary.time}</strong>
                    </div>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] italic">
                    CONFIDENCIAL — USO EXCLUSIVO
                </div>
            </div>

            {/* PÁGINAS DE DETALHAMENTO TOTALMENTE EM TABELAS */}
            <div className="p-8 space-y-6">
                {reportCategories.map((category, categoryIndex) => {
                    const unitsForCategory = unitsToRender.filter(unit =>
                        selectedDataGroups.some(group => group.unitId === unit.id && getRuntimeCategoryLabel(group) === category)
                    );
                    const categoryGroups = selectedDataGroups.filter(group => getRuntimeCategoryLabel(group) === category);
                    if (unitsForCategory.length === 0) return null;

                    return (
                        <div key={category} className="report-category-block">
                            <div className="report-category-header">
                                <span>{String(categoryIndex + 1).padStart(2, '0')}</span>
                                <div>
                                    <h2>{category}</h2>
                                    <p>{unitsForCategory.length} tópico(s) completo(s) · {categoryGroups.length} seção(ões)</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                {unitsForCategory.map((unit) => {
                    const groupsForUnit = selectedDataGroups
                        .filter(g => g.unitId === unit.id && getRuntimeCategoryLabel(g) === category);
                    if (groupsForUnit.length === 0) return null;

                    const unitEntries = entries.filter(e => e.unitId === unit.id);
                    const metricGroupsForUnit = groupsForUnit.filter(group => group.mode !== 'collection');
                    const collectionGroupsForUnit = groupsForUnit.filter(group => group.mode === 'collection');
                    const preserveOriginalMetrics = [unit.name, unit.full_name || ''].some(name => /graer/i.test(name));
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

                    const metricData = metricGroupsForUnit.reduce<{
                        years: string[];
                        rows: RawMetricRow[];
                        pendingYearBlock: null | {
                            years: string[];
                            rowsByLabel: Map<string, { label: string; valuesByYear: Record<string, ReactNode>; order: number }>;
                        };
                    }>((acc, group) => {
                        const flushYearBlock = () => {
                            if (!acc.pendingYearBlock || acc.pendingYearBlock.rowsByLabel.size === 0) return;

                            acc.rows.push(
                                { type: 'section', label: `Comparativo por ano (${acc.pendingYearBlock.years.sort().join(' / ')})` },
                                ...Array.from(acc.pendingYearBlock.rowsByLabel.values())
                                    .sort((a, b) => a.order - b.order)
                                    .map(item => ({ type: 'yearly', label: item.label, valuesByYear: item.valuesByYear } as RawMetricRow))
                            );
                            acc.pendingYearBlock = null;
                        };

                        const groupFields = fields.filter(f => f.dataGroupId === group.id && f.isActive && f.type !== 'image').sort((a, b) => a.order - b.order);
                        if (groupFields.length === 0) return acc;

                        const groupEntry = unitEntries.find(e => e.dataGroupId === group.id);
                        const snapshotValues = groupEntry ? getValuesForEntry(groupEntry.id) : [];
                        const groupYear = preserveOriginalMetrics ? null : getYearFromText(group.title);
                        const yearlyGroups = new Map<string, { label: string; valuesByYear: Record<string, ReactNode>; order: number }>();
                        const regularRows: { order: number; row: ReactNode[] }[] = [];

                        groupFields.forEach((field, index) => {
                            const value = getVal(field, snapshotValues);
                            const yearInfo = preserveOriginalMetrics ? null : getYearMetricInfo(field.name);

                            if (groupYear) {
                                if (!acc.years.includes(groupYear)) {
                                    acc.years.push(groupYear);
                                }
                                if (!acc.pendingYearBlock) {
                                    acc.pendingYearBlock = { years: [], rowsByLabel: new Map() };
                                }
                                if (!acc.pendingYearBlock.years.includes(groupYear)) {
                                    acc.pendingYearBlock.years.push(groupYear);
                                }

                                const fieldBaseName = yearInfo?.baseName || getMetricLabelWithoutYear(field.name, group.title);
                                const fieldKey = getMetricGroupKey(fieldBaseName) || fieldBaseName.toLowerCase();
                                const current = acc.pendingYearBlock.rowsByLabel.get(fieldKey) ?? {
                                    label: fieldBaseName,
                                    valuesByYear: {},
                                    order: group.order * 1000 + index
                                };
                                current.valuesByYear[groupYear] = value;
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

                            const fieldBaseName = yearInfo.baseName || getMetricLabelWithoutYear(field.name, group.title);
                            const fieldKey = getMetricGroupKey(fieldBaseName) || fieldBaseName.toLowerCase();
                            const current = yearlyGroups.get(fieldKey) ?? {
                                label: fieldBaseName,
                                valuesByYear: {},
                                order: index
                            };
                            current.valuesByYear[yearInfo.year] = value;
                            current.order = Math.min(current.order, index);
                            yearlyGroups.set(fieldKey, current);
                        });

                        if (groupYear) return acc;
                        flushYearBlock();

                        const groupRows = [
                            ...regularRows,
                            ...Array.from(yearlyGroups.values()).map(item => ({
                                order: item.order,
                                row: { type: 'yearly', label: item.label, valuesByYear: item.valuesByYear } as RawMetricRow
                            }))
                        ].sort((a, b) => a.order - b.order);

                        if (groupRows.length === 0) return acc;

                        acc.rows.push(
                            { type: 'section', label: getRuntimeSectionLabel(group) },
                            ...groupRows.map(item => item.row)
                        );

                        return acc;
                    }, { years: [], rows: [], pendingYearBlock: null });

                    if (metricData.pendingYearBlock && metricData.pendingYearBlock.rowsByLabel.size > 0) {
                        metricData.rows.push(
                            { type: 'section', label: `Comparativo por ano (${metricData.pendingYearBlock.years.sort().join(' / ')})` },
                            ...Array.from(metricData.pendingYearBlock.rowsByLabel.values())
                                .sort((a, b) => a.order - b.order)
                                .map(item => ({ type: 'yearly', label: item.label, valuesByYear: item.valuesByYear } as RawMetricRow))
                        );
                    }

                    const metricTableBlocks: {
                        id: string;
                        headers: string[];
                        rows: TableRow[];
                        colWidths: string[];
                        annualRows: Extract<RawMetricRow, { type: 'yearly' }>[];
                        years: string[];
                    }[] = [];

                    let activeSection: string | null = null;
                    let regularRows: ReactNode[][] = [];
                    let yearlyRows: Extract<RawMetricRow, { type: 'yearly' }>[] = [];

                    const flushMetricSection = () => {
                        if (regularRows.length > 0) {
                            metricTableBlocks.push({
                                id: `${activeSection || 'indicadores'}-regular-${metricTableBlocks.length}`,
                                headers: ['Indicador', 'Consolidado'],
                                rows: [
                                    ...(activeSection ? [{ type: 'section' as const, label: activeSection }] : []),
                                    ...regularRows.map(row => [row[0], <MetricValue key={`${String(row[0])}-value`} value={row[1] ?? '-'} label={row[0]} />] as ReactNode[])
                                ],
                                colWidths: ['34%', '66%'],
                                annualRows: [],
                                years: []
                            });
                        }

                        if (yearlyRows.length > 0) {
                            const blockYears = Array.from(new Set(yearlyRows.flatMap(row => Object.keys(row.valuesByYear)))).sort();
                            const showYearColumns = blockYears.length > 1;
                            const headers = showYearColumns
                                ? ['Indicador', ...blockYears.map(year => `Ano ${year}`), 'Consolidado']
                                : ['Indicador', 'Consolidado'];
                            const rows = yearlyRows.map<TableRow>(row => {
                                const total = getMetricTotal(row.valuesByYear, blockYears);
                                if (!showYearColumns) {
                                    return [row.label, <MetricValue key={`${row.label}-total`} value={total} label={row.label} />];
                                }

                                return [
                                    row.label,
                                    ...blockYears.map(year => <MetricValue key={`${row.label}-${year}`} value={row.valuesByYear[year] ?? '-'} label={row.label} />),
                                    <MetricValue key={`${row.label}-total`} value={total} label={row.label} />
                                ];
                            });

                            metricTableBlocks.push({
                                id: `${activeSection || 'comparativo'}-annual-${metricTableBlocks.length}`,
                                headers,
                                rows: [
                                    ...(activeSection ? [{ type: 'section' as const, label: activeSection }] : []),
                                    ...rows
                                ],
                                colWidths: headers.map((_, index) => {
                                    if (index === 0) return showYearColumns ? '30%' : '34%';
                                    if (!showYearColumns) return '66%';
                                    if (index === headers.length - 1) return '22%';
                                    return `${Math.floor(48 / blockYears.length)}%`;
                                }),
                                annualRows: showYearColumns ? yearlyRows : [],
                                years: showYearColumns ? blockYears : []
                            });
                        }

                        regularRows = [];
                        yearlyRows = [];
                    };

                    metricData.rows.forEach(row => {
                        if (!Array.isArray(row) && row.type === 'section') {
                            flushMetricSection();
                            activeSection = row.label;
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
                            <div className="report-unit-header flex justify-between items-end border-b-[2px] border-slate-900 pb-1 mb-4">
                                <h2 className="text-[15px] font-black text-slate-900 uppercase tracking-tight">
                                    {unit.name} <span className="text-slate-500 text-[11px] ml-1">— {unit.full_name || 'COMANDO GERAL'}</span>
                                </h2>
                                <span className="text-[10px] font-black text-slate-400 italic">PÁGINA DETALHADA</span>
                            </div>

                            <div className="space-y-4">
                                {metricTableBlocks.map(block => (
                                    <div key={block.id} className="report-metric-panel break-inside-avoid">
                                        <CompactTable
                                            headers={block.headers}
                                            rows={block.rows}
                                            colWidths={block.colWidths}
                                            variant="metrics"
                                        />
                                        {block.annualRows.length > 0 && <AnnualComparisonCharts rows={block.annualRows} years={block.years} />}
                                    </div>
                                ))}

                                {collectionGroupsForUnit.map(group => {
                                        const unitCollections = collectionItems.filter(i => i.unitId === unit.id && i.dataGroupId === group.id && i.status !== 'archived');
                                        const itemsToRender = [...unitCollections].sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

                                        if (itemsToRender.length === 0) return null;

                                        return (
                                            <div key={group.id} className="report-collection-panel break-inside-avoid">
                                                <SectionHeader title={getRuntimeSectionLabel(group)} />
                                                <CompactTable 
                                                    headers={['Tópico / Ocorrência', 'Data / Período', 'Informações', 'Sinc.']}
                                                    rows={itemsToRender.map(item => {
                                                        const itemValues = getValuesForItem(item.id);
                                                        const valuesWithField = itemValues
                                                            .map((fv: any) => ({ value: fv, field: fields.find(f => f.id === fv.fieldId) }))
                                                            .filter(({ field }) => field);
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
                    .report-chart,
                    .annual-chart-grid,
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
                    .report-metric-panel {
                        break-inside: auto;
                        page-break-inside: auto;
                    }
                    .report-collection-panel .report-section-header,
                    .report-collection-panel .report-table thead,
                    .report-collection-panel .report-table tbody tr:first-child {
                        break-inside: avoid;
                        page-break-inside: avoid;
                    }
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                    tr, td, th { page-break-inside: avoid; break-inside: avoid; }
                }

                .report-unit-header {
                    background: #f8fafc;
                    border: 1px solid #cbd5e1;
                    border-left: 6px solid #0f172a;
                    border-radius: 10px;
                    padding: 12px 14px;
                    margin-bottom: 14px;
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
                .report-collection-panel {
                    margin-bottom: 16px;
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

                .report-table {
                    border-radius: 10px;
                    border-color: #cbd5e1;
                    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
                    break-before: avoid;
                    page-break-before: avoid;
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

                .report-emission-box span {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                }

                .report-emission-box strong {
                    color: #0f172a;
                    font-size: 12px;
                }

                .report-chart {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
                    padding: 12px;
                    break-inside: avoid;
                    page-break-inside: avoid;
                    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
                }

                .report-chart-title {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    color: #0f172a;
                    font-size: 11px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    margin-bottom: 10px;
                }

                .report-chart-rows {
                    display: flex;
                    flex-direction: column;
                    gap: 7px;
                }

                .report-chart-row {
                    display: grid;
                    grid-template-columns: 28% 1fr 34px;
                    align-items: center;
                    gap: 8px;
                    break-inside: avoid;
                    page-break-inside: avoid;
                }

                .report-chart-label {
                    color: #334155;
                    font-size: 10px;
                    font-weight: 900;
                    line-height: 1.1;
                    text-transform: uppercase;
                    word-break: break-word;
                }

                .report-chart-track {
                    display: block;
                    height: 14px;
                    border-radius: 999px;
                    background: #e2e8f0;
                    overflow: hidden;
                    border: 1px solid #dbe3ee;
                }

                .report-chart-bar {
                    display: block;
                    height: 100%;
                    border-radius: inherit;
                }

                .report-chart-bar-khaki { background: #8a7a3f; }
                .report-chart-bar-emerald { background: #047857; }
                .report-chart-bar-amber { background: #b45309; }
                .report-chart-bar-slate { background: #475569; }

                .report-chart-value {
                    color: #0f172a;
                    font-size: 11px;
                    font-weight: 900;
                    text-align: right;
                }

                .annual-chart-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 10px;
                    margin-top: 8px;
                    margin-bottom: 14px;
                }

                .annual-chart-grid .report-chart {
                    padding: 10px;
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
                    background: #ffffff;
                    color: #0f172a;
                    font-weight: 900;
                    box-shadow: inset 0 -1px 0 rgba(15, 23, 42, 0.08);
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
