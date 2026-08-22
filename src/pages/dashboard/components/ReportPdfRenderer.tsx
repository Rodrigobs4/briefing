import { useAuth, calculateFieldValue } from '../../../store/AuthContext';
import { useSettings } from '../../../store/SettingsContext';
import { formatBrazilianNumber } from '../../../utils/brazilianNumbers';
import { getPublicUploadUrl } from '../../../utils/storageUrls';
import { Building2, CalendarDays, ClipboardList, Clock, Layers3, MapPinned, MessageSquareText } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import {
    type ReportTableHighlightRule,
    type TableRow,
    type RawMetricRow,
    CURRENT_REPORT_YEAR,
    REPORT_YEARS,
    formatMonthlyPeriod,
    SectionHeader,
    TextSection,
    IconStatCard,
    MetricValue,
    formatCollectionValue,
    isDateOrPeriodField,
    getYearMetricInfo,
    getMetricGroupKey,
    getMetricLabelWithoutYear,
    getYearFromText,
    isExplicitTotalField,
    getCollectionColumnWidths,
    CompactTable,
    getMetricTotal,
    REPORT_PDF_STYLES
} from './reportPdfShared';

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
                                            const hasExplicitTotalField = collectionFields.some(isExplicitTotalField);
                                            const totalFields = collectionFields.filter(field =>
                                                ['number', 'currency', 'calculated'].includes(field.type) && !isExplicitTotalField(field)
                                            );
                                            const showCollectionTotalColumn = group.showTotal && totalFields.length > 0 && !hasExplicitTotalField;
                                            const totalIsCurrency = totalFields.length > 0 && totalFields.every(field => field.type === 'currency');
                                            const getCollectionRawNumber = (itemId: string, field: any) => {
                                                const itemValues = getValuesForItem(itemId);
                                                const value = itemValues.find((itemValue: any) => itemValue.fieldId === field.id);

                                                if (field.type === 'calculated' && (value?.valueNumber === null || value?.valueNumber === undefined)) {
                                                    const allValues = itemValues.reduce((acc: Record<string, any>, curr: any) => {
                                                        acc[curr.fieldId] = curr.valueNumber ?? curr.valueText;
                                                        return acc;
                                                    }, {});
                                                    const calculated = calculateFieldValue(field, allValues, fields, true);
                                                    return calculated !== null && Number.isFinite(calculated) ? calculated : null;
                                                }

                                                const numericValue = Number(value?.valueNumber);
                                                return Number.isFinite(numericValue) ? numericValue : null;
                                            };
                                            const renderCollectionTotal = (itemId: string) => {
                                                const numericValues = totalFields
                                                    .map(field => getCollectionRawNumber(itemId, field))
                                                    .filter((value): value is number => value !== null);
                                                if (numericValues.length === 0) return '-';

                                                const total = numericValues.reduce((sum, value) => sum + value, 0);
                                                return (
                                                    <MetricValue
                                                        key={`${itemId}-collection-total`}
                                                        value={totalIsCurrency ? formatBrazilianNumber(total, true) : total.toLocaleString('pt-BR')}
                                                        label="Total"
                                                    />
                                                );
                                            };

                                            return (
                                                <div key={group.id} className="report-metric-panel break-inside-avoid">
                                                    <CompactTable
                                                        headers={[
                                                            ...collectionFields.map(field => field.name),
                                                            ...(showCollectionTotalColumn ? ['Total'] : [])
                                                        ]}
                                                        rows={[
                                                            { type: 'section' as const, label: group.title, groupId: group.id },
                                                            ...itemsToRender.map(item =>
                                                                [
                                                                    ...collectionFields.map(field => renderCollectionFieldValue(item.id, field)),
                                                                    ...(showCollectionTotalColumn ? [renderCollectionTotal(item.id)] : [])
                                                                ]
                                                            )
                                                        ]}
                                                        colWidths={getCollectionColumnWidths(collectionFields, showCollectionTotalColumn)}
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

            <style>{REPORT_PDF_STYLES}</style>
        </div>
    );
}
