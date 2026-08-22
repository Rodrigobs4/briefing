import { type ReportTableHighlightRule } from '../dashboard/components/reportPdfShared';

export type SavedRegionalReportConfiguration = {
    selectedTopics: string[];
    selectedSections: string[];
    customCategories: string[];
    categoryOrder: string[];
    topicOrder: string[];
    sectionOrder: string[];
    fieldOrder: Record<string, string[]>;
    topicAssignments: Record<string, string>;
    fontSize: 'standard' | 'large';
    technicalSections: {
        showExecutiveSummary: boolean;
        showSubjectMap: boolean;
    };
    tableHighlights?: ReportTableHighlightRule[];
};

const STORAGE_PREFIX = 'pmba_regional_report_config';

export const getRegionalConfigStorageKey = (regionalCommandId: string) =>
    `${STORAGE_PREFIX}_${regionalCommandId}`;

export const loadRegionalReportConfiguration = (regionalCommandId: string): SavedRegionalReportConfiguration | null => {
    try {
        const raw = localStorage.getItem(getRegionalConfigStorageKey(regionalCommandId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<SavedRegionalReportConfiguration>;
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed as SavedRegionalReportConfiguration;
    } catch {
        return null;
    }
};

export const saveRegionalReportConfiguration = (
    regionalCommandId: string,
    configuration: SavedRegionalReportConfiguration
) => {
    localStorage.setItem(getRegionalConfigStorageKey(regionalCommandId), JSON.stringify(configuration));
};
