import { useEffect, useMemo, useState } from 'react';
import {
    BarChart3,
    CalendarDays,
    Check,
    ClipboardList,
    Filter,
    FileText,
    History,
    Loader2,
    MapPinned,
    Plus,
    Printer,
    Save,
    Search,
    Square
} from 'lucide-react';
import { useAuth, RegionalBriefingField, RegionalBriefingSection } from '../../store/AuthContext';
import { supabase } from '../../lib/supabase';
import { compareTextPtBr, sortByTextPtBr } from '../../utils/textOrdering';
import { formatBrazilianNumber, formatBrazilianNumericInput, parseBrazilianNumber } from '../../utils/brazilianNumbers';
import { isGeneralBriefingUnit } from '../../utils/generalBriefingUnits';
import RegionalReportBuilderModal from './RegionalReportBuilderModal';
import {
    loadSelectedRegionalCommandId,
    saveSelectedRegionalCommandId
} from './regionalCommandSelectionStorage';
import { getAccessibleRegionalCommands, userCanAccessRegionalCommand } from '../../utils/regionalCommandAccess';

type RegionalUpdateFrequency = 'fixed' | 'weekly' | 'monthly' | 'semester' | 'yearly' | 'custom';
const ALPHABETICAL_UPDATE_FREQUENCIES: RegionalUpdateFrequency[] = ['yearly', 'fixed', 'custom', 'monthly', 'weekly', 'semester'];

const normalizeRegionalKey = (value: string) => value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const parseRegionalNumber = (value: any) => {
    if (value === null || value === undefined || value === '') return null;
    const numeric = parseBrazilianNumber(value);
    return Number.isFinite(numeric) ? numeric : null;
};

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

const currentYearStartIsoDate = () => `${new Date().getFullYear()}-01-01`;

const currentYear = () => new Date().getFullYear();

const addDaysIsoDate = (value: string, days: number) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};

const formatDatePtBr = (value?: string | null) => {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
};

const buildReferenceLabel = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return '';
    if (startDate.slice(0, 4) === endDate.slice(0, 4) && startDate.endsWith('-01-01') && endDate.endsWith('-12-31')) {
        return `Ano de ${startDate.slice(0, 4)}`;
    }
    return `${formatDatePtBr(startDate)} a ${formatDatePtBr(endDate)}`;
};

const daysBetweenInclusive = (startDate?: string | null, endDate?: string | null) => {
    if (!startDate || !endDate) return 0;
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    const start = Date.UTC(startYear, startMonth - 1, startDay);
    const end = Date.UTC(endYear, endMonth - 1, endDay);
    return Math.floor((end - start) / 86400000) + 1;
};

const inferFrequencyFromRange = (startDate?: string | null, endDate?: string | null): RegionalUpdateFrequency => {
    if (!startDate || !endDate) return 'custom';
    if (startDate === '1900-01-01' && endDate === '1900-01-01') return 'fixed';
    if (daysBetweenInclusive(startDate, endDate) === 7) return 'weekly';
    if (startDate.slice(0, 7) === endDate.slice(0, 7) && startDate.endsWith('-01')) {
        const [year, month] = startDate.split('-').map(Number);
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        if (endDate.endsWith(`-${String(lastDay).padStart(2, '0')}`)) return 'monthly';
    }
    if (
        (startDate.endsWith('-01-01') && endDate.endsWith('-06-30')) ||
        (startDate.endsWith('-07-01') && endDate.endsWith('-12-31'))
    ) {
        return 'semester';
    }
    if (startDate.slice(0, 4) === endDate.slice(0, 4) && startDate.endsWith('-01-01') && endDate.endsWith('-12-31')) {
        return 'yearly';
    }
    return 'custom';
};

const getFrequencyLabel = (frequency: RegionalUpdateFrequency) => {
    const labels: Record<RegionalUpdateFrequency, string> = {
        fixed: 'Dados fixos',
        weekly: 'Semanal',
        monthly: 'Mensal',
        semester: 'Semestral',
        yearly: 'Anual',
        custom: 'Personalizado'
    };
    return labels[frequency];
};

const getFrequencyDescription = (frequency: RegionalUpdateFrequency) => {
    const descriptions: Record<RegionalUpdateFrequency, string> = {
        fixed: 'Informações institucionais que mudam raramente.',
        weekly: 'Indicadores e operações de atualização frequente.',
        monthly: 'Dados consolidados por mês.',
        semester: 'Comparativos e ações consolidadas do semestre.',
        yearly: 'Estrutura, efetivo e dados anuais.',
        custom: 'Período livre definido pelo usuário.'
    };
    return descriptions[frequency];
};

const getReferenceRangeByFrequency = (
    frequency: RegionalUpdateFrequency,
    year: number,
    month: number,
    semester: '1' | '2',
    weekStartDate: string,
    customStartDate: string,
    customEndDate: string
) => {
    if (frequency === 'fixed') {
        return { startDate: '1900-01-01', endDate: '1900-01-01', label: 'Dados fixos da região' };
    }

    if (frequency === 'weekly') {
        const endDate = addDaysIsoDate(weekStartDate, 6);
        return { startDate: weekStartDate, endDate, label: `Semana de ${formatDatePtBr(weekStartDate)} a ${formatDatePtBr(endDate)}` };
    }

    if (frequency === 'monthly') {
        const monthLabel = String(month).padStart(2, '0');
        const lastDay = String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0');
        const startDate = `${year}-${monthLabel}-01`;
        const endDate = `${year}-${monthLabel}-${lastDay}`;
        const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
        return { startDate, endDate, label: label.charAt(0).toUpperCase() + label.slice(1) };
    }

    if (frequency === 'semester') {
        const startDate = semester === '1' ? `${year}-01-01` : `${year}-07-01`;
        const endDate = semester === '1' ? `${year}-06-30` : `${year}-12-31`;
        return { startDate, endDate, label: `${semester}º Semestre de ${year}` };
    }

    if (frequency === 'yearly') {
        return { startDate: `${year}-01-01`, endDate: `${year}-12-31`, label: `Ano de ${year}` };
    }

    return { startDate: customStartDate, endDate: customEndDate, label: buildReferenceLabel(customStartDate, customEndDate) };
};

const getRegionalStoredValue = (field: RegionalBriefingField, value?: { valueText: string | null; valueNumber: number | null }) => {
    if (!value) return '';
    if (['number', 'percentage', 'currency'].includes(field.fieldType)) {
        return value.valueNumber !== null && value.valueNumber !== undefined
            ? formatBrazilianNumber(Number(value.valueNumber), field.fieldType === 'currency')
            : '';
    }
    return value.valueText ?? '';
};

const formatRegionalStoredValue = (field: RegionalBriefingField, value?: { valueText: string | null; valueNumber: number | null }) => {
    if (!value) return '-';
    if (field.fieldType === 'currency') {
        return value.valueNumber !== null && value.valueNumber !== undefined
            ? Number(value.valueNumber).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            : '-';
    }
    if (field.fieldType === 'percentage') {
        return value.valueNumber !== null && value.valueNumber !== undefined
            ? `${Number(value.valueNumber).toLocaleString('pt-BR')}%`
            : '-';
    }
    if (field.fieldType === 'number' || field.fieldType === 'calculated') {
        return value.valueNumber !== null && value.valueNumber !== undefined
            ? Number(value.valueNumber).toLocaleString('pt-BR')
            : '-';
    }
    return value.valueText || '-';
};

const buildRegionalValuePayload = (field: RegionalBriefingField, rawValue: string) => {
    const cleanValue = rawValue?.trim() ?? '';
    const numericValue = ['number', 'percentage', 'currency'].includes(field.fieldType)
        ? parseRegionalNumber(cleanValue)
        : null;

    return {
        field_id: field.id,
        value_text: ['number', 'percentage', 'currency'].includes(field.fieldType) ? null : cleanValue || null,
        value_number: ['number', 'percentage', 'currency'].includes(field.fieldType) ? numericValue : null,
        value_json: null
    };
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


type RegionalBriefingProps = {
    mode?: 'full' | 'editor';
};

export default function RegionalBriefing({ mode = 'full' }: RegionalBriefingProps) {
    const isEditorMode = mode === 'editor';
    const {
        units: allUnits,
        user,
        regionalCommands,
        unitRegionalCommands,
        regionalBriefingSections,
        regionalBriefingFields,
        regionalBriefingEntries,
        regionalBriefingValues,
        regionalBriefingCollectionItems,
        regionalBriefingCollectionValues,
        refreshData
    } = useAuth();
    const generalUnits = allUnits.filter(unit => isGeneralBriefingUnit(unit, regionalCommands));
    const visibleUnits = user?.role === 'editor'
        ? generalUnits.filter(unit => (user.unitIds && user.unitIds.length > 0 ? user.unitIds.includes(unit.id) : unit.id === user.unitId))
        : generalUnits;
    const activeRegionalCommands = getAccessibleRegionalCommands(regionalCommands, user);
    const legacyRegionOptions = Array.from(new Set(visibleUnits.map(unit => unit.regionName?.trim()).filter(Boolean) as string[])).sort(compareTextPtBr);
    const regionOptions = activeRegionalCommands.length > 0
        ? activeRegionalCommands.map(command => command.name).sort(compareTextPtBr)
        : legacyRegionOptions;
    const [selectedRegion, setSelectedRegion] = useState(regionOptions[0] || 'Todas as regiões');
    const [hasLoadedSavedCommand, setHasLoadedSavedCommand] = useState(false);
    const [selectedSections, setSelectedSections] = useState<string[]>([]);
    const [activeUpdateFrequency, setActiveUpdateFrequency] = useState<RegionalUpdateFrequency>('weekly');
    const [periodYear, setPeriodYear] = useState(currentYear());
    const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1);
    const [periodSemester, setPeriodSemester] = useState<'1' | '2'>('1');
    const [weekStartDate, setWeekStartDate] = useState(todayIsoDate());
    const [customStartDate, setCustomStartDate] = useState(currentYearStartIsoDate());
    const [customEndDate, setCustomEndDate] = useState(todayIsoDate());
    const [sectionFilterSearch, setSectionFilterSearch] = useState('');
    const [historyFilterSearch, setHistoryFilterSearch] = useState('');
    const [historyFrequencyFilter, setHistoryFrequencyFilter] = useState<'all' | RegionalUpdateFrequency>('all');
    const [draftValues, setDraftValues] = useState<Record<string, Record<string, string>>>({});
    const [collectionDraftValues, setCollectionDraftValues] = useState<Record<string, Record<string, string>>>({});
    const [savingSectionId, setSavingSectionId] = useState<string | null>(null);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [activeRegionalTab, setActiveRegionalTab] = useState<'overview' | 'history' | 'fill' | 'preview'>('fill');
    const [activeFillCategory, setActiveFillCategory] = useState<string>('');
    const [activeRegionalSectionId, setActiveRegionalSectionId] = useState<string | null>(null);
    const [isReportBuilderOpen, setIsReportBuilderOpen] = useState(false);

    useEffect(() => {
        if (hasLoadedSavedCommand || activeRegionalCommands.length === 0) return;
        const savedCommandId = loadSelectedRegionalCommandId();
        const savedCommand = savedCommandId
            ? activeRegionalCommands.find(command => command.id === savedCommandId)
            : null;
        if (savedCommand) {
            setSelectedRegion(savedCommand.name);
        }
        setHasLoadedSavedCommand(true);
    }, [activeRegionalCommands, hasLoadedSavedCommand]);

    useEffect(() => {
        if (selectedRegion === 'Todas as regiões' && regionOptions.length > 0) {
            setSelectedRegion(regionOptions[0]);
            return;
        }
        if (selectedRegion !== 'Todas as regiões' && !regionOptions.includes(selectedRegion)) {
            setSelectedRegion(regionOptions[0] || 'Todas as regiões');
        }
    }, [regionOptions, selectedRegion]);

    const handleSelectedRegionChange = (regionName: string) => {
        setSelectedRegion(regionName);
        setSelectedSections([]);
        const command = activeRegionalCommands.find(item => item.name === regionName);
        if (command) {
            saveSelectedRegionalCommandId(command.id);
        }
    };

    const unitsForRegion = useMemo(() => {
        let source = visibleUnits;

        if (activeRegionalCommands.length > 0) {
            const selectedCommand = activeRegionalCommands.find(command => command.name === selectedRegion);
            const activeLinks = unitRegionalCommands.filter(link => link.isActive && !link.endedAt);

            if (selectedRegion === 'Todas as regiões') {
                const linkedUnitIds = new Set(activeLinks.map(link => link.unitId));
                source = visibleUnits.filter(unit => linkedUnitIds.has(unit.id));
            } else if (selectedCommand) {
                const linkedUnitIds = new Set(
                    activeLinks
                        .filter(link => link.regionalCommandId === selectedCommand.id)
                        .map(link => link.unitId)
                );
                source = visibleUnits.filter(unit => linkedUnitIds.has(unit.id));
            } else {
                source = [];
            }
        } else {
            source = selectedRegion === 'Todas as regiões'
                ? visibleUnits
                : visibleUnits.filter(unit => unit.regionName?.trim() === selectedRegion);
        }

        return sortByTextPtBr(source, unit => unit.name);
    }, [activeRegionalCommands, unitRegionalCommands, visibleUnits, selectedRegion]);

    const unitIds = unitsForRegion.map(unit => unit.id);
    const catalogSections = regionalBriefingSections
        .filter(section => section.isActive)
        .sort((a, b) => a.categoryOrder - b.categoryOrder || a.orderIndex - b.orderIndex);
    const selectedCommand = activeRegionalCommands.find(command => command.name === selectedRegion) ?? null;
    const referenceRange = getReferenceRangeByFrequency(activeUpdateFrequency, periodYear, periodMonth, periodSemester, weekStartDate, customStartDate, customEndDate);
    const referenceStartDate = referenceRange.startDate;
    const referenceEndDate = referenceRange.endDate;
    const referenceLabel = referenceRange.label;
    const snapshotSections = catalogSections.filter(section => section.mode === 'snapshot');
    const collectionSections = catalogSections.filter(section => section.mode === 'collection');
    const frequencySections = catalogSections.filter(section => (section.updateFrequency ?? 'custom') === activeUpdateFrequency);
    const fillCategories = Array.from(new Set(frequencySections.map(section => section.categoryTitle))).filter(Boolean).sort(compareTextPtBr);
    const selectedFillCategory = activeFillCategory || fillCategories[0] || '';
    const normalizedSectionFilter = normalizeRegionalKey(sectionFilterSearch);
    const matchesSectionFilter = (section: RegionalBriefingSection) => {
        if (!normalizedSectionFilter) return true;
        return normalizeRegionalKey(`${section.title} ${section.categoryTitle}`).includes(normalizedSectionFilter);
    };
    const visibleSnapshotSections = snapshotSections.filter(section =>
        (section.updateFrequency ?? 'custom') === activeUpdateFrequency
        && (!selectedFillCategory || section.categoryTitle === selectedFillCategory)
        && matchesSectionFilter(section)
    );
    const visibleCollectionSections = collectionSections.filter(section =>
        (section.updateFrequency ?? 'custom') === activeUpdateFrequency
        && (!selectedFillCategory || section.categoryTitle === selectedFillCategory)
        && matchesSectionFilter(section)
    );
    const visibleRegionalSections = [...visibleSnapshotSections, ...visibleCollectionSections]
        .sort((a, b) => a.categoryOrder - b.categoryOrder || a.orderIndex - b.orderIndex);
    const activeRegionalSection = visibleRegionalSections.find(section => section.id === activeRegionalSectionId) ?? visibleRegionalSections[0] ?? null;
    const selectedSectionIds = selectedSections.length > 0
        ? selectedSections.filter(id => catalogSections.some(section => section.id === id))
        : catalogSections.map(section => section.id);
    const isPrintable = Boolean(selectedCommand)
        && Boolean(referenceStartDate)
        && Boolean(referenceEndDate)
        && referenceEndDate >= referenceStartDate
        && selectedSectionIds.length > 0;

    const regionalHistoryItems = useMemo(() => {
        if (!selectedCommand) return [];

        const sectionTitleById = new Map(catalogSections.map(section => [section.id, section.title]));
        const items = new Map<string, {
            key: string;
            label: string;
            startDate: string;
            endDate: string;
            frequency: RegionalUpdateFrequency;
            snapshotCount: number;
            collectionCount: number;
            updatedAt: string;
            sectionTitles: Set<string>;
        }>();

        const ensureItem = (startDate?: string | null, endDate?: string | null, label?: string | null) => {
            if (!startDate || !endDate) return null;
            const key = `${startDate}|${endDate}`;
            const current = items.get(key) ?? {
                key,
                label: label || buildReferenceLabel(startDate, endDate),
                startDate,
                endDate,
                frequency: inferFrequencyFromRange(startDate, endDate),
                snapshotCount: 0,
                collectionCount: 0,
                updatedAt: '',
                sectionTitles: new Set<string>()
            };
            items.set(key, current);
            return current;
        };

        regionalBriefingEntries
            .filter(entry => entry.regionalCommandId === selectedCommand.id)
            .forEach(entry => {
                const item = ensureItem(entry.referenceStartDate, entry.referenceEndDate, entry.referenceLabel);
                if (!item) return;
                item.snapshotCount += 1;
                item.updatedAt = item.updatedAt && item.updatedAt > entry.updatedAt ? item.updatedAt : entry.updatedAt;
                item.sectionTitles.add(sectionTitleById.get(entry.sectionId) || 'Seção');
            });

        regionalBriefingCollectionItems
            .filter(item => item.regionalCommandId === selectedCommand.id && item.status !== 'archived')
            .forEach(collectionItem => {
                const item = ensureItem(collectionItem.referenceStartDate, collectionItem.referenceEndDate, collectionItem.referenceLabel);
                if (!item) return;
                item.collectionCount += 1;
                item.updatedAt = item.updatedAt && item.updatedAt > collectionItem.updatedAt ? item.updatedAt : collectionItem.updatedAt;
                item.sectionTitles.add(sectionTitleById.get(collectionItem.sectionId) || 'Registros');
            });

        const normalizedHistoryFilter = normalizeRegionalKey(historyFilterSearch);

        return Array.from(items.values())
            .filter(item => historyFrequencyFilter === 'all' || item.frequency === historyFrequencyFilter)
            .filter(item => {
                if (!normalizedHistoryFilter) return true;
                return normalizeRegionalKey(`${item.label} ${Array.from(item.sectionTitles).join(' ')}`).includes(normalizedHistoryFilter);
            })
            .sort((a, b) => {
                if (a.startDate === '1900-01-01') return 1;
                if (b.startDate === '1900-01-01') return -1;
                return b.startDate.localeCompare(a.startDate) || b.updatedAt.localeCompare(a.updatedAt);
            });
    }, [
        selectedCommand,
        catalogSections,
        regionalBriefingEntries,
        regionalBriefingCollectionItems,
        historyFilterSearch,
        historyFrequencyFilter
    ]);

    useEffect(() => {
        if (fillCategories.length > 0 && (!activeFillCategory || !fillCategories.includes(activeFillCategory))) {
            setActiveFillCategory(fillCategories[0]);
        }
    }, [activeFillCategory, fillCategories]);

    useEffect(() => {
        if (visibleRegionalSections.length > 0 && (!activeRegionalSectionId || !visibleRegionalSections.some(section => section.id === activeRegionalSectionId))) {
            setActiveRegionalSectionId(visibleRegionalSections[0].id);
        }
    }, [activeRegionalSectionId, visibleRegionalSections]);

    const applyHistoryPeriod = (item: { frequency: RegionalUpdateFrequency; startDate: string; endDate: string }) => {
        setActiveUpdateFrequency(item.frequency);
        setSectionFilterSearch('');
        setActiveFillCategory('');

        if (item.frequency === 'weekly') {
            setWeekStartDate(item.startDate);
        } else if (item.frequency === 'monthly') {
            setPeriodYear(Number(item.startDate.slice(0, 4)));
            setPeriodMonth(Number(item.startDate.slice(5, 7)));
        } else if (item.frequency === 'semester') {
            setPeriodYear(Number(item.startDate.slice(0, 4)));
            setPeriodSemester(item.startDate.endsWith('-01-01') ? '1' : '2');
        } else if (item.frequency === 'yearly') {
            setPeriodYear(Number(item.startDate.slice(0, 4)));
        } else if (item.frequency === 'custom') {
            setCustomStartDate(item.startDate);
            setCustomEndDate(item.endDate);
        }

        setActiveRegionalTab('fill');
    };

    const toggleSection = (sectionId: string) => {
        setSelectedSections(prev => {
            const current = prev.length > 0 ? prev : catalogSections.map(section => section.id);
            return current.includes(sectionId) ? current.filter(id => id !== sectionId) : [...current, sectionId];
        });
    };

    const getFieldsForSection = (sectionId: string) => regionalBriefingFields
        .filter(field => field.sectionId === sectionId && field.isActive)
        .sort((a, b) => a.orderIndex - b.orderIndex);

    const findSnapshotEntry = (sectionId: string) => {
        if (!selectedCommand) return undefined;
        return regionalBriefingEntries.find(entry =>
            entry.regionalCommandId === selectedCommand.id
            && entry.sectionId === sectionId
            && entry.referenceStartDate === referenceStartDate
            && entry.referenceEndDate === referenceEndDate
        );
    };

    const getSnapshotValue = (sectionId: string, field: RegionalBriefingField) => {
        const draft = draftValues[sectionId]?.[field.id];
        if (draft !== undefined && field.fieldType !== 'calculated') return draft;
        const entry = findSnapshotEntry(sectionId);
        const sectionFields = getFieldsForSection(sectionId);
        const valuesByFieldId = entry
            ? regionalBriefingValues
                .filter(value => value.entryId === entry.id)
                .reduce((acc, value) => {
                    acc[value.fieldId] = value;
                    return acc;
                }, {} as Record<string, { valueText: string | null; valueNumber: number | null } | undefined>)
            : {};

        // Overlay draft edits so calculated fields update live while filling.
        const sectionDraft = draftValues[sectionId] ?? {};
        Object.entries(sectionDraft).forEach(([fieldId, rawValue]) => {
            const sourceField = sectionFields.find(item => item.id === fieldId);
            if (!sourceField || sourceField.fieldType === 'calculated') return;
            if (['number', 'percentage', 'currency'].includes(sourceField.fieldType)) {
                valuesByFieldId[fieldId] = {
                    valueText: null,
                    valueNumber: parseRegionalNumber(rawValue)
                };
            } else {
                valuesByFieldId[fieldId] = {
                    valueText: rawValue || null,
                    valueNumber: null
                };
            }
        });

        if (field.fieldType === 'calculated') {
            const calculated = calculateRegionalFieldValue(field, sectionFields, valuesByFieldId);
            return calculated === null ? '' : formatBrazilianNumber(calculated, false);
        }

        const storedValue = valuesByFieldId[field.id];
        return getRegionalStoredValue(field, storedValue);
    };

    const updateSnapshotDraft = (sectionId: string, fieldId: string, value: string) => {
        setDraftValues(prev => ({
            ...prev,
            [sectionId]: {
                ...(prev[sectionId] ?? {}),
                [fieldId]: value
            }
        }));
    };

    const updateCollectionDraft = (sectionId: string, fieldId: string, value: string) => {
        setCollectionDraftValues(prev => ({
            ...prev,
            [sectionId]: {
                ...(prev[sectionId] ?? {}),
                [fieldId]: value
            }
        }));
    };

    const requireRegionalContext = () => {
        if (!selectedCommand) {
            setSaveMessage({ type: 'error', text: 'Selecione um Comando Regional específico antes de salvar.' });
            return false;
        }
        if (!userCanAccessRegionalCommand(user, selectedCommand.id)) {
            setSaveMessage({ type: 'error', text: 'Você não tem permissão para editar este Comando Regional.' });
            return false;
        }
        if (!referenceStartDate || !referenceEndDate || referenceEndDate < referenceStartDate) {
            setSaveMessage({ type: 'error', text: 'Informe um período válido para o lançamento.' });
            return false;
        }
        if (!user?.id) {
            setSaveMessage({ type: 'error', text: 'Usuário não identificado para gravar o lançamento.' });
            return false;
        }
        return true;
    };

    const saveSnapshotSection = async (section: RegionalBriefingSection) => {
        if (!requireRegionalContext() || !selectedCommand || !user?.id) return;
        setSavingSectionId(section.id);
        setSaveMessage(null);

        try {
            const fieldsForSection = getFieldsForSection(section.id).filter(field => field.fieldType !== 'calculated');
            const { data: existingEntry, error: findError } = await supabase
                .from('regional_briefing_entries')
                .select('id')
                .eq('regional_command_id', selectedCommand.id)
                .eq('section_id', section.id)
                .eq('reference_start_date', referenceStartDate)
                .eq('reference_end_date', referenceEndDate)
                .maybeSingle();

            if (findError) throw findError;

            const entryPayload = {
                regional_command_id: selectedCommand.id,
                section_id: section.id,
                reference_label: referenceLabel,
                reference_start_date: referenceStartDate,
                reference_end_date: referenceEndDate,
                updated_by: user.id
            };

            const { data: entry, error: entryError } = existingEntry
                ? await supabase.from('regional_briefing_entries').update(entryPayload).eq('id', existingEntry.id).select('id').single()
                : await supabase.from('regional_briefing_entries').insert(entryPayload).select('id').single();

            if (entryError) throw entryError;

            const valuesPayload = fieldsForSection.map(field => ({
                entry_id: entry.id,
                ...buildRegionalValuePayload(field, getSnapshotValue(section.id, field))
            }));

            if (valuesPayload.length > 0) {
                const { error: valuesError } = await supabase
                    .from('regional_briefing_values')
                    .upsert(valuesPayload, { onConflict: 'entry_id, field_id' });
                if (valuesError) throw valuesError;
            }

            setDraftValues(prev => {
                const next = { ...prev };
                delete next[section.id];
                return next;
            });
            await refreshData();
            setSaveMessage({ type: 'success', text: `${section.title} salvo para ${referenceLabel}.` });
        } catch (error: any) {
            console.error('Erro ao salvar briefing regional:', error);
            setSaveMessage({ type: 'error', text: error?.message || 'Não foi possível salvar esta seção.' });
        } finally {
            setSavingSectionId(null);
        }
    };

    const addCollectionItem = async (section: RegionalBriefingSection) => {
        if (!requireRegionalContext() || !selectedCommand || !user?.id) return;
        setSavingSectionId(section.id);
        setSaveMessage(null);

        try {
            const fieldsForSection = getFieldsForSection(section.id).filter(field => field.fieldType !== 'calculated');
            const sectionDraft = collectionDraftValues[section.id] ?? {};
            const requiredMissing = fieldsForSection.some(field => field.isRequired && !sectionDraft[field.id]?.trim());
            if (requiredMissing) {
                setSaveMessage({ type: 'error', text: `Preencha os campos obrigatórios de ${section.title}.` });
                return;
            }

            const { data: item, error: itemError } = await supabase
                .from('regional_briefing_collection_items')
                .insert({
                    regional_command_id: selectedCommand.id,
                    section_id: section.id,
                    reference_label: referenceLabel,
                    reference_start_date: referenceStartDate,
                    reference_end_date: referenceEndDate,
                    created_by: user.id,
                    updated_by: user.id,
                    status: 'published'
                })
                .select('id')
                .single();

            if (itemError) throw itemError;

            const valuesPayload = fieldsForSection.map(field => ({
                item_id: item.id,
                ...buildRegionalValuePayload(field, sectionDraft[field.id] ?? '')
            }));

            if (valuesPayload.length > 0) {
                const { error: valuesError } = await supabase
                    .from('regional_briefing_collection_values')
                    .upsert(valuesPayload, { onConflict: 'item_id, field_id' });
                if (valuesError) throw valuesError;
            }

            setCollectionDraftValues(prev => {
                const next = { ...prev };
                delete next[section.id];
                return next;
            });
            await refreshData();
            setSaveMessage({ type: 'success', text: `Registro adicionado em ${section.title} para ${referenceLabel}.` });
        } catch (error: any) {
            console.error('Erro ao adicionar item regional:', error);
            setSaveMessage({ type: 'error', text: error?.message || 'Não foi possível adicionar o registro.' });
        } finally {
            setSavingSectionId(null);
        }
    };

    const collectionItemsForSection = (sectionId: string) => {
        if (!selectedCommand) return [];
        return regionalBriefingCollectionItems.filter(item =>
            item.regionalCommandId === selectedCommand.id
            && item.sectionId === sectionId
            && item.referenceStartDate === referenceStartDate
            && item.referenceEndDate === referenceEndDate
            && item.status !== 'archived'
        );
    };

    const filledSnapshotCount = snapshotSections.filter(section => findSnapshotEntry(section.id)).length;
    const filledCollectionCount = collectionSections.reduce((total, section) => total + collectionItemsForSection(section.id).length, 0);

    if (user?.role === 'editor' && activeRegionalCommands.length === 0) {
        return (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
                <MapPinned className="w-10 h-10 text-amber-600 mx-auto mb-3" />
                <h3 className="text-lg font-black text-amber-900">Nenhum Comando Regional atribuído</h3>
                <p className="text-sm font-medium text-amber-800 mt-2 max-w-lg mx-auto">
                    Solicite ao administrador o acesso ao Comando Regional responsável pelo seu preenchimento.
                </p>
            </div>
        );
    }

    return (
        <div className={isEditorMode ? '' : 'space-y-6'}>
            <div className={isEditorMode ? '' : 'bg-white rounded-2xl border border-pm-secondary/15 shadow-sm p-6'}>
                {!isEditorMode && (
                    <>
                        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
                            <div>
                                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-pm-secondary">
                                    <MapPinned className="w-4 h-4 text-pm-primary" />
                                    Briefing Regional
                                </div>
                                <h2 className="text-3xl font-black text-pm-dark tracking-tight mt-1">Briefing do Comando Regional</h2>
                                <p className="text-sm text-pm-secondary mt-1 max-w-2xl">
                                    Componha o briefing do Comando Regional com os indicadores do catálogo regional, no mesmo fluxo de preenchimento por período e seção.
                                </p>
                            </div>
                            <button
                                onClick={() => setIsReportBuilderOpen(true)}
                                disabled={!isPrintable}
                                className="px-6 py-3 rounded-xl bg-red-600 text-white text-sm font-black shadow-sm hover:bg-red-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Printer className="w-4 h-4" />
                                Gerenciador de impressão
                            </button>
                        </div>

                        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
                            {[
                                { id: 'overview' as const, icon: MapPinned, title: '1. Região', description: 'Escolha o comando regional' },
                                { id: 'history' as const, icon: History, title: '2. Histórico', description: 'Abra um período já salvo' },
                                { id: 'fill' as const, icon: ClipboardList, title: '3. Preencher', description: 'Informe os dados do período' },
                                { id: 'preview' as const, icon: FileText, title: '4. Conferir', description: 'Revise antes de imprimir' }
                            ].map(tab => {
                                const Icon = tab.icon;
                                const isActive = activeRegionalTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveRegionalTab(tab.id)}
                                        className={`rounded-2xl border p-4 text-left transition-all ${isActive ? 'bg-pm-primary text-white border-pm-primary shadow-sm' : 'bg-[#fbfaf6] border-pm-secondary/15 text-pm-dark hover:bg-pm-light'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-pm-primary'}`} />
                                            <strong className="text-sm font-black">{tab.title}</strong>
                                        </div>
                                        <p className={`text-xs font-bold mt-1 ${isActive ? 'text-white/80' : 'text-pm-secondary'}`}>{tab.description}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}

                {activeRegionalTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-[280px,minmax(0,1fr)] gap-5 mt-6">
                    <aside className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-pm-secondary">Comando Regional</label>
                            <select
                                value={selectedRegion}
                                onChange={event => handleSelectedRegionChange(event.target.value)}
                                className="mt-1 w-full border border-pm-secondary/20 rounded-xl px-3 py-3 text-sm font-bold text-pm-dark bg-white outline-none focus:ring-2 focus:ring-pm-primary/20"
                            >
                                <option>Todas as regiões</option>
                                {regionOptions.map(region => (
                                    <option key={region} value={region}>{region}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-pm-light rounded-xl p-3 border border-pm-secondary/10">
                                <span className="text-[9px] font-black text-pm-secondary uppercase">Comandos</span>
                                <strong className="block text-xl text-pm-dark">{activeRegionalCommands.length || regionOptions.length}</strong>
                            </div>
                            <div className="bg-pm-light rounded-xl p-3 border border-pm-secondary/10">
                                <span className="text-[9px] font-black text-pm-secondary uppercase">Seções</span>
                                <strong className="block text-xl text-pm-dark">{selectedSectionIds.length}</strong>
                            </div>
                            <div className="bg-pm-light rounded-xl p-3 border border-pm-secondary/10">
                                <span className="text-[9px] font-black text-pm-secondary uppercase">OPMs</span>
                                <strong className="block text-xl text-pm-dark">{unitIds.length}</strong>
                            </div>
                        </div>
                    </aside>

                    <main className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <section className="border border-pm-secondary/15 rounded-2xl overflow-hidden bg-white">
                            <div className="px-4 py-3 bg-pm-light border-b border-pm-secondary/10 flex items-center gap-2">
                                <ClipboardList className="w-4 h-4 text-pm-primary" />
                                <h3 className="text-sm font-black text-pm-dark uppercase">Fluxo do preenchimento</h3>
                            </div>
                            <div className="p-4 space-y-3">
                                {[
                                    ['Selecione a região', selectedCommand?.name || selectedRegion],
                                    ['Informe o período', referenceLabel || 'Defina data inicial e final'],
                                    ['Preencha por área', `${fillCategories.length || catalogSections.length} áreas do briefing`],
                                    ['Salve cada seção', `${filledSnapshotCount} seção(ões) salvas e ${filledCollectionCount} registro(s)`]
                                ].map(([title, description], index) => (
                                    <div key={title} className="flex gap-3 p-3 rounded-xl border border-pm-secondary/10 bg-[#fbfaf6]">
                                        <span className="w-7 h-7 rounded-full bg-pm-primary text-white text-xs font-black flex items-center justify-center shrink-0">
                                            {index + 1}
                                        </span>
                                        <div>
                                            <p className="text-sm font-black text-pm-dark">{title}</p>
                                            <p className="text-xs text-pm-secondary font-bold mt-0.5">{description}</p>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    onClick={() => setActiveRegionalTab('fill')}
                                    className="w-full mt-1 px-4 py-3 rounded-xl bg-pm-primary text-white text-sm font-black flex items-center justify-center gap-2"
                                >
                                    <ClipboardList className="w-4 h-4" />
                                    Abrir preenchimento
                                </button>
                            </div>
                        </section>

                        <section className="border border-pm-secondary/15 rounded-2xl overflow-hidden bg-white">
                            <div className="px-4 py-3 bg-pm-light border-b border-pm-secondary/10 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-pm-primary" />
                                <h3 className="text-sm font-black text-pm-dark uppercase">Seções incluídas</h3>
                            </div>
                            <div className="p-3 space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar">
                                {catalogSections.map(section => {
                                    const isSelected = selectedSectionIds.includes(section.id);
                                    return (
                                        <button
                                            key={section.id}
                                            onClick={() => toggleSection(section.id)}
                                            className={`w-full p-3 rounded-xl border text-left flex gap-3 transition-colors ${isSelected ? 'bg-pm-primary/10 border-pm-primary/35' : 'bg-white border-pm-secondary/10 hover:bg-pm-light/60'}`}
                                        >
                                            <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 ${isSelected ? 'bg-pm-primary border-pm-primary text-white' : 'border-pm-secondary/30'}`}>
                                                {isSelected ? <Check className="w-3 h-3" /> : <Square className="w-3 h-3 opacity-0" />}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block text-sm font-black text-pm-dark truncate">{section.title}</span>
                                                <span className="block text-[10px] uppercase tracking-wider font-bold text-pm-secondary mt-0.5">
                                                    {section.categoryTitle} • {section.mode === 'collection' ? 'Registros múltiplos' : 'Indicador fixo'}
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })}
                                {catalogSections.length === 0 && (
                                    <p className="text-sm text-pm-secondary text-center py-8">Nenhuma seção cadastrada no catálogo regional.</p>
                                )}
                            </div>
                        </section>
                    </main>
                </div>
                )}

                {activeRegionalTab === 'history' && (
                <div className="mt-6 border border-pm-secondary/15 rounded-2xl overflow-hidden bg-white">
                    <div className="px-5 py-4 border-b border-pm-secondary/10 bg-pm-light/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="w-11 h-11 rounded-2xl bg-pm-primary text-white flex items-center justify-center">
                                <History className="w-5 h-5" />
                            </span>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-pm-secondary">Histórico da região</p>
                                <h3 className="text-lg font-black text-pm-dark">{selectedCommand?.name || selectedRegion}</h3>
                                <p className="text-xs font-bold text-pm-secondary mt-1">Escolha um período já preenchido para continuar editando ou conferir.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-[260px,180px] gap-2">
                            <div className="flex items-center gap-2 rounded-xl border border-pm-secondary/20 bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-pm-primary/20">
                                <Search className="w-4 h-4 text-pm-secondary" />
                                <input
                                    value={historyFilterSearch}
                                    onChange={event => setHistoryFilterSearch(event.target.value)}
                                    placeholder="Buscar período ou seção"
                                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-bold text-pm-dark outline-none placeholder:text-pm-secondary/60"
                                />
                            </div>
                            <select
                                value={historyFrequencyFilter}
                                onChange={event => setHistoryFrequencyFilter(event.target.value as 'all' | RegionalUpdateFrequency)}
                                className="w-full rounded-xl border border-pm-secondary/20 bg-white px-3 py-2.5 text-sm font-bold text-pm-dark outline-none focus:ring-2 focus:ring-pm-primary/20"
                            >
                                <option value="all">Todos os tipos</option>
                                {ALPHABETICAL_UPDATE_FREQUENCIES.map(frequency => (
                                    <option key={frequency} value={frequency}>{getFrequencyLabel(frequency)}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="p-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-3">
                            {regionalHistoryItems.map(item => {
                                const isCurrent = item.startDate === referenceStartDate && item.endDate === referenceEndDate;
                                return (
                                    <button
                                        key={item.key}
                                        onClick={() => applyHistoryPeriod(item)}
                                        className={`rounded-2xl border p-4 text-left transition-colors ${isCurrent ? 'border-pm-primary bg-pm-primary/10' : 'border-pm-secondary/10 bg-[#fbfaf6] hover:bg-pm-light'}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-pm-dark truncate">{item.label}</p>
                                                <p className="text-[10px] font-black uppercase tracking-wider text-pm-secondary mt-1">
                                                    {getFrequencyLabel(item.frequency)}
                                                </p>
                                            </div>
                                            <span className={`text-[10px] font-black rounded-full px-2 py-1 shrink-0 ${isCurrent ? 'bg-pm-primary text-white' : 'bg-white text-pm-secondary border border-pm-secondary/10'}`}>
                                                {isCurrent ? 'Aberto' : 'Abrir'}
                                            </span>
                                        </div>
                                        <div className="mt-4 grid grid-cols-2 gap-2">
                                            <div className="rounded-xl bg-white border border-pm-secondary/10 px-3 py-2">
                                                <span className="block text-[9px] font-black uppercase text-pm-secondary">Seções</span>
                                                <strong className="text-base text-pm-dark">{item.snapshotCount}</strong>
                                            </div>
                                            <div className="rounded-xl bg-white border border-pm-secondary/10 px-3 py-2">
                                                <span className="block text-[9px] font-black uppercase text-pm-secondary">Registros</span>
                                                <strong className="text-base text-pm-dark">{item.collectionCount}</strong>
                                            </div>
                                        </div>
                                        <p className="mt-3 text-xs font-bold text-pm-secondary">
                                            {formatDatePtBr(item.startDate)} a {formatDatePtBr(item.endDate)}
                                        </p>
                                        <p className="mt-1 text-xs font-bold text-pm-secondary line-clamp-2">
                                            {item.sectionTitles.size > 0 ? Array.from(item.sectionTitles).slice(0, 3).join(', ') : 'Sem seções associadas'}
                                        </p>
                                        {item.updatedAt && (
                                            <p className="mt-3 text-[10px] font-bold text-pm-secondary/80">
                                                Atualizado em {new Date(item.updatedAt).toLocaleDateString('pt-BR')}
                                            </p>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {regionalHistoryItems.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-pm-secondary/20 bg-[#fbfaf6] p-8 text-center">
                                <History className="w-8 h-8 text-pm-secondary mx-auto" />
                                <p className="text-sm font-black text-pm-dark mt-3">Nenhum histórico encontrado</p>
                                <p className="text-xs font-bold text-pm-secondary mt-1">Salve uma seção ou adicione um registro para este comando regional.</p>
                            </div>
                        )}
                    </div>
                </div>
                )}

                {activeRegionalTab === 'fill' && (
                <div className={`${isEditorMode ? '' : 'mt-6 '}border border-pm-secondary/15 rounded-2xl overflow-hidden bg-[#fbfaf6]`}>
                    <div className="px-5 py-4 border-b border-pm-secondary/10 bg-white flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-pm-secondary">
                                <CalendarDays className="w-4 h-4 text-pm-primary" />
                                Preenchimento do briefing
                            </div>
                            <h3 className="text-lg font-black text-pm-dark mt-1">Informe os dados da região e do período</h3>
                            <p className="text-xs font-bold text-pm-secondary mt-1">
                                Preencha uma seção por vez e use “Salvar seção” antes de passar para a próxima.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0 xl:min-w-[680px]">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-pm-secondary">Região</label>
                                <select
                                    value={selectedRegion}
                                    onChange={event => handleSelectedRegionChange(event.target.value)}
                                    className="mt-1 w-full border border-pm-secondary/20 rounded-xl px-3 py-2.5 text-sm font-bold text-pm-dark bg-white outline-none focus:ring-2 focus:ring-pm-primary/20"
                                >
                                    {regionOptions.map(region => (
                                        <option key={region} value={region}>{region}</option>
                                    ))}
                                </select>
                            </div>
                            {activeUpdateFrequency === 'weekly' && (
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-pm-secondary">Início da semana</label>
                                    <input
                                        type="date"
                                        value={weekStartDate}
                                        onChange={event => setWeekStartDate(event.target.value)}
                                        className="mt-1 w-full border border-pm-secondary/20 rounded-xl px-3 py-2.5 text-sm font-bold text-pm-dark bg-white outline-none focus:ring-2 focus:ring-pm-primary/20"
                                    />
                                </div>
                            )}
                            {activeUpdateFrequency === 'semester' && (
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-pm-secondary">Semestre</label>
                                    <select
                                        value={periodSemester}
                                        onChange={event => setPeriodSemester(event.target.value as '1' | '2')}
                                        className="mt-1 w-full border border-pm-secondary/20 rounded-xl px-3 py-2.5 text-sm font-bold text-pm-dark bg-white outline-none focus:ring-2 focus:ring-pm-primary/20"
                                    >
                                        <option value="1">1º Semestre</option>
                                        <option value="2">2º Semestre</option>
                                    </select>
                                </div>
                            )}
                            {activeUpdateFrequency === 'monthly' && (
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-pm-secondary">Mês</label>
                                    <select
                                        value={periodMonth}
                                        onChange={event => setPeriodMonth(Number(event.target.value))}
                                        className="mt-1 w-full border border-pm-secondary/20 rounded-xl px-3 py-2.5 text-sm font-bold text-pm-dark bg-white outline-none focus:ring-2 focus:ring-pm-primary/20 capitalize"
                                    >
                                        {Array.from({ length: 12 }, (_, index) => (
                                            <option key={index + 1} value={index + 1}>
                                                {new Date(2026, index).toLocaleDateString('pt-BR', { month: 'long' })}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {['monthly', 'semester', 'yearly'].includes(activeUpdateFrequency) && (
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-pm-secondary">Ano</label>
                                    <input
                                        type="number"
                                        value={periodYear}
                                        onChange={event => setPeriodYear(Number(event.target.value))}
                                        className="mt-1 w-full border border-pm-secondary/20 rounded-xl px-3 py-2.5 text-sm font-bold text-pm-dark bg-white outline-none focus:ring-2 focus:ring-pm-primary/20"
                                    />
                                </div>
                            )}
                            {activeUpdateFrequency === 'custom' && (
                                <>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-pm-secondary">Data inicial</label>
                                        <input
                                            type="date"
                                            value={customStartDate}
                                            onChange={event => setCustomStartDate(event.target.value)}
                                            className="mt-1 w-full border border-pm-secondary/20 rounded-xl px-3 py-2.5 text-sm font-bold text-pm-dark bg-white outline-none focus:ring-2 focus:ring-pm-primary/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-pm-secondary">Data final</label>
                                        <input
                                            type="date"
                                            value={customEndDate}
                                            onChange={event => setCustomEndDate(event.target.value)}
                                            className="mt-1 w-full border border-pm-secondary/20 rounded-xl px-3 py-2.5 text-sm font-bold text-pm-dark bg-white outline-none focus:ring-2 focus:ring-pm-primary/20"
                                        />
                                    </div>
                                </>
                            )}
                            {activeUpdateFrequency === 'fixed' && (
                                <div className="sm:col-span-2 rounded-xl border border-pm-secondary/10 bg-pm-light px-3 py-2.5">
                                    <span className="block text-[10px] font-black uppercase tracking-widest text-pm-secondary">Período</span>
                                    <strong className="block text-sm text-pm-dark mt-0.5">Cadastro fixo da região</strong>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-5 space-y-5">
                        <div className="rounded-2xl border border-pm-secondary/15 bg-white p-3">
                            <div className="flex items-center justify-between gap-3 mb-3">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-pm-secondary">Tipo de atualização</p>
                                    <h4 className="text-sm font-black text-pm-dark">Escolha primeiro a periodicidade</h4>
                                </div>
                                <span className="hidden sm:inline-flex text-[10px] font-black uppercase tracking-widest text-pm-secondary bg-pm-light rounded-full px-3 py-1">
                                    {referenceLabel}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-2">
                                {ALPHABETICAL_UPDATE_FREQUENCIES.map(frequency => {
                                    const isActive = activeUpdateFrequency === frequency;
                                    const totalSections = catalogSections.filter(section => (section.updateFrequency ?? 'custom') === frequency).length;
                                    return (
                                        <button
                                            key={frequency}
                                            onClick={() => {
                                                setActiveUpdateFrequency(frequency);
                                                setActiveFillCategory('');
                                            }}
                                            className={`rounded-xl border px-3 py-3 text-left transition-all ${isActive ? 'bg-pm-primary text-white border-pm-primary' : 'bg-[#fbfaf6] border-pm-secondary/10 text-pm-dark hover:bg-pm-light'}`}
                                        >
                                            <span className="block text-xs font-black uppercase tracking-wide">{getFrequencyLabel(frequency)}</span>
                                            <span className={`block text-[10px] font-bold mt-1 ${isActive ? 'text-white/80' : 'text-pm-secondary'}`}>
                                                {totalSections} seção(ões) • {getFrequencyDescription(frequency)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <section className="rounded-2xl border border-pm-secondary/15 bg-white p-4">
                            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <Filter className="w-4 h-4 text-pm-primary" />
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-pm-secondary">Filtro do preenchimento</p>
                                    </div>
                                    <h4 className="text-sm font-black text-pm-dark mt-1">Buscar seção ou indicador</h4>
                                </div>
                                <div className="w-full lg:max-w-md flex items-center gap-2 rounded-xl border border-pm-secondary/20 bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-pm-primary/20">
                                    <Search className="w-4 h-4 text-pm-secondary" />
                                    <input
                                        value={sectionFilterSearch}
                                        onChange={event => setSectionFilterSearch(event.target.value)}
                                        placeholder="Ex.: CVLI, efetivo, operações"
                                        className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-bold text-pm-dark outline-none placeholder:text-pm-secondary/60"
                                    />
                                </div>
                            </div>
                            <p className="mt-3 text-xs font-bold text-pm-secondary">
                                Mostrando <strong className="text-pm-dark">{visibleSnapshotSections.length + visibleCollectionSections.length}</strong> seção(ões) em <strong className="text-pm-dark">{getFrequencyLabel(activeUpdateFrequency)}</strong>
                                {selectedFillCategory ? <> / <strong className="text-pm-dark">{selectedFillCategory}</strong></> : null}.
                            </p>
                        </section>

                        {fillCategories.length > 0 && (
                            <div className="rounded-2xl border border-pm-secondary/15 bg-white p-3">
                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-pm-secondary">Menu de preenchimento</p>
                                        <h4 className="text-sm font-black text-pm-dark">Escolha um tópico para preencher</h4>
                                    </div>
                                    <span className="hidden sm:inline-flex text-[10px] font-black uppercase tracking-widest text-pm-secondary bg-pm-light rounded-full px-3 py-1">
                                        {selectedFillCategory || 'Todas'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                                    {fillCategories.map(category => {
                                        const isActive = selectedFillCategory === category;
                                        const categorySections = frequencySections.filter(section => section.categoryTitle === category);
                                        const savedInCategory = categorySections.filter(section => section.mode === 'snapshot' && findSnapshotEntry(section.id)).length;
                                        const collectionInCategory = categorySections
                                            .filter(section => section.mode === 'collection')
                                            .reduce((total, section) => total + collectionItemsForSection(section.id).length, 0);

                                        return (
                                            <button
                                                key={category}
                                                onClick={() => setActiveFillCategory(category)}
                                                className={`rounded-xl border px-3 py-3 text-left transition-all ${isActive ? 'bg-pm-primary text-white border-pm-primary' : 'bg-[#fbfaf6] border-pm-secondary/10 text-pm-dark hover:bg-pm-light'}`}
                                            >
                                                <span className="block text-xs font-black uppercase tracking-wide">{category}</span>
                                                <span className={`block text-[10px] font-bold mt-1 ${isActive ? 'text-white/80' : 'text-pm-secondary'}`}>
                                                    {savedInCategory} seção(ões) salvas • {collectionInCategory} registro(s)
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {saveMessage && (
                            <div className={`rounded-xl border px-4 py-3 text-sm font-bold ${saveMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                                {saveMessage.text}
                            </div>
                        )}

                        {!selectedCommand && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
                                Selecione uma região específica para liberar o preenchimento. A opção "Todas as regiões" é apenas para visão consolidada.
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-[320px,minmax(0,1fr)] gap-5">
                            <aside className="rounded-2xl border border-pm-secondary/15 bg-white overflow-hidden">
                                <div className="px-4 py-3 border-b border-pm-secondary/10 bg-pm-light/70">
                                    <h4 className="text-sm font-black text-pm-dark uppercase">Seções do Regional</h4>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-pm-secondary mt-1">
                                        {visibleRegionalSections.length} seção(ões) para {getFrequencyLabel(activeUpdateFrequency)}
                                    </p>
                                </div>
                                <div className="p-3 max-h-[620px] overflow-y-auto custom-scrollbar space-y-2">
                                    {visibleRegionalSections.map(section => {
                                        const isActive = activeRegionalSection?.id === section.id;
                                        const entry = section.mode === 'snapshot' ? findSnapshotEntry(section.id) : null;
                                        const itemCount = section.mode === 'collection' ? collectionItemsForSection(section.id).length : 0;

                                        return (
                                            <button
                                                key={section.id}
                                                onClick={() => setActiveRegionalSectionId(section.id)}
                                                className={`w-full text-left p-4 rounded-xl border transition-all ${isActive ? 'bg-pm-primary text-white border-pm-primary shadow-sm' : 'bg-[#fbfaf6] border-pm-secondary/10 hover:bg-pm-light text-pm-dark'}`}
                                            >
                                                <div className="flex items-start gap-2">
                                                    <FileText className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'text-white' : 'text-pm-primary'}`} />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-black truncate">{section.title}</p>
                                                        <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${isActive ? 'text-white/80' : 'text-pm-secondary'}`}>
                                                            {section.categoryTitle} • {section.mode === 'collection' ? 'Registros' : 'Fixo'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`inline-flex mt-3 text-[10px] font-black rounded-full px-2 py-1 ${isActive ? 'bg-white/20 text-white' : 'bg-white border border-pm-secondary/10 text-pm-secondary'}`}>
                                                    {section.mode === 'snapshot' ? (entry ? 'Salvo' : 'Pendente') : `${itemCount} registro(s)`}
                                                </span>
                                            </button>
                                        );
                                    })}
                                    {visibleRegionalSections.length === 0 && (
                                        <p className="text-sm text-pm-secondary text-center py-8">Nenhuma seção encontrada para os filtros atuais.</p>
                                    )}
                                </div>
                            </aside>

                            <main className="min-w-0">
                                {activeRegionalSection ? (() => {
                                    const section = activeRegionalSection;
                                    const sectionFields = getFieldsForSection(section.id);
                                    const editableFields = sectionFields.filter(field => field.fieldType !== 'calculated');
                                    const isSaving = savingSectionId === section.id;
                                    const entry = section.mode === 'snapshot' ? findSnapshotEntry(section.id) : null;
                                    const items = section.mode === 'collection' ? collectionItemsForSection(section.id) : [];

                                    return (
                                        <section className="rounded-2xl border border-pm-secondary/15 bg-white overflow-hidden">
                                            <div className="px-6 py-5 border-b border-pm-secondary/10 bg-pm-light/70 flex flex-col md:flex-row md:items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-pm-secondary">{section.categoryTitle}</p>
                                                    <h4 className="text-xl font-black text-pm-dark mt-1">{section.title}</h4>
                                                    <p className="text-xs font-bold text-pm-secondary mt-1">
                                                        Preenchimento oficial • {selectedCommand?.name || selectedRegion} • {referenceLabel || 'Período não informado'}
                                                    </p>
                                                </div>
                                                <span className="text-[10px] font-black text-pm-secondary uppercase border border-pm-secondary/20 rounded-full px-2 py-1 self-start">
                                                    {section.mode === 'collection' ? 'Coleção' : 'Fixo'}
                                                </span>
                                            </div>

                                            <div className="p-6 space-y-5">
                                                {section.mode === 'snapshot' && entry && (
                                                    <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-200 text-sm font-bold">
                                                        Dados já salvos para este período.
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {sectionFields.map(field => {
                                                        const isCalculated = field.fieldType === 'calculated';
                                                        const value = section.mode === 'snapshot'
                                                            ? getSnapshotValue(section.id, field)
                                                            : isCalculated
                                                                ? ''
                                                                : collectionDraftValues[section.id]?.[field.id] ?? '';
                                                        const isLongText = field.fieldType === 'textarea';
                                                        const onChange = (nextValue: string) => section.mode === 'snapshot'
                                                            ? updateSnapshotDraft(
                                                                section.id,
                                                                field.id,
                                                                ['number', 'percentage', 'currency'].includes(field.fieldType)
                                                                    ? formatBrazilianNumericInput(nextValue, field.fieldType === 'currency')
                                                                    : nextValue
                                                            )
                                                            : updateCollectionDraft(
                                                                section.id,
                                                                field.id,
                                                                ['number', 'percentage', 'currency'].includes(field.fieldType)
                                                                    ? formatBrazilianNumericInput(nextValue, field.fieldType === 'currency')
                                                                    : nextValue
                                                            );

                                                        return (
                                                            <label key={field.id} className={`${isLongText ? 'md:col-span-2' : ''} block`}>
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-pm-secondary">
                                                                    {field.label}{field.isRequired ? ' *' : ''}{isCalculated ? ' (calculado)' : ''}
                                                                </span>
                                                                {isLongText ? (
                                                                    <textarea
                                                                        value={value}
                                                                        onChange={event => onChange(event.target.value)}
                                                                        rows={4}
                                                                        disabled={!selectedCommand || isCalculated}
                                                                        className="mt-1 w-full resize-y border border-pm-secondary/20 rounded-xl px-3 py-2.5 text-sm font-semibold text-pm-dark bg-white outline-none focus:ring-2 focus:ring-pm-primary/20 disabled:bg-slate-50 disabled:text-slate-400"
                                                                    />
                                                                ) : (
                                                                    <input
                                                                        type={['number', 'percentage', 'currency', 'calculated'].includes(field.fieldType) ? 'text' : field.fieldType === 'date' ? 'date' : 'text'}
                                                                        inputMode={['number', 'percentage', 'currency', 'calculated'].includes(field.fieldType) ? 'decimal' : undefined}
                                                                        value={value}
                                                                        onChange={event => onChange(event.target.value)}
                                                                        disabled={!selectedCommand || isCalculated}
                                                                        className="mt-1 w-full border border-pm-secondary/20 rounded-xl px-3 py-2.5 text-sm font-semibold text-pm-dark bg-white outline-none focus:ring-2 focus:ring-pm-primary/20 disabled:bg-slate-50 disabled:text-slate-400"
                                                                    />
                                                                )}
                                                            </label>
                                                        );
                                                    })}
                                                </div>

                                                <div className="pt-4 border-t border-pm-secondary/10 flex justify-end">
                                                    <button
                                                        onClick={() => section.mode === 'snapshot' ? saveSnapshotSection(section) : addCollectionItem(section)}
                                                        disabled={!selectedCommand || isSaving || editableFields.length === 0}
                                                        className={`px-5 py-3 rounded-xl text-sm font-black flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${section.mode === 'snapshot' ? 'bg-pm-primary text-white' : 'bg-pm-dark text-white'}`}
                                                    >
                                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : section.mode === 'snapshot' ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                                        {section.mode === 'snapshot' ? 'Salvar seção' : 'Adicionar registro'}
                                                    </button>
                                                </div>

                                                {section.mode === 'collection' && items.length > 0 && (
                                                    <div className="pt-2 overflow-x-auto">
                                                        <h5 className="text-sm font-black text-pm-dark uppercase mb-3">Itens registrados</h5>
                                                        <table className="w-full text-left border-collapse">
                                                            <thead>
                                                                <tr className="bg-pm-light">
                                                                    {editableFields.map(field => (
                                                                        <th key={field.id} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-pm-secondary border border-pm-secondary/10">
                                                                            {field.label}
                                                                        </th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {items.map(item => (
                                                                    <tr key={item.id}>
                                                                        {editableFields.map(field => {
                                                                            const storedValue = regionalBriefingCollectionValues.find(value => value.itemId === item.id && value.fieldId === field.id);
                                                                            return (
                                                                                <td key={field.id} className="px-3 py-2 text-xs font-bold text-pm-dark border border-pm-secondary/10 align-top">
                                                                                    {formatRegionalStoredValue(field, storedValue)}
                                                                                </td>
                                                                            );
                                                                        })}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        </section>
                                    );
                                })() : (
                                    <div className="rounded-2xl border border-dashed border-pm-secondary/20 bg-white p-10 text-center">
                                        <FileText className="w-8 h-8 text-pm-secondary mx-auto" />
                                        <p className="text-sm font-black text-pm-dark mt-3">Nenhuma seção selecionada</p>
                                    </div>
                                )}
                            </main>
                        </div>
                    </div>
                </div>
                )}
            </div>

            {!isEditorMode && activeRegionalTab === 'preview' && (
            <div className="bg-white rounded-2xl border border-pm-secondary/15 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="w-4 h-4 text-pm-primary" />
                    <h3 className="text-sm font-black text-pm-dark uppercase">Conferência do briefing</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-pm-secondary/10 bg-[#fbfaf6] p-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-pm-secondary">Comando</span>
                        <strong className="block text-base text-pm-dark mt-1">{selectedCommand?.name || selectedRegion}</strong>
                    </div>
                    <div className="rounded-xl border border-pm-secondary/10 bg-[#fbfaf6] p-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-pm-secondary">Período</span>
                        <strong className="block text-base text-pm-dark mt-1">{referenceLabel || 'Não informado'}</strong>
                    </div>
                    <div className="rounded-xl border border-pm-secondary/10 bg-[#fbfaf6] p-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-pm-secondary">Seções salvas</span>
                        <strong className="block text-base text-pm-dark mt-1">{filledSnapshotCount}/{snapshotSections.length}</strong>
                    </div>
                    <div className="rounded-xl border border-pm-secondary/10 bg-[#fbfaf6] p-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-pm-secondary">Registros</span>
                        <strong className="block text-base text-pm-dark mt-1">{filledCollectionCount}</strong>
                    </div>
                </div>
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-pm-secondary/10 bg-pm-light p-4">
                    <p className="text-sm font-bold text-pm-secondary">
                        Revise os números lançados no menu “Preencher dados”. Depois gere o PDF para conferência final.
                    </p>
                    <button
                        onClick={() => setIsReportBuilderOpen(true)}
                        disabled={!isPrintable}
                        className="px-5 py-3 rounded-xl bg-red-600 text-white text-sm font-black shadow-sm hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Printer className="w-4 h-4" />
                        Gerenciador de impressão
                    </button>
                </div>
            </div>
            )}

            {isReportBuilderOpen && (
                <RegionalReportBuilderModal
                    onClose={() => setIsReportBuilderOpen(false)}
                    initialRegionalCommandId={selectedCommand?.id ?? null}
                    initialSelectedSectionIds={selectedSectionIds}
                />
            )}
        </div>
    );
}
