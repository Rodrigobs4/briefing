import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowDown,
    ArrowUp,
    CheckSquare,
    ChevronDown,
    ChevronRight,
    ClipboardCheck,
    Download,
    Eye,
    FileText,
    Filter,
    Layers3,
    ListChecks,
    Loader2,
    MapPinned,
    Plus,
    Printer,
    Save,
    Search,
    SlidersHorizontal,
    Square,
    X
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { useAuth, RegionalBriefingSection } from '../../store/AuthContext';
import { compareTextPtBr, sortByTextPtBr } from '../../utils/textOrdering';
import { isGeneralBriefingUnit } from '../../utils/generalBriefingUnits';
import {
    type ReportHighlightColor,
    type ReportHighlightTarget,
    type ReportTableHighlightRule,
    markPrintFittingTables
} from '../dashboard/components/reportPdfShared';
import RegionalReportPdfRenderer from './RegionalReportPdfRenderer';
import {
    loadRegionalReportConfiguration,
    saveRegionalReportConfiguration,
    type SavedRegionalReportConfiguration
} from './regionalReportConfigStorage';
import { saveSelectedRegionalCommandId } from './regionalCommandSelectionStorage';
import { getAccessibleRegionalCommands } from '../../utils/regionalCommandAccess';

const getStringArray = (value: unknown) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const REPORT_HIGHLIGHT_COLORS: Array<{ value: ReportHighlightColor; label: string; swatch: string }> = [
    { value: 'khaki', label: 'Dourado suave', swatch: 'bg-[#eee7bf]' },
    { value: 'blue', label: 'Azul', swatch: 'bg-blue-100' },
    { value: 'green', label: 'Verde', swatch: 'bg-emerald-100' },
    { value: 'amber', label: 'Amarelo', swatch: 'bg-amber-100' },
    { value: 'red', label: 'Vermelho', swatch: 'bg-red-100' }
];

const REPORT_HIGHLIGHT_TARGET_LABELS: Record<ReportHighlightTarget, string> = {
    row: 'Linha',
    column: 'Coluna',
    cell: 'Célula'
};

const createHighlightId = () => `regional-highlight-${crypto.randomUUID()}`;

export type RegionalReportBuilderModalProps = {
    onClose: () => void;
    initialRegionalCommandId?: string | null;
    initialSelectedSectionIds?: string[];
};

export default function RegionalReportBuilderModal({
    onClose,
    initialRegionalCommandId = null,
    initialSelectedSectionIds
}: RegionalReportBuilderModalProps) {
    const {
        units: allUnits,
        user,
        regionalCommands,
        unitRegionalCommands,
        regionalBriefingTopics,
        regionalBriefingSections,
        regionalBriefingFields
    } = useAuth();

    const activeRegionalCommands = getAccessibleRegionalCommands(regionalCommands, user);
    const generalUnits = allUnits.filter(unit => isGeneralBriefingUnit(unit, regionalCommands));
    const visibleUnits = user?.role === 'editor'
        ? generalUnits.filter(unit => (user.unitIds?.length ? user.unitIds.includes(unit.id) : unit.id === user.unitId))
        : generalUnits;

    const catalogTopics = useMemo(
        () => regionalBriefingTopics.filter(topic => topic.isActive).sort((a, b) => a.orderIndex - b.orderIndex || compareTextPtBr(a.name, b.name)),
        [regionalBriefingTopics]
    );
    const catalogSections = useMemo(
        () => regionalBriefingSections.filter(section => section.isActive).sort((a, b) => a.categoryOrder - b.categoryOrder || a.orderIndex - b.orderIndex),
        [regionalBriefingSections]
    );

    const [selectedRegionalCommandId, setSelectedRegionalCommandId] = useState(initialRegionalCommandId || activeRegionalCommands[0]?.id || '');

    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [selectedSections, setSelectedSections] = useState<string[]>(initialSelectedSectionIds || []);
    const [expandedTopics, setExpandedTopics] = useState<string[]>([]);
    const [collapsedCategories, setCollapsedCategories] = useState<string[]>([]);
    const [customCategories, setCustomCategories] = useState<string[]>([]);
    const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
    const [topicOrder, setTopicOrder] = useState<string[]>([]);
    const [sectionOrder, setSectionOrder] = useState<string[]>([]);
    const [fieldOrder, setFieldOrder] = useState<Record<string, string[]>>({});
    const [topicAssignments, setTopicAssignments] = useState<Record<string, string>>({});
    const [newCategoryName, setNewCategoryName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [reportMode, setReportMode] = useState<'builder' | 'preview'>('builder');
    const [fontSize, setFontSize] = useState<'standard' | 'large'>('standard');
    const [technicalSections, setTechnicalSections] = useState({
        showExecutiveSummary: true,
        showSubjectMap: true
    });
    const [tableHighlights, setTableHighlights] = useState<ReportTableHighlightRule[]>([]);
    const [highlightEditingSectionId, setHighlightEditingSectionId] = useState('');
    const [highlightTarget, setHighlightTarget] = useState<ReportHighlightTarget>('row');
    const [highlightRow, setHighlightRow] = useState(1);
    const [highlightColumn, setHighlightColumn] = useState(1);
    const [highlightColor, setHighlightColor] = useState<ReportHighlightColor>('khaki');
    const [isLoadingSavedModel, setIsLoadingSavedModel] = useState(false);
    const [isSavingModel, setIsSavingModel] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [modelMessage, setModelMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [modelReloadRequest, setModelReloadRequest] = useState(0);

    const printRef = useRef<HTMLDivElement>(null);
    const loadedConfigurationKey = useRef<string | null>(null);
    const canManageRegionalModel = user?.role === 'admin';

    const selectedCommand = activeRegionalCommands.find(command => command.id === selectedRegionalCommandId) ?? null;

    const unitsForRegion = useMemo(() => {
        if (!selectedCommand) return [] as typeof visibleUnits;
        const activeLinks = unitRegionalCommands.filter(link => link.isActive && !link.endedAt);
        const linkedUnitIds = new Set(
            activeLinks
                .filter(link => link.regionalCommandId === selectedCommand.id)
                .map(link => link.unitId)
        );
        return sortByTextPtBr(visibleUnits.filter(unit => linkedUnitIds.has(unit.id)), unit => unit.name);
    }, [selectedCommand, unitRegionalCommands, visibleUnits]);

    const linkedUnitNames = unitsForRegion.map(unit => unit.name);
    const ascomLabel = Array.from(new Set(
        unitsForRegion.map(unit => unit.regionalAscom?.trim()).filter(Boolean) as string[]
    )).join(' • ') || selectedCommand?.code || null;

    const getSectionsForTopic = (topicId: string) => catalogSections.filter(section =>
        section.topicId === topicId || (!section.topicId && catalogTopics.some(topic => topic.id === topicId && topic.name === section.categoryTitle))
    );

    const visibleTopicIds = catalogTopics.map(topic => topic.id);
    const visibleSectionIds = catalogSections.map(section => section.id);

    useEffect(() => {
        if (initialRegionalCommandId && activeRegionalCommands.some(command => command.id === initialRegionalCommandId)) {
            setSelectedRegionalCommandId(initialRegionalCommandId);
            return;
        }
        if (!selectedRegionalCommandId && activeRegionalCommands[0]) {
            setSelectedRegionalCommandId(activeRegionalCommands[0].id);
            return;
        }
        if (selectedRegionalCommandId && !activeRegionalCommands.some(command => command.id === selectedRegionalCommandId)) {
            const fallbackId = activeRegionalCommands[0]?.id || '';
            setSelectedRegionalCommandId(fallbackId);
            if (fallbackId) saveSelectedRegionalCommandId(fallbackId);
        }
    }, [activeRegionalCommands, initialRegionalCommandId, selectedRegionalCommandId]);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 767px)');
        const updateIsMobile = () => setIsMobile(mediaQuery.matches);
        updateIsMobile();
        mediaQuery.addEventListener('change', updateIsMobile);
        return () => mediaQuery.removeEventListener('change', updateIsMobile);
    }, []);

    useEffect(() => {
        if (isMobile) setFontSize('large');
    }, [isMobile]);

    useEffect(() => {
        if (!selectedRegionalCommandId) return;
        const configKey = `${selectedRegionalCommandId}:${modelReloadRequest}`;
        if (loadedConfigurationKey.current === configKey) return;

        setIsLoadingSavedModel(true);
        setModelMessage(null);

        try {
            const saved = loadRegionalReportConfiguration(selectedRegionalCommandId);
            loadedConfigurationKey.current = configKey;

            if (!saved) {
                const defaultSectionIds = initialSelectedSectionIds?.length
                    ? initialSelectedSectionIds
                    : catalogSections.map(section => section.id);
                const defaultTopicIds = catalogTopics
                    .filter(topic => getSectionsForTopic(topic.id).some(section => defaultSectionIds.includes(section.id)))
                    .map(topic => topic.id);

                setSelectedTopics(defaultTopicIds);
                setSelectedSections(defaultSectionIds);
                setTopicOrder(defaultTopicIds);
                setSectionOrder(defaultSectionIds);
                setExpandedTopics(defaultTopicIds);
                setModelMessage({
                    type: 'success',
                    text: canManageRegionalModel
                        ? 'Nenhum modelo regional encontrado. Monte o relatório e publique o modelo.'
                        : 'Nenhum modelo regional foi publicado pelo administrador.'
                });
                return;
            }

            const allowedTopicIds = new Set(visibleTopicIds);
            const allowedSectionIds = new Set(visibleSectionIds);
            const restoredTopics = getStringArray(saved.selectedTopics).filter(id => allowedTopicIds.has(id));
            const restoredSections = getStringArray(saved.selectedSections).filter(id => allowedSectionIds.has(id));
            const assignments = saved.topicAssignments && typeof saved.topicAssignments === 'object'
                ? Object.fromEntries(
                    Object.entries(saved.topicAssignments)
                        .filter(([topicId, category]) => allowedTopicIds.has(topicId) && typeof category === 'string')
                )
                : {};
            const restoredFieldOrder = saved.fieldOrder && typeof saved.fieldOrder === 'object'
                ? Object.fromEntries(
                    Object.entries(saved.fieldOrder)
                        .filter(([sectionId, order]) => allowedSectionIds.has(sectionId) && Array.isArray(order))
                        .map(([sectionId, order]) => {
                            const allowedFieldIds = new Set(
                                regionalBriefingFields
                                    .filter(field => field.sectionId === sectionId && field.isActive)
                                    .map(field => field.id)
                            );
                            return [sectionId, getStringArray(order).filter(id => allowedFieldIds.has(id))];
                        })
                )
                : {};

            setSelectedTopics(restoredTopics);
            setSelectedSections(restoredSections);
            setCustomCategories(getStringArray(saved.customCategories));
            setCategoryOrder(getStringArray(saved.categoryOrder));
            setTopicOrder(getStringArray(saved.topicOrder).filter(id => restoredTopics.includes(id)));
            setSectionOrder(getStringArray(saved.sectionOrder).filter(id => restoredSections.includes(id)));
            setFieldOrder(restoredFieldOrder);
            setTopicAssignments(assignments);
            setExpandedTopics(restoredTopics);
            setFontSize(saved.fontSize === 'large' ? 'large' : 'standard');
            setTechnicalSections({
                showExecutiveSummary: saved.technicalSections?.showExecutiveSummary !== false,
                showSubjectMap: saved.technicalSections?.showSubjectMap !== false
            });
            setTableHighlights((saved.tableHighlights || []).filter(rule => allowedSectionIds.has(rule.groupId)));
            setModelMessage({ type: 'success', text: 'Modelo regional carregado.' });
        } catch (error) {
            loadedConfigurationKey.current = null;
            console.error('Falha ao carregar modelo regional:', error);
            setModelMessage({ type: 'error', text: 'Não foi possível carregar o modelo salvo.' });
        } finally {
            setIsLoadingSavedModel(false);
        }
    }, [
        selectedRegionalCommandId,
        modelReloadRequest,
        catalogTopics,
        catalogSections,
        regionalBriefingFields,
        canManageRegionalModel,
        initialSelectedSectionIds
    ]);

    const reloadSavedModel = () => {
        loadedConfigurationKey.current = null;
        setModelReloadRequest(previous => previous + 1);
    };

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Briefing Regional PMBA - ${selectedCommand?.name || 'Regional'} - ${new Date().toISOString().split('T')[0]}`,
        onBeforePrint: async () => markPrintFittingTables(printRef.current)
    });

    const handleDownloadPdf = async () => {
        const targetElement = printRef.current;
        if (!isPrintable || !targetElement) return;

        setIsGeneratingPdf(true);
        try {
            const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
                import('html2canvas'),
                import('jspdf')
            ]);
            const canvas = await html2canvas(targetElement, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                windowWidth: targetElement.scrollWidth
            });
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const pageHeightPx = Math.floor((canvas.width * pageHeight) / pageWidth);

            let sourceY = 0;
            let pageIndex = 0;
            while (sourceY < canvas.height) {
                const cutY = Math.min(sourceY + pageHeightPx, canvas.height);
                const sliceHeight = Math.max(1, cutY - sourceY);
                const pageCanvas = document.createElement('canvas');
                pageCanvas.width = canvas.width;
                pageCanvas.height = sliceHeight;
                const pageContext = pageCanvas.getContext('2d');
                if (!pageContext) throw new Error('Não foi possível preparar a página do PDF.');
                pageContext.fillStyle = '#ffffff';
                pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
                pageContext.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

                if (pageIndex > 0) pdf.addPage();
                const imgHeight = (sliceHeight * pageWidth) / canvas.width;
                pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, imgHeight);
                sourceY = cutY;
                pageIndex += 1;
            }

            pdf.save(`Briefing-Regional-PMBA-${selectedCommand?.code || 'regional'}-${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('Falha ao gerar PDF:', error);
            alert('Não foi possível baixar o PDF neste dispositivo.');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const appendSectionsToOrder = (sectionIds: string[]) => {
        setSectionOrder(prev => [...prev, ...sectionIds.filter(id => !prev.includes(id))]);
    };

    const appendTopicToOrder = (topicId: string) => {
        setTopicOrder(prev => prev.includes(topicId) ? prev : [...prev, topicId]);
    };

    const removeTopicFromOrder = (topicId: string) => {
        setTopicOrder(prev => prev.filter(id => id !== topicId));
    };

    const removeSectionsFromOrder = (sectionIds: string[]) => {
        setSectionOrder(prev => prev.filter(id => !sectionIds.includes(id)));
    };

    const toggleTopic = (topicId: string) => {
        const topicSections = getSectionsForTopic(topicId).map(section => section.id);

        if (selectedTopics.includes(topicId)) {
            setSelectedTopics(prev => prev.filter(id => id !== topicId));
            setSelectedSections(prev => prev.filter(id => !topicSections.includes(id)));
            removeTopicFromOrder(topicId);
            removeSectionsFromOrder(topicSections);
            return;
        }

        setSelectedTopics(prev => [...prev, topicId]);
        setSelectedSections(prev => Array.from(new Set([...prev, ...topicSections])));
        appendTopicToOrder(topicId);
        appendSectionsToOrder(topicSections);
        setExpandedTopics(prev => prev.includes(topicId) ? prev : [...prev, topicId]);
    };

    const addFullTopicFromSection = (topicId: string) => {
        if (!selectedTopics.includes(topicId)) toggleTopic(topicId);
    };

    const toggleExpandTopic = (topicId: string) => {
        setExpandedTopics(prev => prev.includes(topicId) ? prev.filter(id => id !== topicId) : [...prev, topicId]);
    };

    const toggleCategoryCollapse = (category: string) => {
        setCollapsedCategories(prev => prev.includes(category) ? prev.filter(item => item !== category) : [...prev, category]);
    };

    const handleSelectAll = () => {
        const sectionIds = catalogSections.map(section => section.id);
        const topicIds = catalogTopics.map(topic => topic.id);
        setSelectedTopics(topicIds);
        setSelectedSections(sectionIds);
        setTopicOrder(topicIds);
        setSectionOrder(sectionIds);
        setExpandedTopics(topicIds);
    };

    const handleClearAll = () => {
        setSelectedTopics([]);
        setSelectedSections([]);
        setTopicOrder([]);
        setSectionOrder([]);
        setTopicAssignments({});
    };

    const getTopicCategory = (topicId: string) => {
        const topic = catalogTopics.find(item => item.id === topicId);
        return topicAssignments[topicId] || topic?.name || 'Geral';
    };

    const getSectionOrderIndex = (sectionId: string) => {
        const index = sectionOrder.indexOf(sectionId);
        return index >= 0 ? index : 9999;
    };

    const selectedSectionObjects = catalogSections
        .filter(section => selectedSections.includes(section.id))
        .sort((a, b) => getSectionOrderIndex(a.id) - getSectionOrderIndex(b.id) || a.orderIndex - b.orderIndex);

    const getTopicOrderIndex = (topicId: string) => {
        const index = topicOrder.indexOf(topicId);
        return index >= 0 ? index : 9999;
    };

    const getSectionsForSelectedTopic = (topicId: string) => selectedSectionObjects
        .filter(section => section.topicId === topicId || (!section.topicId && getTopicCategory(topicId) === section.categoryTitle))
        .sort((a, b) => getSectionOrderIndex(a.id) - getSectionOrderIndex(b.id) || a.orderIndex - b.orderIndex);

    const getFieldsForSection = (sectionId: string) => {
        const configuredOrder = fieldOrder[sectionId] ?? [];
        const getConfiguredIndex = (fieldId: string) => {
            const index = configuredOrder.indexOf(fieldId);
            return index >= 0 ? index : 9999;
        };

        return regionalBriefingFields
            .filter(field => field.sectionId === sectionId && field.isActive)
            .sort((a, b) => getConfiguredIndex(a.id) - getConfiguredIndex(b.id) || a.orderIndex - b.orderIndex);
    };

    const moveField = (sectionId: string, fieldId: string, direction: 'up' | 'down') => {
        const orderedFieldIds = getFieldsForSection(sectionId).map(field => field.id);
        const index = orderedFieldIds.indexOf(fieldId);
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (index < 0 || targetIndex < 0 || targetIndex >= orderedFieldIds.length) return;
        [orderedFieldIds[index], orderedFieldIds[targetIndex]] = [orderedFieldIds[targetIndex], orderedFieldIds[index]];
        setFieldOrder(previous => ({ ...previous, [sectionId]: orderedFieldIds }));
    };

    const selectedTopicObjects = catalogTopics
        .filter(topic => selectedTopics.includes(topic.id) && getSectionsForSelectedTopic(topic.id).length > 0)
        .sort((a, b) => getTopicOrderIndex(a.id) - getTopicOrderIndex(b.id) || a.orderIndex - b.orderIndex);

    const baseReportCategories = Array.from(new Set([
        ...selectedTopicObjects.map(topic => getTopicCategory(topic.id)),
        ...customCategories
    ].filter(Boolean)));

    const reportCategories = [
        ...categoryOrder.filter(category => baseReportCategories.includes(category)),
        ...baseReportCategories.filter(category => !categoryOrder.includes(category))
    ];

    const topicsByCategory = reportCategories.map(category => ({
        category,
        topics: selectedTopicObjects.filter(topic => getTopicCategory(topic.id) === category)
    }));

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filteredTopics = catalogTopics
        .map(topic => ({
            topic,
            sections: getSectionsForTopic(topic.id).filter(section => {
                if (!normalizedSearch) return true;
                const haystack = `${topic.name} ${section.title} ${section.categoryTitle}`.toLowerCase();
                return haystack.includes(normalizedSearch);
            }).sort((a, b) => compareTextPtBr(a.title, b.title))
        }))
        .filter(item => !normalizedSearch || item.sections.length > 0 || item.topic.name.toLowerCase().includes(normalizedSearch))
        .sort((a, b) => compareTextPtBr(a.topic.name, b.topic.name));

    const addCategory = () => {
        const category = newCategoryName.trim();
        if (!category || reportCategories.includes(category)) return;
        setCustomCategories(prev => [...prev, category]);
        setCategoryOrder(prev => [...prev, category]);
        setNewCategoryName('');
    };

    const removeEmptyCategory = (category: string) => {
        setCustomCategories(prev => prev.filter(item => item !== category));
        setCategoryOrder(prev => prev.filter(item => item !== category));
    };

    const moveCategory = (category: string, direction: 'up' | 'down') => {
        const idx = reportCategories.indexOf(category);
        if (idx < 0) return;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= reportCategories.length) return;
        const next = [...reportCategories];
        [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
        setCategoryOrder(next);
    };

    const rebuildSectionOrderFromTopics = (orderedTopicIds: string[]) => {
        const nextSectionOrder = orderedTopicIds.flatMap(topicId =>
            getSectionsForTopic(topicId)
                .filter(section => selectedSections.includes(section.id))
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map(section => section.id)
        );
        setSectionOrder(nextSectionOrder);
    };

    const moveTopicItem = (topicId: string, categoryTopics: { id: string }[], direction: 'up' | 'down') => {
        const categoryIndex = categoryTopics.findIndex(topic => topic.id === topicId);
        const targetCategoryIndex = direction === 'up' ? categoryIndex - 1 : categoryIndex + 1;
        if (categoryIndex < 0 || targetCategoryIndex < 0 || targetCategoryIndex >= categoryTopics.length) return;

        const orderedIds = selectedTopicObjects.map(topic => topic.id);
        const currentGlobalIndex = orderedIds.indexOf(topicId);
        const targetGlobalIndex = orderedIds.indexOf(categoryTopics[targetCategoryIndex].id);
        if (currentGlobalIndex < 0 || targetGlobalIndex < 0) return;

        [orderedIds[currentGlobalIndex], orderedIds[targetGlobalIndex]] = [orderedIds[targetGlobalIndex], orderedIds[currentGlobalIndex]];
        setTopicOrder(orderedIds);
        rebuildSectionOrderFromTopics(orderedIds);
    };

    const assignTopicCategory = (topicId: string, category: string) => {
        setTopicAssignments(prev => ({ ...prev, [topicId]: category }));
        setCategoryOrder(prev => prev.includes(category) ? prev : [...prev, category]);
    };

    const isSectionHighlightable = (section: RegionalBriefingSection) => {
        const fields = getFieldsForSection(section.id).filter(field => field.fieldType !== 'date');
        return section.mode === 'snapshot' && fields.length > 0 && !fields.every(field => field.fieldType === 'textarea');
    };

    const selectedCategoryCount = topicsByCategory.filter(item => item.topics.length > 0).length;
    const collectionCount = selectedSectionObjects.filter(section => section.mode === 'collection').length;
    const snapshotCount = selectedSectionObjects.length - collectionCount;
    const isPrintable = Boolean(selectedCommand)
        && selectedTopics.length > 0
        && selectedSections.length > 0;

    const sharedReportConfig = {
        topicAssignments,
        categoryOrder: reportCategories,
        topicOrder,
        sectionOrder,
        fieldOrder,
        tableHighlights: tableHighlights.filter(rule => selectedSections.includes(rule.groupId))
    };

    const effectiveReportMode = isMobile ? 'preview' : reportMode;

    const toggleTechnicalSection = (section: keyof typeof technicalSections) => {
        setTechnicalSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const addTableHighlight = (sectionId: string) => {
        if (!canManageRegionalModel) {
            setModelMessage({ type: 'error', text: 'Somente administradores podem alterar o modelo regional.' });
            return;
        }

        const rowIndex = highlightTarget === 'column' ? undefined : Math.max(0, highlightRow - 1);
        const columnIndex = highlightTarget === 'row' ? undefined : Math.max(0, highlightColumn - 1);
        const rule: ReportTableHighlightRule = {
            id: createHighlightId(),
            groupId: sectionId,
            target: highlightTarget,
            rowIndex,
            columnIndex,
            color: highlightColor
        };

        setTableHighlights(previous => [
            ...previous.filter(item => !(
                item.groupId === rule.groupId
                && item.target === rule.target
                && item.rowIndex === rule.rowIndex
                && item.columnIndex === rule.columnIndex
            )),
            rule
        ]);
        setModelMessage({ type: 'success', text: 'Cor da tabela aplicada ao modelo.' });
    };

    const removeTableHighlight = (ruleId: string) => {
        if (!canManageRegionalModel) return;
        setTableHighlights(previous => previous.filter(rule => rule.id !== ruleId));
        setModelMessage({ type: 'success', text: 'Cor removida.' });
    };

    const saveReportConfiguration = () => {
        if (!selectedRegionalCommandId) {
            setModelMessage({ type: 'error', text: 'Selecione um Comando Regional antes de publicar.' });
            return;
        }
        if (!canManageRegionalModel) {
            setModelMessage({ type: 'error', text: 'Somente administradores podem publicar o modelo regional.' });
            return;
        }

        const configuration: SavedRegionalReportConfiguration = {
            selectedTopics: selectedTopics.filter(id => visibleTopicIds.includes(id)),
            selectedSections: selectedSections.filter(id => visibleSectionIds.includes(id)),
            customCategories,
            categoryOrder: reportCategories,
            topicOrder: topicOrder.filter(id => selectedTopics.includes(id)),
            sectionOrder: sectionOrder.filter(id => selectedSections.includes(id)),
            fieldOrder: Object.fromEntries(
                selectedSections.map(sectionId => [sectionId, getFieldsForSection(sectionId).map(field => field.id)])
            ),
            topicAssignments: Object.fromEntries(
                Object.entries(topicAssignments).filter(([topicId]) => visibleTopicIds.includes(topicId))
            ),
            fontSize,
            technicalSections,
            tableHighlights
        };

        setIsSavingModel(true);
        setModelMessage(null);
        try {
            saveRegionalReportConfiguration(selectedRegionalCommandId, configuration);
            setModelMessage({ type: 'success', text: 'Modelo regional publicado neste navegador para o comando selecionado.' });
        } catch (error) {
            console.error('Falha ao salvar modelo regional:', error);
            setModelMessage({ type: 'error', text: 'Não foi possível publicar o modelo regional.' });
        } finally {
            setIsSavingModel(false);
        }
    };

    const pdfRendererProps = {
        regionName: selectedCommand?.name || 'Comando Regional',
        regionalCommandId: selectedCommand?.id ?? null,
        selectedSectionIds: selectedSections,
        linkedUnitNames,
        ascomLabel,
        fontSize,
        showExecutiveSummary: technicalSections.showExecutiveSummary,
        showSubjectMap: technicalSections.showSubjectMap,
        reportCategoryConfig: sharedReportConfig
    };

    return (
        <div className="fixed inset-0 bg-pm-dark/70 backdrop-blur-sm z-50 flex items-stretch md:items-center justify-center p-0 md:p-4">
            <div className="bg-[#f8f7f2] rounded-none md:rounded-2xl shadow-2xl w-full max-w-[96vw] h-[100dvh] md:h-[94vh] border border-white/70 flex flex-col overflow-hidden">
                <div className="bg-white px-4 md:px-5 py-3 md:py-4 border-b border-pm-secondary/15 shrink-0">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-pm-secondary">
                                <Printer className="w-4 h-4 text-pm-primary" />
                                Impressão executiva
                            </div>
                            <h2 className="text-lg md:text-2xl font-black text-pm-dark tracking-tight mt-1">
                                Gerenciador do Briefing Regional
                            </h2>
                            <p className="hidden sm:block text-sm text-pm-secondary mt-1">
                                Monte o briefing regional por comando, categorias e seções selecionadas.
                            </p>
                        </div>
                        <button onClick={onClose} className="text-pm-secondary hover:text-pm-dark p-2 hover:bg-pm-light rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex flex-col lg:flex-row lg:flex-wrap 2xl:flex-nowrap lg:items-end justify-between gap-3 md:gap-4 mt-3 md:mt-4">
                        <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap gap-2 md:gap-3 flex-1 min-w-0">
                            <label className="bg-white border border-pm-secondary/15 rounded-lg px-3 py-2.5 shrink-0">
                                <span className="text-[10px] uppercase tracking-widest font-black text-pm-secondary flex items-center gap-1.5">
                                    <MapPinned className="w-3.5 h-3.5" /> Comando Regional
                                </span>
                                <select
                                    value={selectedRegionalCommandId}
                                    onChange={event => {
                                        loadedConfigurationKey.current = null;
                                        setSelectedRegionalCommandId(event.target.value);
                                        saveSelectedRegionalCommandId(event.target.value);
                                        setModelReloadRequest(previous => previous + 1);
                                    }}
                                    className="mt-1 block w-full min-w-[160px] max-w-[220px] border-0 p-0 text-sm font-bold text-pm-dark bg-transparent outline-none focus:ring-0"
                                >
                                    {activeRegionalCommands.map(command => (
                                        <option key={command.id} value={command.id}>{command.name}</option>
                                    ))}
                                </select>
                            </label>

                            <div className="hidden md:grid grid-cols-2 md:grid-cols-4 gap-2 flex-1 min-w-0">
                            <div className="bg-[#ede7d2] border border-[#d7ca9a] rounded-lg px-3 py-2.5">
                                <span className="text-[10px] uppercase tracking-widest font-black text-pm-secondary flex items-center gap-1.5">
                                    <MapPinned className="w-3.5 h-3.5" /> Tópicos
                                </span>
                                <strong className="text-lg text-pm-dark leading-none mt-1 block">{selectedTopics.length}</strong>
                            </div>
                            <div className="bg-white border border-pm-secondary/15 rounded-lg px-3 py-2.5">
                                <span className="text-[10px] uppercase tracking-widest font-black text-pm-secondary flex items-center gap-1.5">
                                    <Layers3 className="w-3.5 h-3.5" /> Categorias
                                </span>
                                <strong className="text-lg text-pm-dark leading-none mt-1 block">{selectedCategoryCount}</strong>
                            </div>
                            <div className="bg-white border border-pm-secondary/15 rounded-lg px-3 py-2.5">
                                <span className="text-[10px] uppercase tracking-widest font-black text-pm-secondary flex items-center gap-1.5">
                                    <ListChecks className="w-3.5 h-3.5" /> Seções
                                </span>
                                <strong className="text-lg text-pm-dark leading-none mt-1 block">{selectedSections.length}</strong>
                            </div>
                            <div className="bg-white border border-pm-secondary/15 rounded-lg px-3 py-2.5">
                                <span className="text-[10px] uppercase tracking-widest font-black text-pm-secondary flex items-center gap-1.5">
                                    <ClipboardCheck className="w-3.5 h-3.5" /> Conteúdo
                                </span>
                                <strong className="text-sm text-pm-dark leading-none mt-2 block">{snapshotCount} indicadores / {collectionCount} listas</strong>
                            </div>
                        </div>
                        </div>

                        <div className="bg-pm-light border border-pm-secondary/15 rounded-xl p-1 flex shrink-0 overflow-x-auto" aria-label="Tamanho da fonte no relatório">
                            <button
                                onClick={() => setFontSize('standard')}
                                className={`hidden md:block px-3 py-2 rounded-lg text-xs font-black uppercase transition-colors ${fontSize === 'standard' ? 'bg-white text-pm-dark shadow-sm' : 'text-pm-secondary hover:text-pm-dark'}`}
                            >
                                Fonte padrão
                            </button>
                            <button
                                onClick={() => setFontSize('large')}
                                className={`px-3 py-2 rounded-lg text-xs font-black uppercase transition-colors ${fontSize === 'large' ? 'bg-white text-pm-dark shadow-sm' : 'text-pm-secondary hover:text-pm-dark'}`}
                            >
                                Fonte ampliada
                            </button>
                        </div>

                        <div className="hidden md:flex bg-white border border-pm-secondary/15 rounded-xl p-2 flex-row overflow-x-auto gap-1.5 shrink-0">
                            <button
                                onClick={() => toggleTechnicalSection('showExecutiveSummary')}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase flex items-center gap-1.5 text-pm-dark hover:bg-pm-light transition-colors"
                            >
                                {technicalSections.showExecutiveSummary ? <CheckSquare className="w-3.5 h-3.5 text-pm-primary" /> : <Square className="w-3.5 h-3.5 text-pm-secondary" />}
                                Resumo executivo
                            </button>
                            <button
                                onClick={() => toggleTechnicalSection('showSubjectMap')}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase flex items-center gap-1.5 text-pm-dark hover:bg-pm-light transition-colors"
                            >
                                {technicalSections.showSubjectMap ? <CheckSquare className="w-3.5 h-3.5 text-pm-primary" /> : <Square className="w-3.5 h-3.5 text-pm-secondary" />}
                                Mapa de assuntos
                            </button>
                        </div>

                        <div className="bg-pm-light border border-pm-secondary/15 rounded-xl p-1 flex shrink-0 overflow-x-auto">
                            <button
                                onClick={() => setReportMode('builder')}
                                className={`hidden md:flex px-3 py-2 rounded-lg text-xs font-black uppercase items-center gap-1.5 transition-colors ${reportMode === 'builder' ? 'bg-white text-pm-dark shadow-sm' : 'text-pm-secondary hover:text-pm-dark'}`}
                            >
                                <SlidersHorizontal className="w-3.5 h-3.5" /> Montagem
                            </button>
                            <button
                                onClick={() => setReportMode('preview')}
                                disabled={!isPrintable}
                                className={`px-3 py-2 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${effectiveReportMode === 'preview' ? 'bg-white text-pm-dark shadow-sm' : 'text-pm-secondary hover:text-pm-dark'}`}
                            >
                                <Eye className="w-3.5 h-3.5" /> Prévia
                            </button>
                        </div>
                    </div>
                </div>

                {effectiveReportMode === 'builder' ? (
                    <div className="flex flex-col lg:grid gap-0 flex-1 min-h-0 overflow-hidden" style={{ gridTemplateColumns: 'minmax(0, 300px) minmax(0, 1fr)' }}>
                        <aside className="bg-white border-r border-pm-secondary/15 flex flex-col min-h-0 shrink-0 max-h-[40dvh] sm:max-h-[44dvh] lg:max-h-none lg:min-h-0 lg:shrink">
                            <div className="p-3.5 border-b border-pm-secondary/10">
                                <div className="flex items-center gap-2 mb-3">
                                    <Filter className="w-4 h-4 text-pm-primary" />
                                    <h3 className="text-sm font-black text-pm-dark uppercase tracking-tight">Biblioteca de tópicos</h3>
                                </div>
                                <div className="relative">
                                    <Search className="w-4 h-4 text-pm-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        value={searchTerm}
                                        onChange={event => setSearchTerm(event.target.value)}
                                        placeholder="Buscar tópico ou seção"
                                        className="w-full border border-pm-secondary/20 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pm-primary/25 bg-white"
                                    />
                                </div>
                                <div className="flex gap-2 mt-3">
                                    <button onClick={handleSelectAll} className="flex-1 px-3 py-2 text-xs font-black bg-pm-dark text-white hover:bg-pm-primary rounded-lg transition-colors flex items-center justify-center gap-1.5">
                                        <CheckSquare className="w-3.5 h-3.5" /> Todos
                                    </button>
                                    <button onClick={handleClearAll} className="flex-1 px-3 py-2 text-xs font-black bg-pm-light text-pm-dark hover:bg-pm-secondary/20 rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-pm-secondary/20">
                                        <Square className="w-3.5 h-3.5" /> Limpar
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-y-auto custom-scrollbar p-3.5 space-y-2.5">
                                {filteredTopics.map(({ topic, sections }) => {
                                    const isTopicSelected = selectedTopics.includes(topic.id);
                                    const isExpanded = expandedTopics.includes(topic.id) || normalizedSearch.length > 0;
                                    const selectedCount = getSectionsForTopic(topic.id).filter(section => selectedSections.includes(section.id)).length;
                                    return (
                                        <div key={topic.id} className="border border-pm-secondary/15 rounded-xl overflow-hidden bg-white shadow-sm">
                                            <div className={`px-3 py-2.5 flex items-center justify-between transition-colors ${isTopicSelected ? 'bg-[#ede7d2] border-b border-[#d7ca9a]' : 'hover:bg-pm-light/60'}`}>
                                                <button className="flex items-center gap-3 min-w-0 text-left" onClick={() => toggleTopic(topic.id)}>
                                                    <span className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${isTopicSelected ? 'bg-pm-dark border-pm-dark text-white' : 'border-pm-secondary/40 bg-white'}`}>
                                                        {isTopicSelected && <CheckSquare className="w-3.5 h-3.5" />}
                                                    </span>
                                                    <span className="min-w-0">
                                                        <span className="font-black text-pm-dark leading-tight block truncate">{topic.name}</span>
                                                        <span className="text-[10px] text-pm-secondary uppercase tracking-wider mt-0.5 font-bold block">
                                                            {selectedCount}/{getSectionsForTopic(topic.id).length} seções selecionadas
                                                        </span>
                                                    </span>
                                                </button>
                                                <button className="p-1.5 text-pm-secondary hover:text-pm-primary rounded-full hover:bg-white/70 transition-colors" onClick={() => toggleExpandTopic(topic.id)}>
                                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                </button>
                                            </div>
                                            {isExpanded && (
                                                <div className="bg-pm-light/20 p-2.5 space-y-2 border-t border-pm-secondary/10">
                                                    {sections.map(section => {
                                                        const isSectionSelected = selectedSections.includes(section.id);
                                                        return (
                                                            <button
                                                                key={section.id}
                                                                onClick={() => addFullTopicFromSection(topic.id)}
                                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${isSectionSelected ? 'bg-white border-pm-primary/35 shadow-sm' : 'bg-white/70 border-pm-secondary/10 hover:border-pm-primary/25'}`}
                                                            >
                                                                <span className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors shrink-0 ${isSectionSelected ? 'bg-pm-primary border-pm-primary text-white' : 'border-pm-secondary/40 bg-white'}`}>
                                                                    {isSectionSelected && <CheckSquare className="w-3 h-3" />}
                                                                </span>
                                                                <span className="min-w-0 flex-1">
                                                                    <span className="text-sm font-bold text-pm-dark block truncate">{section.title}</span>
                                                                    <span className="text-[10px] uppercase tracking-wider font-bold text-pm-secondary">
                                                                        {getTopicCategory(topic.id)} · {section.mode === 'collection' ? 'Lista' : 'Indicadores'}
                                                                    </span>
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </aside>

                        <main className="flex flex-col min-h-0 flex-1">
                            <div className="p-4 border-b border-pm-secondary/10 bg-[#f8f7f2]">
                                <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
                                    <div>
                                        <h3 className="text-lg font-black text-pm-dark flex items-center gap-2">
                                            <Layers3 className="w-5 h-5 text-pm-primary" />
                                            Roteiro de impressão
                                        </h3>
                                        <p className="text-sm text-pm-secondary mt-1">Organize em blocos. O PDF seguirá essa sequência.</p>
                                    </div>
                                    <div className="flex gap-2 w-full xl:w-auto">
                                        <input
                                            value={newCategoryName}
                                            onChange={event => setNewCategoryName(event.target.value)}
                                            onKeyDown={event => { if (event.key === 'Enter') addCategory(); }}
                                            placeholder="Nova categoria"
                                            className="flex-1 xl:w-64 border border-pm-secondary/20 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pm-primary/25 bg-white"
                                        />
                                        <button onClick={addCategory} className="px-4 py-2 bg-pm-primary text-white rounded-lg text-xs font-black uppercase flex items-center gap-1.5 hover:bg-pm-primary/90">
                                            <Plus className="w-3.5 h-3.5" /> Criar
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 xl:p-5">
                                {topicsByCategory.length === 0 ? (
                                    <div className="h-full min-h-[200px] sm:min-h-[280px] border border-dashed border-pm-secondary/30 rounded-2xl bg-white/80 flex items-center justify-center text-center p-4 sm:p-8">
                                        <div>
                                            <FileText className="w-10 h-10 text-pm-secondary/45 mx-auto mb-3" />
                                            <p className="text-lg font-black text-pm-dark">Comece selecionando os tópicos</p>
                                            <p className="text-sm text-pm-secondary mt-1 max-w-md">Depois de selecionar, as categorias aparecem aqui como blocos organizáveis para impressão.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {topicsByCategory.map(({ category, topics }, categoryIndex) => {
                                            const isCategoryCollapsed = collapsedCategories.includes(category);
                                            return (
                                                <section key={category} className="border border-pm-secondary/15 rounded-2xl overflow-hidden bg-white shadow-sm">
                                                    <div className="bg-[#d8cca1] border-b border-[#b8a979] px-4 py-3 flex items-center gap-3">
                                                        <span className="w-8 h-8 rounded-lg bg-pm-dark text-white flex items-center justify-center text-sm font-black shrink-0">{categoryIndex + 1}</span>
                                                        <button onClick={() => toggleCategoryCollapse(category)} className="p-2 text-pm-dark hover:text-pm-primary rounded-lg hover:bg-white/60 transition-colors">
                                                            {isCategoryCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                        </button>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="text-base font-black text-pm-dark truncate">{category}</h4>
                                                            <p className="text-[10px] uppercase tracking-wider text-pm-secondary font-black">{topics.length} tópico(s) neste bloco</p>
                                                        </div>
                                                        <button onClick={() => moveCategory(category, 'up')} disabled={categoryIndex === 0} className="p-2 text-pm-dark hover:text-pm-primary disabled:opacity-20 rounded-lg hover:bg-white/60"><ArrowUp className="w-4 h-4" /></button>
                                                        <button onClick={() => moveCategory(category, 'down')} disabled={categoryIndex === topicsByCategory.length - 1} className="p-2 text-pm-dark hover:text-pm-primary disabled:opacity-20 rounded-lg hover:bg-white/60"><ArrowDown className="w-4 h-4" /></button>
                                                        {topics.length === 0 && category !== 'Geral' && (
                                                            <button onClick={() => removeEmptyCategory(category)} className="p-2 text-pm-secondary hover:text-red-700 rounded-lg hover:bg-white/60" title="Remover categoria vazia">
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    {!isCategoryCollapsed && (
                                                        <div className="p-3 space-y-2">
                                                            {topics.map((topic, topicIndex) => {
                                                                const topicSections = getSectionsForSelectedTopic(topic.id);
                                                                const highlightedSection = topicSections.find(section => section.id === highlightEditingSectionId && isSectionHighlightable(section));
                                                                const highlightedSectionRules = highlightedSection
                                                                    ? tableHighlights.filter(rule => rule.groupId === highlightedSection.id)
                                                                    : [];
                                                                return (
                                                                    <div key={topic.id} className="border border-pm-secondary/10 rounded-xl bg-[#fbfaf6] overflow-hidden">
                                                                        <div className="grid grid-cols-[auto,minmax(220px,1fr)] xl:grid-cols-[auto,minmax(260px,1fr),minmax(190px,240px),76px] gap-3 xl:gap-4 items-center p-3.5">
                                                                            <span className="w-8 h-8 rounded-lg bg-white border border-pm-secondary/15 text-pm-secondary flex items-center justify-center text-xs font-black">{topicIndex + 1}</span>
                                                                            <div className="min-w-0">
                                                                                <p className="text-base font-black text-pm-dark truncate">{topic.name}</p>
                                                                                <p className="text-[10px] text-pm-secondary uppercase font-black tracking-wider">{topicSections.length} seções incluídas</p>
                                                                            </div>
                                                                            <select
                                                                                aria-label={`Categoria de ${topic.name}`}
                                                                                value={getTopicCategory(topic.id)}
                                                                                onChange={event => assignTopicCategory(topic.id, event.target.value)}
                                                                                className="col-start-2 xl:col-start-auto border border-pm-secondary/20 rounded-lg px-2 py-2 text-xs font-bold text-pm-dark bg-white"
                                                                            >
                                                                                {[...reportCategories].sort(compareTextPtBr).map(option => (
                                                                                    <option key={option} value={option}>{option}</option>
                                                                                ))}
                                                                            </select>
                                                                            <div className="col-start-2 xl:col-start-auto flex justify-end gap-1">
                                                                                <button onClick={() => moveTopicItem(topic.id, topics, 'up')} disabled={topicIndex === 0} className="p-1.5 text-pm-secondary hover:text-pm-primary disabled:opacity-20 rounded-md hover:bg-pm-light"><ArrowUp className="w-4 h-4" /></button>
                                                                                <button onClick={() => moveTopicItem(topic.id, topics, 'down')} disabled={topicIndex === topics.length - 1} className="p-1.5 text-pm-secondary hover:text-pm-primary disabled:opacity-20 rounded-md hover:bg-pm-light"><ArrowDown className="w-4 h-4" /></button>
                                                                            </div>
                                                                        </div>
                                                                        <div className="border-t border-pm-secondary/10 bg-white/65 px-4 py-3">
                                                                            <div className="space-y-2">
                                                                                {topicSections.map(section => {
                                                                                    const orderedFields = getFieldsForSection(section.id);
                                                                                    return (
                                                                                        <div key={section.id} className="overflow-hidden rounded-lg bg-pm-light border border-pm-secondary/10">
                                                                                            <div className="flex items-center">
                                                                                                <span className="px-2.5 py-2 text-[11px] font-black text-pm-dark flex-1">{section.title}</span>
                                                                                                {canManageRegionalModel && isSectionHighlightable(section) && (
                                                                                                    <button
                                                                                                        onClick={() => setHighlightEditingSectionId(current => current === section.id ? '' : section.id)}
                                                                                                        className={`px-2.5 py-2 text-[10px] font-black uppercase border-l border-pm-secondary/10 transition-colors ${highlightEditingSectionId === section.id ? 'bg-pm-primary text-white' : 'text-pm-secondary hover:bg-white hover:text-pm-dark'}`}
                                                                                                    >
                                                                                                        Cor
                                                                                                    </button>
                                                                                                )}
                                                                                            </div>
                                                                                            {canManageRegionalModel && orderedFields.length > 0 && (
                                                                                                <div className="border-t border-pm-secondary/10 bg-white px-2.5 py-2">
                                                                                                    <p className="text-[9px] uppercase tracking-widest font-black text-pm-secondary mb-1.5">Ordem dos campos no relatório</p>
                                                                                                    <div className="space-y-1">
                                                                                                        {orderedFields.map((field, fieldIndex) => (
                                                                                                            <div key={field.id} className="flex items-center gap-2 rounded-md border border-pm-secondary/10 bg-[#fbfaf6] px-2 py-1">
                                                                                                                <span className="w-5 text-[10px] font-black text-pm-secondary">{fieldIndex + 1}</span>
                                                                                                                <span className="text-[11px] font-bold text-pm-dark flex-1 truncate">{field.label}</span>
                                                                                                                <button onClick={() => moveField(section.id, field.id, 'up')} disabled={fieldIndex === 0} className="p-1 text-pm-secondary hover:text-pm-primary disabled:opacity-20 rounded hover:bg-pm-light"><ArrowUp className="w-3.5 h-3.5" /></button>
                                                                                                                <button onClick={() => moveField(section.id, field.id, 'down')} disabled={fieldIndex === orderedFields.length - 1} className="p-1 text-pm-secondary hover:text-pm-primary disabled:opacity-20 rounded hover:bg-pm-light"><ArrowDown className="w-3.5 h-3.5" /></button>
                                                                                                            </div>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                            {canManageRegionalModel && highlightedSection && (
                                                                                <div className="mt-3 rounded-xl border border-pm-secondary/15 bg-[#fbfaf6] p-3">
                                                                                    <div className="flex items-start justify-between gap-3 mb-3">
                                                                                        <div>
                                                                                            <p className="text-[10px] uppercase tracking-widest font-black text-pm-secondary">Destaque de tabela</p>
                                                                                            <p className="text-sm font-black text-pm-dark">{highlightedSection.title}</p>
                                                                                        </div>
                                                                                        <button onClick={() => setHighlightEditingSectionId('')} className="p-1.5 rounded-md text-pm-secondary hover:text-pm-dark hover:bg-white"><X className="w-4 h-4" /></button>
                                                                                    </div>
                                                                                    <div className="grid grid-cols-2 xl:grid-cols-[140px,110px,110px,180px,auto] gap-2 items-end">
                                                                                        <label className="text-[10px] uppercase tracking-wide font-black text-pm-secondary">
                                                                                            Aplicar em
                                                                                            <select value={highlightTarget} onChange={event => setHighlightTarget(event.target.value as ReportHighlightTarget)} className="block mt-1 w-full border border-pm-secondary/20 rounded-lg px-2 py-2 text-xs font-bold text-pm-dark bg-white">
                                                                                                <option value="row">Linha</option>
                                                                                                <option value="column">Coluna</option>
                                                                                                <option value="cell">Célula</option>
                                                                                            </select>
                                                                                        </label>
                                                                                        {highlightTarget !== 'column' && (
                                                                                            <label className="text-[10px] uppercase tracking-wide font-black text-pm-secondary">
                                                                                                Linha
                                                                                                <input type="number" min={1} value={highlightRow} onChange={event => setHighlightRow(Math.max(1, Number(event.target.value) || 1))} className="block mt-1 w-full border border-pm-secondary/20 rounded-lg px-2 py-2 text-xs font-bold text-pm-dark bg-white" />
                                                                                            </label>
                                                                                        )}
                                                                                        {highlightTarget !== 'row' && (
                                                                                            <label className="text-[10px] uppercase tracking-wide font-black text-pm-secondary">
                                                                                                Coluna
                                                                                                <input type="number" min={1} value={highlightColumn} onChange={event => setHighlightColumn(Math.max(1, Number(event.target.value) || 1))} className="block mt-1 w-full border border-pm-secondary/20 rounded-lg px-2 py-2 text-xs font-bold text-pm-dark bg-white" />
                                                                                            </label>
                                                                                        )}
                                                                                        <label className="text-[10px] uppercase tracking-wide font-black text-pm-secondary">
                                                                                            Cor
                                                                                            <select value={highlightColor} onChange={event => setHighlightColor(event.target.value as ReportHighlightColor)} className="block mt-1 w-full border border-pm-secondary/20 rounded-lg px-2 py-2 text-xs font-bold text-pm-dark bg-white">
                                                                                                {REPORT_HIGHLIGHT_COLORS.map(color => (
                                                                                                    <option key={color.value} value={color.value}>{color.label}</option>
                                                                                                ))}
                                                                                            </select>
                                                                                        </label>
                                                                                        <button onClick={() => addTableHighlight(highlightedSection.id)} className="px-3 py-2 rounded-lg bg-pm-dark text-white text-xs font-black uppercase hover:bg-pm-primary flex items-center gap-1.5">
                                                                                            Aplicar
                                                                                        </button>
                                                                                    </div>
                                                                                    {highlightedSectionRules.length > 0 && (
                                                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                                                            {highlightedSectionRules.map(rule => {
                                                                                                const color = REPORT_HIGHLIGHT_COLORS.find(item => item.value === rule.color);
                                                                                                const location = rule.target === 'row'
                                                                                                    ? `linha ${(rule.rowIndex ?? 0) + 1}`
                                                                                                    : rule.target === 'column'
                                                                                                        ? `coluna ${(rule.columnIndex ?? 0) + 1}`
                                                                                                        : `linha ${(rule.rowIndex ?? 0) + 1}, coluna ${(rule.columnIndex ?? 0) + 1}`;
                                                                                                return (
                                                                                                    <span key={rule.id} className="inline-flex items-center gap-1.5 rounded-lg border border-pm-secondary/15 bg-white px-2 py-1 text-[11px] font-bold text-pm-dark">
                                                                                                        <span className={`w-3 h-3 rounded-sm border border-pm-secondary/20 ${color?.swatch || 'bg-pm-light'}`} />
                                                                                                        {REPORT_HIGHLIGHT_TARGET_LABELS[rule.target]}: {location}
                                                                                                        <button onClick={() => removeTableHighlight(rule.id)} className="ml-1 text-pm-secondary hover:text-red-700"><X className="w-3.5 h-3.5" /></button>
                                                                                                    </span>
                                                                                                );
                                                                                            })}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </section>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </main>
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 overflow-hidden bg-[#dedbd1]">
                        <div className="h-full overflow-auto custom-scrollbar p-2 sm:p-4 md:p-6">
                            {isPrintable ? (
                                <div className="mx-auto bg-white shadow-2xl ring-1 ring-black/10 origin-top report-preview-sheet w-full max-w-[210mm] md:w-[210mm] min-h-[70vh] md:min-h-[297mm] overflow-hidden">
                                    <RegionalReportPdfRenderer {...pdfRendererProps} />
                                </div>
                            ) : (
                                <div className="h-full min-h-[200px] sm:min-h-[280px] flex items-center justify-center text-center p-4 sm:p-8">
                                    <div className="bg-white border border-pm-secondary/15 rounded-2xl p-8 max-w-md shadow-sm">
                                        <FileText className="w-10 h-10 text-pm-secondary/45 mx-auto mb-3" />
                                        <p className="text-lg font-black text-pm-dark">Sem conteúdo para prévia</p>
                                        <p className="text-sm text-pm-secondary mt-1">Selecione comando, tópicos e seções para visualizar o relatório em A4.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="bg-white px-4 md:px-5 py-3 border-t border-pm-secondary/15 flex flex-col xl:flex-row xl:items-center justify-between gap-3 shrink-0">
                    <div className="hidden md:flex items-center gap-3 min-w-0">
                        <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${isPrintable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            <ClipboardCheck className="w-5 h-5" />
                        </span>
                        <div>
                            <p className="text-sm font-black text-pm-dark">
                                {isPrintable ? 'Briefing regional pronto para impressão' : 'Selecione comando, tópico e seção'}
                            </p>
                            <p className="text-xs text-pm-secondary">
                                {selectedTopics.length} tópicos, {selectedSections.length} seções e {selectedCategoryCount} categorias com conteúdo.
                            </p>
                            {modelMessage && (
                                <p className={`text-xs font-bold mt-1 ${modelMessage.type === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
                                    {modelMessage.text}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:flex gap-2 md:gap-3 w-full xl:w-auto">
                        <button onClick={onClose} className="hidden md:block px-4 md:px-5 py-2.5 text-sm font-bold text-pm-secondary hover:bg-pm-light rounded-lg transition-colors">
                            Cancelar
                        </button>
                        <button
                            onClick={reloadSavedModel}
                            disabled={isSavingModel || isLoadingSavedModel}
                            className="hidden md:flex px-3 md:px-4 py-2.5 text-sm font-black bg-white text-pm-dark rounded-lg hover:bg-pm-light transition-all border border-pm-secondary/20 items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isLoadingSavedModel ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                            Carregar modelo regional
                        </button>
                        {canManageRegionalModel && (
                            <button
                                onClick={saveReportConfiguration}
                                disabled={isSavingModel || isLoadingSavedModel}
                                className="hidden md:flex px-3 md:px-5 py-2.5 text-sm font-black bg-white text-pm-dark rounded-lg hover:bg-pm-light transition-all border border-pm-secondary/20 items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isSavingModel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {isSavingModel ? 'Publicando...' : 'Publicar modelo regional'}
                            </button>
                        )}
                        <button
                            onClick={() => setReportMode(reportMode === 'preview' ? 'builder' : 'preview')}
                            disabled={!isPrintable}
                            className="hidden md:flex px-3 md:px-5 py-2.5 text-sm font-black bg-white text-pm-dark rounded-lg hover:bg-pm-light transition-all border border-pm-secondary/20 items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {effectiveReportMode === 'preview' ? <SlidersHorizontal className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            {effectiveReportMode === 'preview' ? 'Editar montagem' : 'Ver prévia'}
                        </button>
                        <button
                            onClick={() => isMobile ? handleDownloadPdf() : handlePrint()}
                            disabled={!isPrintable || isGeneratingPdf}
                            className="px-6 py-3 md:py-2.5 text-sm font-black bg-pm-primary text-pm-light rounded-lg hover:bg-pm-primary/90 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : isMobile ? <Download className="w-4 h-4" /> : <Printer className="w-4 h-4" />}
                            {isMobile ? (isGeneratingPdf ? 'Gerando PDF...' : 'Baixar PDF') : 'Baixar / Imprimir PDF'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="fixed left-[-10000px] top-0 w-[210mm] bg-white pointer-events-none" aria-hidden="true">
                <div ref={printRef} data-pdf-target="desktop-report">
                    <RegionalReportPdfRenderer {...pdfRendererProps} />
                </div>
            </div>
        </div>
    );
}
