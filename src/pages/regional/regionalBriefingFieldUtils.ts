import { formatBrazilianNumber, parseBrazilianNumber } from '../../utils/brazilianNumbers';
import type { RegionalBriefingField } from '../../store/AuthContext';

export const parseRegionalNumber = (value: unknown) => {
    if (value === null || value === undefined || value === '') return null;
    const numeric = parseBrazilianNumber(value);
    return Number.isFinite(numeric) ? numeric : null;
};

export const getRegionalStoredValue = (
    field: RegionalBriefingField,
    value?: { valueText: string | null; valueNumber: number | null }
) => {
    if (!value) return '';
    if (['number', 'percentage', 'currency'].includes(field.fieldType)) {
        return value.valueNumber !== null && value.valueNumber !== undefined
            ? formatBrazilianNumber(Number(value.valueNumber), field.fieldType === 'currency')
            : '';
    }
    return value.valueText ?? '';
};

export const buildRegionalValuePayload = (field: RegionalBriefingField, rawValue: string) => {
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

const resolveRegionalCalculationSources = (config: unknown): string[] => {
    if (!config || typeof config !== 'object') return [];
    const record = config as Record<string, unknown>;
    if (Array.isArray(record.sourceFieldIds)) {
        return record.sourceFieldIds.filter((item): item is string => typeof item === 'string');
    }
    if (Array.isArray(record.fields)) {
        return record.fields.filter((item): item is string => typeof item === 'string');
    }
    return [];
};

export const calculateRegionalFieldValue = (
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

    const operation = (field.calculationConfig as { operation?: string }).operation;
    if (operation === 'sum') {
        return sourceValues.reduce((acc, val) => acc + val, 0);
    }
    if (operation === 'subtract') {
        if (sourceValues.length === 0) return 0;
        return sourceValues.slice(1).reduce((acc, val) => acc - val, sourceValues[0]);
    }
    return null;
};

export const formDataToRegionalValues = (
    formData: Record<string, string>,
    sectionFields: RegionalBriefingField[]
): Record<string, { valueText: string | null; valueNumber: number | null }> => {
    const valuesByFieldId: Record<string, { valueText: string | null; valueNumber: number | null }> = {};

    sectionFields.forEach(field => {
        if (field.fieldType === 'calculated') return;
        const rawValue = formData[field.id] ?? '';
        if (['number', 'percentage', 'currency'].includes(field.fieldType)) {
            valuesByFieldId[field.id] = {
                valueText: null,
                valueNumber: parseRegionalNumber(rawValue)
            };
        } else {
            valuesByFieldId[field.id] = {
                valueText: rawValue || null,
                valueNumber: null
            };
        }
    });

    return valuesByFieldId;
};
