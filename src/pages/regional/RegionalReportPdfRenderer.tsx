import { Building2, CalendarDays, ClipboardList, Clock, Layers3, MapPinned, MessageSquareText } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { useAuth, RegionalBriefingField, RegionalBriefingSection } from '../../store/AuthContext';
import { useSettings } from '../../store/SettingsContext';
import { formatBrazilianNumber } from '../../utils/brazilianNumbers';
import { getPublicUploadUrl } from '../../utils/storageUrls';
import {
    type ReportTableHighlightRule,
    type TableRow,
    CURRENT_REPORT_YEAR,
    REPORT_YEARS,
    formatMonthlyPeriod,
    SectionHeader,
    TextSection,
    IconStatCard,
    MetricValue,
    formatCollectionValue,
    isDateOrPeriodField,
    CompactTable,
    getMetricTotal,
    REPORT_PDF_STYLES
} from '../dashboard/components/reportPdfShared';

export type RegionalReportCategoryConfig = {
    topicAssignments?: Record<string, string>;
    categoryOrder?: string[];
    topicOrder?: string[];
    sectionOrder?: string[];
    fieldOrder?: Record<string, string[]>;
    tableHighlights?: ReportTableHighlightRule[];
};

export type RegionalReportPdfProps = {
    regionName: string;
    regionalCommandId: string | null;
    referenceStartDate?: string | null;
    referenceEndDate?: string | null;
    referenceLabel?: string | null;
    selectedSectionIds: string[];
    linkedUnitNames: string[];
    ascomLabel?: string | null;
    fontSize?: 'standard' | 'large';
    showExecutiveSummary?: boolean;
    showSubjectMap?: boolean;
    reportCategoryConfig?: RegionalReportCategoryConfig;
};

const resolveRegionalCalculationSources = (config: any): string[] => {
    if (!config || typeof config !== 'object') return [];
    if (Array.isArray(config.sourceFieldIds)) return config.sourceFieldIds.filter((item: unknown): item is string => typeof item === 'string');
    if (Array.isArray(config.fields)) return config.fields.filter((item: unknown): item is string => typeof item === 'string');
    return [];
};

const calculateRegionalFieldValue = (
    field: RegionalBriefingField,
    sectionFields: RegionalBriefingField[],
    valuesByFieldId: Record<string, { valueText: string | null; valueNumber: number | null } | undefined>
): number | null => {
    if (field.fieldType !== 'calculated' || !field.calculationConfig) return null;

    const sources = resolveRegionalCalculationSources(field.calculationConfig);
    if (sources.length === 0) return null;

    const sourceValues = sources.map(sourceKey => {
        const sourceField = sectionFields.find(item => item.id === sourceKey || item.code === sourceKey);
        if (!sourceField || !['number', 'currency', 'percentage', 'calculated'].includes(sourceField.fieldType)) {
            return 0;
        }
        if (sourceField.fieldType === 'calculated') {
            return calculateRegionalFieldValue(sourceField, sectionFields, valuesByFieldId) ?? 0;
        }
        const stored = valuesByFieldId[sourceField.id];
        return stored?.valueNumber !== null && stored?.valueNumber !== undefined ? Number(stored.valueNumber) : 0;
    });

    const operation = field.calculationConfig.operation;
    if (operation === 'sum') {
        return sourceValues.reduce((acc, val) => acc + val, 0);
    }
    if (operation === 'subtract') {
        if (sourceValues.length === 0) return 0;
        return sourceValues.slice(1).reduce((acc, val) => acc - val, sourceValues[0]);
    }
    return null;
};

const formatRegionalFieldValue = (
    field: RegionalBriefingField,
    sectionFields: RegionalBriefingField[],
    valuesByFieldId: Record<string, { valueText: string | null; valueNumber: number | null } | undefined>
): ReactNode => {
    if (field.fieldType === 'calculated') {
        const calculated = calculateRegionalFieldValue(field, sectionFields, valuesByFieldId);
        if (calculated === null || Number.isNaN(calculated)) return '-';
        if (field.aggregationMethod === 'currency') return formatBrazilianNumber(calculated, true);
        return Number(calculated).toLocaleString('pt-BR');
    }

    const value = valuesByFieldId[field.id];
    if (!value) return '-';

    if (field.fieldType === 'currency') {
        return value.valueNumber !== null && value.valueNumber !== undefined
            ? formatBrazilianNumber(Number(value.valueNumber), true)
            : '-';
    }
    if (field.fieldType === 'percentage') {
        return value.valueNumber !== null && value.valueNumber !== undefined
            ? `${Number(value.valueNumber).toLocaleString('pt-BR')}%`
            : '-';
    }
    if (field.fieldType === 'number') {
        return value.valueNumber !== null && value.valueNumber !== undefined
            ? Number(value.valueNumber).toLocaleString('pt-BR')
            : '-';
    }
    return value.valueText || '-';
};

const toCollectionFieldShape = (field: RegionalBriefingField) => ({
    type: field.fieldType,
    name: field.label
});

const formatRegionalCollectionValue = (field: RegionalBriefingField, value?: { valueText: string | null; valueNumber: number | null; valueJson?: any }) =>
    formatCollectionValue(toCollectionFieldShape(field), value);

const isRegionalTextSection = (fields: RegionalBriefingField[]) =>
    fields.length > 0 && fields.every(field => field.fieldType === 'textarea');

const isNumericRegionalField = (field: RegionalBriefingField) =>
    ['number', 'currency', 'percentage', 'calculated'].includes(field.fieldType);

export default function RegionalReportPdfRenderer({
    regionName,
    regionalCommandId,
    referenceStartDate = null,
    referenceEndDate = null,
    referenceLabel = null,
    selectedSectionIds,
    linkedUnitNames,
    ascomLabel,
    fontSize = 'standard',
    showExecutiveSummary = true,
    showSubjectMap = true,
    reportCategoryConfig
}: RegionalReportPdfProps) {
    const {
        regionalBriefingTopics,
        regionalBriefingSections,
        regionalBriefingFields,
        regionalBriefingEntries,
        regionalBriefingValues,
        regionalBriefingCollectionItems,
        regionalBriefingCollectionValues,
        users
    } = useAuth();
    const { settings } = useSettings();

    const logoUrl = settings?.logo_path ? getPublicUploadUrl(settings.logo_path) : null;
    const showCoverPage = showExecutiveSummary || showSubjectMap;

    const getSectionCategory = (section: RegionalBriefingSection) => {
        const topic = regionalBriefingTopics.find(item => item.id === section.topicId);
        if (section.topicId && reportCategoryConfig?.topicAssignments?.[section.topicId]) {
            return reportCategoryConfig.topicAssignments[section.topicId];
        }
        return topic?.name || section.categoryTitle || 'Geral';
    };

    const getSectionOrderIndex = (sectionId: string) => {
        const index = reportCategoryConfig?.sectionOrder?.indexOf(sectionId) ?? -1;
        return index >= 0 ? index : 9999;
    };

    const selectedSections = regionalBriefingSections
        .filter(section => section.isActive && selectedSectionIds.includes(section.id))
        .sort((a, b) => getSectionOrderIndex(a.id) - getSectionOrderIndex(b.id) || a.categoryOrder - b.categoryOrder || a.orderIndex - b.orderIndex);

    const baseReportCategories = Array.from(new Set(selectedSections.map(section => getSectionCategory(section))));
    const reportCategories = reportCategoryConfig?.categoryOrder?.length
        ? [
            ...reportCategoryConfig.categoryOrder.filter(category => baseReportCategories.includes(category)),
            ...baseReportCategories.filter(category => !reportCategoryConfig.categoryOrder?.includes(category))
        ]
        : baseReportCategories.sort((a, b) => {
            const orderA = selectedSections.find(section => getSectionCategory(section) === a)?.categoryOrder ?? 999;
            const orderB = selectedSections.find(section => getSectionCategory(section) === b)?.categoryOrder ?? 999;
            return orderA - orderB || a.localeCompare(b, 'pt-BR');
        });

    const getTableHighlights = (sectionId?: string) =>
        sectionId ? (reportCategoryConfig?.tableHighlights ?? []).filter(rule => rule.groupId === sectionId) : [];

    const commandEntries = regionalCommandId
        ? regionalBriefingEntries.filter(entry => entry.regionalCommandId === regionalCommandId)
        : [];

    const commandCollections = regionalCommandId
        ? regionalBriefingCollectionItems.filter(item =>
            item.regionalCommandId === regionalCommandId && item.status !== 'archived'
        )
        : [];

    const filterByPeriod = Boolean(referenceStartDate && referenceEndDate);

    const periodEntries = useMemo(() => {
        const scopedEntries = commandEntries.filter(entry => selectedSectionIds.includes(entry.sectionId));

        if (filterByPeriod) {
            return scopedEntries.filter(entry =>
                entry.referenceStartDate === referenceStartDate
                && entry.referenceEndDate === referenceEndDate
            );
        }

        const latestBySection = new Map<string, typeof commandEntries[number]>();
        scopedEntries.forEach(entry => {
            const existing = latestBySection.get(entry.sectionId);
            if (!existing || new Date(entry.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
                latestBySection.set(entry.sectionId, entry);
            }
        });
        return Array.from(latestBySection.values());
    }, [commandEntries, filterByPeriod, referenceEndDate, referenceStartDate, selectedSectionIds]);

    const periodCollections = useMemo(() => {
        const scopedCollections = commandCollections.filter(item => selectedSectionIds.includes(item.sectionId));

        if (filterByPeriod) {
            return scopedCollections.filter(item =>
                item.referenceStartDate === referenceStartDate
                && item.referenceEndDate === referenceEndDate
            );
        }

        return scopedCollections;
    }, [commandCollections, filterByPeriod, referenceEndDate, referenceStartDate, selectedSectionIds]);

    const getFieldsForSection = (sectionId: string) => {
        const configuredOrder = reportCategoryConfig?.fieldOrder?.[sectionId] ?? [];
        const getConfiguredIndex = (fieldId: string) => {
            const index = configuredOrder.indexOf(fieldId);
            return index >= 0 ? index : 9999;
        };

        return regionalBriefingFields
            .filter(field => field.sectionId === sectionId && field.isActive)
            .sort((a, b) => getConfiguredIndex(a.id) - getConfiguredIndex(b.id) || a.orderIndex - b.orderIndex);
    };

    const getValuesByFieldId = (entryId?: string) => {
        if (!entryId) return {} as Record<string, { valueText: string | null; valueNumber: number | null } | undefined>;
        return regionalBriefingValues
            .filter(value => value.entryId === entryId)
            .reduce((acc, value) => {
                acc[value.fieldId] = value;
                return acc;
            }, {} as Record<string, { valueText: string | null; valueNumber: number | null } | undefined>);
    };

    const getCollectionValuesByFieldId = (itemId: string) => regionalBriefingCollectionValues
        .filter(value => value.itemId === itemId)
        .reduce((acc, value) => {
            acc[value.fieldId] = value;
            return acc;
        }, {} as Record<string, { valueText: string | null; valueNumber: number | null; valueJson?: any } | undefined>);

    const executiveSummary = useMemo(() => {
        const selectedUpdates = [
            ...periodEntries.map(entry => ({ updatedAt: entry.updatedAt, updatedBy: entry.updatedBy })),
            ...periodCollections.map(item => ({ updatedAt: item.updatedAt, updatedBy: item.updatedBy }))
        ].filter(item => item.updatedAt);

        const latestUpdate = selectedUpdates
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
        const latestUpdateDate = latestUpdate ? new Date(latestUpdate.updatedAt) : null;
        const latestUpdateUser = latestUpdate?.updatedBy
            ? users.find(item => item.id === latestUpdate.updatedBy)?.name || null
            : null;

        return {
            date: new Date().toLocaleDateString('pt-BR'),
            time: new Date().toLocaleTimeString('pt-BR'),
            sectionsCount: selectedSections.length,
            totalRegistros: periodEntries.length,
            totalOcorrencias: periodCollections.length,
            unitsCount: linkedUnitNames.length,
            lastUpdate: latestUpdateDate ? {
                date: latestUpdateDate.toLocaleDateString('pt-BR'),
                time: latestUpdateDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                author: latestUpdateUser || 'Responsável não identificado'
            } : null
        };
    }, [periodEntries, periodCollections, selectedSections.length, linkedUnitNames.length, users]);

    const latestCommandUpdate = useMemo(() => {
        const entrySource = filterByPeriod
            ? periodEntries
            : commandEntries.filter(entry => selectedSectionIds.includes(entry.sectionId));
        const collectionSource = filterByPeriod
            ? periodCollections
            : commandCollections.filter(item => selectedSectionIds.includes(item.sectionId));

        const updates = [
            ...entrySource.map(entry => ({ updatedAt: entry.updatedAt, updatedBy: entry.updatedBy })),
            ...collectionSource.map(item => ({ updatedAt: item.updatedAt, updatedBy: item.updatedBy }))
        ].filter(item => item.updatedAt)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        const latest = updates[0];
        if (!latest) return null;

        return {
            date: new Date(latest.updatedAt),
            author: latest.updatedBy
                ? users.find(item => item.id === latest.updatedBy)?.name || 'Responsável não identificado'
                : 'Responsável não identificado'
        };
    }, [commandCollections, commandEntries, filterByPeriod, periodCollections, periodEntries, selectedSectionIds, users]);

    const renderSnapshotSection = (section: RegionalBriefingSection) => {
        const sectionFields = getFieldsForSection(section.id);
        const printableFields = sectionFields.filter(field => field.fieldType !== 'date');

        if (isRegionalTextSection(printableFields)) {
            const entry = periodEntries.find(item => item.sectionId === section.id);
            const valuesByField = getValuesByFieldId(entry?.id);
            const values = printableFields
                .map(field => formatRegionalFieldValue(field, sectionFields, valuesByField))
                .filter(value => value !== '-');

            return <TextSection key={section.id} title={section.title} values={values} />;
        }

        if (section.updateFrequency === 'yearly') {
            const entriesByYear = new Map(
                commandEntries
                    .filter(entry => entry.sectionId === section.id && entry.referenceStartDate?.endsWith('-01-01') && entry.referenceEndDate?.endsWith('-12-31'))
                    .map(entry => [entry.referenceStartDate!.slice(0, 4), entry])
            );
            const legacyEntry = periodEntries.find(entry => entry.sectionId === section.id);
            const currentYear = String(CURRENT_REPORT_YEAR);
            if (legacyEntry && !entriesByYear.has(currentYear)) {
                entriesByYear.set(currentYear, legacyEntry);
            }

            const showTotalColumn = printableFields.some(isNumericRegionalField);
            const hasCurrencyValues = printableFields.some(field => field.fieldType === 'currency');
            const headers = showTotalColumn
                ? ['Indicador', ...REPORT_YEARS.map(year => `Ano ${year}`), 'Total']
                : ['Indicador', ...REPORT_YEARS.map(year => `Ano ${year}`)];

            const rows: TableRow[] = [
                { type: 'section', label: section.title, groupId: section.id },
                ...printableFields.map(field => {
                    const valuesByYear = Object.fromEntries(
                        REPORT_YEARS.map(year => {
                            const entry = entriesByYear.get(year);
                            const valuesByField = getValuesByFieldId(entry?.id);
                            return [year, formatRegionalFieldValue(field, sectionFields, valuesByField)];
                        })
                    );
                    const total = showTotalColumn && isNumericRegionalField(field)
                        ? getMetricTotal(valuesByYear, REPORT_YEARS, field.fieldType === 'currency')
                        : '-';

                    return [
                        field.label,
                        ...REPORT_YEARS.map(year => <MetricValue key={`${field.id}-${year}`} value={valuesByYear[year] ?? '-'} label={field.label} />),
                        ...(showTotalColumn ? [<MetricValue key={`${field.id}-total`} value={total} label={field.label} />] : [])
                    ];
                })
            ];

            return (
                <div key={section.id} className="report-metric-panel break-inside-avoid">
                    <CompactTable
                        headers={headers}
                        rows={rows}
                        colWidths={headers.map((_, index) => {
                            if (hasCurrencyValues) {
                                const valueColumnWidth = 84 / (headers.length - 1);
                                return index === 0 ? '16%' : `${valueColumnWidth.toFixed(2)}%`;
                            }
                            if (index === 0) return '30%';
                            if (showTotalColumn && index === headers.length - 1) return '22%';
                            return `${Math.floor((showTotalColumn ? 48 : 70) / REPORT_YEARS.length)}%`;
                        })}
                        variant="metrics"
                        financial={hasCurrencyValues}
                        highlightRules={getTableHighlights(section.id)}
                    />
                </div>
            );
        }

        if (section.updateFrequency === 'monthly') {
            const entriesByMonth = new Map(
                commandEntries
                    .filter(entry => entry.sectionId === section.id && entry.referenceStartDate && entry.referenceEndDate)
                    .map(entry => [`${entry.referenceStartDate!.slice(0, 7)}`, entry])
            );
            const periods = Array.from(entriesByMonth.keys()).sort();
            if (periods.length === 0 && periodEntries.some(entry => entry.sectionId === section.id)) {
                const currentEntry = periodEntries.find(entry => entry.sectionId === section.id);
                if (currentEntry?.referenceStartDate) {
                    entriesByMonth.set(currentEntry.referenceStartDate.slice(0, 7), currentEntry);
                }
            }
            const monthPeriods = Array.from(entriesByMonth.keys()).sort();
            const showTotalColumn = printableFields.some(isNumericRegionalField);
            const hasCurrencyValues = printableFields.some(field => field.fieldType === 'currency');
            const headers = monthPeriods.length > 1
                ? ['Indicador', ...monthPeriods.map(period => formatMonthlyPeriod(period)), ...(showTotalColumn ? ['Total'] : [])]
                : ['Indicador', 'Total'];

            const rows: TableRow[] = [
                { type: 'section', label: section.title, groupId: section.id },
                ...printableFields.map(field => {
                    if (monthPeriods.length <= 1) {
                        const entry = monthPeriods.length === 1
                            ? entriesByMonth.get(monthPeriods[0])
                            : periodEntries.find(item => item.sectionId === section.id);
                        const valuesByField = getValuesByFieldId(entry?.id);
                        const value = formatRegionalFieldValue(field, sectionFields, valuesByField);
                        return [field.label, <MetricValue key={`${field.id}-total`} value={value} label={field.label} />];
                    }

                    const valuesByPeriod = Object.fromEntries(
                        monthPeriods.map(period => {
                            const entry = entriesByMonth.get(period);
                            const valuesByField = getValuesByFieldId(entry?.id);
                            return [period, formatRegionalFieldValue(field, sectionFields, valuesByField)];
                        })
                    );
                    const total = showTotalColumn && isNumericRegionalField(field)
                        ? getMetricTotal(valuesByPeriod, monthPeriods, field.fieldType === 'currency')
                        : '-';

                    return [
                        field.label,
                        ...monthPeriods.map(period => <MetricValue key={`${field.id}-${period}`} value={valuesByPeriod[period] ?? '-'} label={field.label} />),
                        ...(showTotalColumn ? [<MetricValue key={`${field.id}-total`} value={total} label={field.label} />] : [])
                    ];
                })
            ];

            return (
                <div key={section.id} className="report-metric-panel break-inside-avoid">
                    <CompactTable
                        headers={headers}
                        rows={rows}
                        colWidths={headers.map((_, index) => index === 0 ? (monthPeriods.length > 1 ? '30%' : '34%') : monthPeriods.length > 1 ? `${Math.floor(70 / Math.max(monthPeriods.length + (showTotalColumn ? 1 : 0), 1))}%` : '66%')}
                        variant="metrics"
                        financial={hasCurrencyValues}
                        highlightRules={getTableHighlights(section.id)}
                    />
                </div>
            );
        }

        const entry = periodEntries.find(item => item.sectionId === section.id);
        const valuesByField = getValuesByFieldId(entry?.id);
        const rows: TableRow[] = [
            { type: 'section', label: section.title, groupId: section.id },
            ...printableFields.map(field => [
                field.label,
                <MetricValue
                    key={`${field.id}-value`}
                    value={formatRegionalFieldValue(field, sectionFields, valuesByField)}
                    label={field.label}
                />
            ])
        ];

        return (
            <div key={section.id} className="report-metric-panel break-inside-avoid">
                <CompactTable
                    headers={['Indicador', 'Total']}
                    rows={rows}
                    colWidths={['34%', '66%']}
                    variant="metrics"
                    financial={printableFields.some(field => field.fieldType === 'currency')}
                    highlightRules={getTableHighlights(section.id)}
                />
            </div>
        );
    };

    const renderCollectionSection = (section: RegionalBriefingSection) => {
        const sectionFields = getFieldsForSection(section.id);
        const items = periodCollections
            .filter(item => item.sectionId === section.id)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        if (items.length === 0) return null;

        const rows: TableRow[] = [
            { type: 'section', label: section.title, groupId: section.id },
            ...items.map(item => {
                const valuesByField = getCollectionValuesByFieldId(item.id);
                const textValues = sectionFields
                    .filter(field => field.fieldType === 'text' || field.fieldType === 'textarea')
                    .map(field => ({ field, value: valuesByField[field.id] }));
                const datePeriodValues = textValues.filter(({ field }) => isDateOrPeriodField(field.label));
                const titleValue = textValues.find(({ field, value }) => !isDateOrPeriodField(field.label) && value?.valueText);
                const datePeriodLabel = datePeriodValues
                    .map(({ field, value }) => {
                        const formatted = formatRegionalCollectionValue(field, value);
                        return formatted ? `${field.label}: ${formatted}` : null;
                    })
                    .filter(Boolean)
                    .join(' | ');
                const detailLabel = sectionFields
                    .map(field => {
                        const formatted = formatRegionalCollectionValue(field, valuesByField[field.id]);
                        if (!formatted) return null;
                        return `${field.label}: ${formatted}`;
                    })
                    .filter(Boolean)
                    .join(' | ');

                return [
                    titleValue?.value?.valueText?.toUpperCase() || 'REGISTRO',
                    datePeriodLabel || '-',
                    detailLabel || 'Sem informações preenchidas.',
                    new Date(item.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                ];
            })
        ];

        return (
            <div key={section.id} className="report-metric-panel break-inside-avoid">
                <CompactTable
                    headers={['Tópico / Ocorrência', 'Data / Período', 'Informações', 'Sinc.']}
                    rows={rows}
                    colWidths={['18%', '18%', '54%', '10%']}
                    variant="metrics"
                    narrative
                    highlightRules={getTableHighlights(section.id)}
                />
            </div>
        );
    };

    return (
        <div className={`report-pdf-root bg-white text-black font-sans w-full print:max-w-none ${fontSize === 'large' ? 'report-font-large' : ''}`}>
            {showCoverPage && (
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
                                {ascomLabel && (
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{ascomLabel}</p>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="block text-xl font-black text-slate-900">{executiveSummary.date}</span>
                            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">RELATÓRIO DE COMANDO</span>
                            {referenceLabel && (
                                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{referenceLabel}</span>
                            )}
                        </div>
                    </div>

                    {showExecutiveSummary && (
                        <div className="mb-5">
                            <SectionHeader title="RESUMO EXECUTIVO" />
                            <div className="executive-stat-grid">
                                <IconStatCard
                                    icon={<Building2 className="w-5 h-5" />}
                                    label="OPMs vinculadas"
                                    value={`${executiveSummary.unitsCount}`}
                                    description="Unidades incluídas no comando regional"
                                    tone="khaki"
                                />
                                <IconStatCard
                                    icon={<Layers3 className="w-5 h-5" />}
                                    label="Seções"
                                    value={`${executiveSummary.sectionsCount}`}
                                    description="Blocos de informação selecionados"
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
                    )}

                    {showSubjectMap && (
                        <div className="mb-5">
                            <SectionHeader title="MAPA DE ASSUNTOS" />
                            <div className="report-reading-map">
                                <div className="report-reading-item">
                                    <strong><MapPinned className="w-3.5 h-3.5" /> {regionName}</strong>
                                    <span>{reportCategories.join(' • ') || 'Sem categoria selecionada'}</span>
                                    {ascomLabel && <em>ASCOM: {ascomLabel}</em>}
                                </div>
                                {linkedUnitNames.map(unitName => (
                                    <div key={unitName} className="report-reading-item">
                                        <strong><Building2 className="w-3.5 h-3.5" /> {unitName}</strong>
                                        <span>OPM vinculada ao comando regional</span>
                                    </div>
                                ))}
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
                        </div>
                    )}

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
                </div>
            )}

            <div className="p-8 space-y-6">
                {reportCategories.map((category, categoryIndex) => {
                    const categorySections = selectedSections.filter(section => getSectionCategory(section) === category);
                    if (categorySections.length === 0) return null;

                    return (
                        <div key={category} className="report-category-block">
                            <div className="report-category-header">
                                <span>{String(categoryIndex + 1).padStart(2, '0')}</span>
                                <div>
                                    <h2>{category}</h2>
                                    <p>{categorySections.length} seção(ões) incluída(s)</p>
                                </div>
                            </div>

                            <div className="unit-section mb-8 break-after-page-avoid">
                                <div className="report-unit-header mb-4">
                                    <div className="report-unit-heading">
                                        <h2 className="text-[15px] font-black text-slate-900 uppercase tracking-tight">{regionName}</h2>
                                        <span className="text-[10px] font-black text-slate-400 italic">PÁGINA DETALHADA</span>
                                    </div>
                                    <div className="report-unit-meta">
                                        {ascomLabel && <span>ASCOM: <strong>{ascomLabel}</strong></span>}
                                        {referenceLabel && <span>Período: <strong>{referenceLabel}</strong></span>}
                                        <span>Última atualização: <strong>{latestCommandUpdate ? latestCommandUpdate.date.toLocaleString('pt-BR') : 'Sem registro'}</strong></span>
                                        <span>Responsável pela atualização: <strong>{latestCommandUpdate?.author || 'Responsável não identificado'}</strong></span>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {categorySections.map(section =>
                                        section.mode === 'collection'
                                            ? renderCollectionSection(section)
                                            : renderSnapshotSection(section)
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <style>{REPORT_PDF_STYLES}</style>
        </div>
    );
}
