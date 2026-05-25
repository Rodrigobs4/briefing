import { useEffect, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import {
    Activity,
    BarChart3,
    Building2,
    CalendarDays,
    Check,
    ClipboardList,
    Database,
    Filter,
    FileCheck2,
    FileText,
    History,
    Layers3,
    Loader2,
    Map as MapIcon,
    MapPinned,
    Plus,
    Printer,
    Save,
    Search,
    Shield,
    Square,
    Users,
    Wrench
} from 'lucide-react';
import { useAuth, calculateFieldValue, RegionalBriefingField, RegionalBriefingSection } from '../../store/AuthContext';
import { useSettings } from '../../store/SettingsContext';
import { getPublicUploadUrl } from '../../utils/storageUrls';
import { supabase } from '../../lib/supabase';
import { compareTextPtBr, sortByTextPtBr } from '../../utils/textOrdering';
import { formatBrazilianNumber, formatBrazilianNumericInput, parseBrazilianNumber } from '../../utils/brazilianNumbers';

type RegionalBriefingPdfProps = {
    regionName: string;
    selectedUnits: string[];
    selectedGroups: string[];
};

type RegionalUpdateFrequency = 'fixed' | 'weekly' | 'monthly' | 'semester' | 'yearly' | 'custom';
const ALPHABETICAL_UPDATE_FREQUENCIES: RegionalUpdateFrequency[] = ['yearly', 'fixed', 'custom', 'weekly', 'semester'];

const formatValue = (field: any, value: any) => {
    if (value === null || value === undefined || value === '') return '-';
    if (field.type === 'percentage') return `${Number(value).toLocaleString('pt-BR')}%`;
    if (field.type === 'currency') return formatBrazilianNumber(Number(value), true);
    if (field.type === 'number' || field.type === 'calculated') return Number(value).toLocaleString('pt-BR');
    return String(value);
};

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
    if (field.fieldType === 'number') {
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

function RegionalBriefingPdfRenderer({ regionName, selectedUnits, selectedGroups }: RegionalBriefingPdfProps) {
    const { units, dataGroups, fields, entries, getValuesForEntry, collectionItems, getValuesForItem } = useAuth();
    const { settings } = useSettings();

    const logoUrl = settings?.logo_path ? getPublicUploadUrl(settings.logo_path) : null;
    const bgUrl = settings?.bg_path ? getPublicUploadUrl(settings.bg_path) : null;
    const generatedAt = new Date();
    const unitsToRender = units
        .filter(unit => selectedUnits.includes(unit.id))
        .sort((a, b) => (a.order_index ?? 999) - (b.order_index ?? 999));
    const getGeneralCategory = (group: { unitId: string; categoryTitle?: string | null }) =>
        units.find(unit => unit.id === group.unitId)?.reportCategoryTitle?.trim()
        || group.categoryTitle?.trim()
        || 'Geral';
    const getGeneralCategoryOrder = (group: { unitId: string; categoryOrder?: number }) =>
        units.find(unit => unit.id === group.unitId)?.reportCategoryOrder
        ?? group.categoryOrder
        ?? 999;
    const selectedDataGroups = dataGroups
        .filter(group => selectedGroups.includes(group.id) && selectedUnits.includes(group.unitId))
        .sort((a, b) => getGeneralCategoryOrder(a) - getGeneralCategoryOrder(b) || a.order - b.order);
    const categories = Array.from(new Set(selectedDataGroups.map(getGeneralCategory)));
    const ascomNames = Array.from(new Set(unitsToRender.map(unit => unit.regionalAscom?.trim()).filter(Boolean) as string[]));

    const totals = {
        units: unitsToRender.length,
        sections: selectedDataGroups.length,
        records: entries.filter(entry => selectedUnits.includes(entry.unitId) && selectedGroups.includes(entry.dataGroupId)).length,
        collections: collectionItems.filter(item => selectedUnits.includes(item.unitId) && selectedGroups.includes(item.dataGroupId) && item.status !== 'archived').length
    };
    const categoryIcons = [Users, Activity, Shield, ClipboardList, Building2, Wrench, FileCheck2, Database];

    const consolidatedByCategory = categories.map(category => {
        const categoryGroups = selectedDataGroups.filter(group => getGeneralCategory(group) === category);
        const sectionMap = new Map<string, {
            title: string;
            metrics: Map<string, { label: string; type: string; values: number[]; texts: string[]; units: Set<string> }>;
            records: Array<{ unit: string; title: string; details: string; updatedAt: string }>;
        }>();

        categoryGroups.forEach(group => {
            const unit = units.find(item => item.id === group.unitId);
            const sectionKey = normalizeRegionalKey(group.title);
            const section = sectionMap.get(sectionKey) ?? {
                title: group.title,
                metrics: new Map(),
                records: [] as Array<{ unit: string; title: string; details: string; updatedAt: string }>
            };

            if (group.mode === 'collection') {
                collectionItems
                    .filter(item => item.unitId === group.unitId && item.dataGroupId === group.id && item.status !== 'archived')
                    .forEach(item => {
                        const values = getValuesForItem(item.id)
                            .map((fieldValue: any) => ({ value: fieldValue, field: fields.find(field => field.id === fieldValue.fieldId) }))
                            .filter(({ field }) => field);
                        const title = values.find(({ field, value }) => field?.type === 'text' && value.valueText)?.value.valueText || 'Registro';
                        const details = values
                            .map(({ field, value }) => {
                                const formatted = formatCollectionValue(field, value);
                                return formatted ? `${field?.name}: ${formatted}` : null;
                            })
                            .filter(Boolean)
                            .join(' | ');

                        section.records.push({
                            unit: unit?.name || 'Unidade',
                            title,
                            details: details || 'Sem informações preenchidas.',
                            updatedAt: new Date(item.updatedAt).toLocaleDateString('pt-BR')
                        });
                    });
            } else {
                const entry = entries
                    .filter(item => item.unitId === group.unitId && item.dataGroupId === group.id)
                    .sort((a, b) => (b.referenceYear ?? -1) - (a.referenceYear ?? -1) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
                const values = entry ? getValuesForEntry(entry.id) : [];
                const groupFields = fields.filter(field => field.dataGroupId === group.id && field.isActive && field.type !== 'image').sort((a, b) => a.order - b.order);

                groupFields.forEach(field => {
                    const fieldValue = values.find(value => value.fieldId === field.id);
                    let rawValue = fieldValue ? fieldValue.value : null;
                    if ((rawValue === null || rawValue === undefined || rawValue === '') && field.type === 'calculated') {
                        const formData = values.reduce((acc, current) => {
                            acc[current.fieldId] = current.value;
                            return acc;
                        }, {} as Record<string, any>);
                        rawValue = calculateFieldValue(field, formData, fields, true);
                    }

                    if (rawValue === null || rawValue === undefined || rawValue === '') return;

                    const metricKey = normalizeRegionalKey(field.name);
                    const metric = section.metrics.get(metricKey) ?? {
                        label: field.name,
                        type: field.type,
                        values: [],
                        texts: [],
                        units: new Set<string>()
                    };
                    const numericValue = ['number', 'currency', 'calculated', 'percentage'].includes(field.type) ? parseRegionalNumber(rawValue) : null;

                    if (numericValue !== null) {
                        metric.values.push(numericValue);
                    } else {
                        metric.texts.push(`${unit?.name || 'Unidade'}: ${rawValue}`);
                    }
                    metric.units.add(unit?.name || 'Unidade');
                    section.metrics.set(metricKey, metric);
                });
            }

            sectionMap.set(sectionKey, section);
        });

        return {
            category,
            sections: Array.from(sectionMap.values()).map(section => ({
                ...section,
                metrics: Array.from(section.metrics.values())
            }))
        };
    });

    return (
        <div className="regional-print-root bg-white text-slate-950 font-sans">
            <section className="regional-cover">
                {bgUrl && <img src={bgUrl} alt="" className="regional-cover-bg" />}
                <div className="regional-cover-shade" />
                <div className="regional-cover-topline">
                    <span>Polícia Militar da Bahia</span>
                    <span>{generatedAt.toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="regional-cover-content">
                    {logoUrl && <img src={logoUrl} alt="Logo" className="regional-cover-logo" />}
                    <div className="regional-cover-badge">
                        <Shield size={16} />
                        Briefing de Comando Regional
                    </div>
                    <h1>BRIEFING</h1>
                    <h2>REGIÃO {regionName.toUpperCase()}</h2>
                    <p>{ascomNames.join(' • ') || 'ASCOM Regional'}</p>
                </div>
                <div className="regional-cover-footer">PMBA, UMA FORÇA A SERVIÇO DO CIDADÃO!</div>
            </section>

            <section className="regional-page">
                <header className="regional-page-header">
                    <div className="regional-page-title">
                        <span>Briefing Regional</span>
                        <h2>Região {regionName}</h2>
                    </div>
                    <div className="regional-page-date">
                        <CalendarDays size={16} />
                        <strong>{generatedAt.toLocaleDateString('pt-BR')}</strong>
                    </div>
                </header>

                <div className="regional-summary-grid">
                    <div><Users size={18} /><span>Unidades</span><strong>{totals.units}</strong></div>
                    <div><Layers3 size={18} /><span>Seções</span><strong>{totals.sections}</strong></div>
                    <div><BarChart3 size={18} /><span>Indicadores</span><strong>{totals.records}</strong></div>
                    <div><ClipboardList size={18} /><span>Registros</span><strong>{totals.collections}</strong></div>
                </div>

                <div className="regional-intro-panel">
                    <MapIcon size={18} />
                    <div>
                        <h3>Composição do briefing</h3>
                        <p>Relatório consolidado com dados preenchidos pelas unidades vinculadas ao comando selecionado, mantendo a base original por unidade para conferência.</p>
                    </div>
                </div>

                <div className="regional-map">
                    {unitsToRender.map(unit => (
                        <div key={unit.id}>
                            <strong>{unit.name}</strong>
                            <span>{unit.name}{unit.regionalAscom ? ` • ${unit.regionalAscom}` : ''}</span>
                        </div>
                    ))}
                </div>
            </section>

            {categories.map((category, categoryIndex) => {
                const categoryGroups = selectedDataGroups.filter(group => getGeneralCategory(group) === category);
                const consolidatedCategory = consolidatedByCategory.find(item => item.category === category);
                if (categoryGroups.length === 0) return null;
                const CategoryIcon = categoryIcons[categoryIndex % categoryIcons.length];

                return (
                    <section key={category} className="regional-page">
                        <div className="regional-category-header">
                            <span><CategoryIcon size={20} /></span>
                            <div>
                                <h2>{category}</h2>
                                <p>{String(categoryIndex + 1).padStart(2, '0')} • {categoryGroups.length} seção(ões) incluída(s)</p>
                            </div>
                        </div>

                        {consolidatedCategory?.sections.map(section => (
                            <div key={section.title} className="regional-consolidated-block">
                                <h3>
                                    <span className="regional-block-icon"><Activity size={15} /></span>
                                    <span className="regional-block-label">Consolidado Regional</span>
                                    <span className="regional-block-title">{section.title}</span>
                                </h3>
                                {section.metrics.length > 0 && (
                                    <div className="regional-panel">
                                        <h4><BarChart3 size={13} />Indicadores compostos da região</h4>
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Indicador</th>
                                                    <th>Resultado regional</th>
                                                    <th>Base</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {section.metrics.map(metric => {
                                                    const isPercentage = metric.type === 'percentage';
                                                    const isCurrency = metric.type === 'currency';
                                                    const numericTotal = metric.values.reduce((sum, item) => sum + item, 0);
                                                    const value = metric.values.length > 0
                                                        ? (isPercentage
                                                            ? `${(numericTotal / metric.values.length).toLocaleString('pt-BR')}%`
                                                            : isCurrency
                                                                ? formatBrazilianNumber(numericTotal, true)
                                                                : numericTotal.toLocaleString('pt-BR'))
                                                        : metric.texts.join(' | ');

                                                    return (
                                                        <tr key={metric.label}>
                                                            <td>{metric.label}</td>
                                                            <td>{value || '-'}</td>
                                                            <td>{metric.units.size} unidade(s)</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {section.records.length > 0 && (
                                    <div className="regional-panel">
                                        <h4><ClipboardList size={13} />Registros consolidados da região</h4>
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Unidade</th>
                                                    <th>Registro</th>
                                                    <th>Informações</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {section.records.map((record, index) => (
                                                    <tr key={`${record.title}-${index}`}>
                                                        <td>{record.unit}</td>
                                                        <td>{record.title}</td>
                                                        <td>{record.details}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ))}

                        <div className="regional-detail-title">Base de dados por unidade</div>

                        {unitsToRender.map(unit => {
                            const groupsForUnit = categoryGroups.filter(group => group.unitId === unit.id);
                            if (groupsForUnit.length === 0) return null;
                            const unitEntries = entries.filter(entry => entry.unitId === unit.id);

                            return (
                                <div key={unit.id} className="regional-unit-block">
                                    <h3>
                                        <span className="regional-unit-mark"><Building2 size={14} /></span>
                                        {unit.name}
                                        <span>{unit.name}</span>
                                    </h3>

                                    {groupsForUnit.map(group => {
                                        if (group.mode === 'collection') {
                                            const items = collectionItems
                                                .filter(item => item.unitId === unit.id && item.dataGroupId === group.id && item.status !== 'archived')
                                                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

                                            if (items.length === 0) return null;

                                            return (
                                                <div key={group.id} className="regional-panel">
                                                    <h4><ClipboardList size={13} />{group.title}</h4>
                                                    <table>
                                                        <thead>
                                                            <tr>
                                                                <th>Registro</th>
                                                                <th>Informações</th>
                                                                <th>Atualização</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {items.map(item => {
                                                                const values = getValuesForItem(item.id)
                                                                    .map((fieldValue: any) => ({ value: fieldValue, field: fields.find(field => field.id === fieldValue.fieldId) }))
                                                                    .filter(({ field }) => field);
                                                                const title = values.find(({ field, value }) => field?.type === 'text' && value.valueText)?.value.valueText || 'Registro';
                                                                const details = values
                                                                    .map(({ field, value }) => {
                                                                        const formatted = formatCollectionValue(field, value);
                                                                        return formatted ? `${field?.name}: ${formatted}` : null;
                                                                    })
                                                                    .filter(Boolean)
                                                                    .join(' | ');

                                                                return (
                                                                    <tr key={item.id}>
                                                                        <td>{title}</td>
                                                                        <td>{details || 'Sem informações preenchidas.'}</td>
                                                                        <td>{new Date(item.updatedAt).toLocaleDateString('pt-BR')}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            );
                                        }

                                        const groupFields = fields.filter(field => field.dataGroupId === group.id && field.isActive && field.type !== 'image').sort((a, b) => a.order - b.order);
                                        if (groupFields.length === 0) return null;
                                        const entry = unitEntries
                                            .filter(item => item.dataGroupId === group.id)
                                            .sort((a, b) => (b.referenceYear ?? -1) - (a.referenceYear ?? -1) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
                                        const values = entry ? getValuesForEntry(entry.id) : [];

                                        return (
                                            <div key={group.id} className="regional-panel">
                                                <h4><BarChart3 size={13} />{group.title}</h4>
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th>Indicador</th>
                                                            <th>Consolidado</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {groupFields.map(field => {
                                                            const fieldValue = values.find(value => value.fieldId === field.id);
                                                            let value = fieldValue ? fieldValue.value : null;
                                                            if ((value === null || value === undefined || value === '') && field.type === 'calculated') {
                                                                const formData = values.reduce((acc, current) => {
                                                                    acc[current.fieldId] = current.value;
                                                                    return acc;
                                                                }, {} as Record<string, any>);
                                                                value = calculateFieldValue(field, formData, fields, true);
                                                            }

                                                            return (
                                                                <tr key={field.id}>
                                                                    <td>{field.name}</td>
                                                                    <td>{formatValue(field, value)}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </section>
                );
            })}

            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 0; }
                    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .regional-cover, .regional-page { break-after: page; page-break-after: always; }
                    .regional-panel, .regional-unit-block, tr { break-inside: avoid; page-break-inside: avoid; }
                }
                .regional-print-root {
                    width: 100%;
                    color: #14213d;
                    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                }
                .regional-cover {
                    position: relative;
                    min-height: 297mm;
                    overflow: hidden;
                    background: #14213d;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                }
                .regional-cover-bg {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    filter: saturate(0.82) contrast(1.04);
                    opacity: 0.5;
                }
                .regional-cover-shade {
                    position: absolute;
                    inset: 0;
                    background:
                        linear-gradient(180deg, rgba(20, 33, 61, 0.78), rgba(20, 33, 61, 0.92)),
                        linear-gradient(135deg, rgba(181, 137, 0, 0.28), rgba(20, 33, 61, 0) 46%);
                }
                .regional-cover-topline {
                    position: absolute;
                    z-index: 1;
                    top: 22mm;
                    left: 20mm;
                    right: 20mm;
                    display: flex;
                    justify-content: space-between;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.28);
                    padding-bottom: 7mm;
                    font-size: 9px;
                    font-weight: 900;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                    color: rgba(255, 255, 255, 0.82);
                }
                .regional-cover-content { position: relative; z-index: 1; margin-top: -14mm; max-width: 168mm; }
                .regional-cover-logo { width: 88px; height: 88px; object-fit: contain; margin: 0 auto 18px; }
                .regional-cover-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.32);
                    border-radius: 999px;
                    padding: 8px 14px;
                    color: #f5d36a;
                    font-size: 10px;
                    font-weight: 950;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                    margin-bottom: 24px;
                }
                .regional-cover h1 { font-size: 56px; letter-spacing: 0.22em; font-weight: 300; margin: 0 0 16px; }
                .regional-cover h2 { font-size: 27px; font-weight: 950; margin: 0; letter-spacing: 0.03em; }
                .regional-cover p { font-size: 11px; font-weight: 850; letter-spacing: 0.14em; text-transform: uppercase; margin-top: 18px; color: rgba(255, 255, 255, 0.84); }
                .regional-cover-footer { position: absolute; z-index: 1; bottom: 24mm; left: 0; right: 0; font-size: 11px; font-weight: 900; letter-spacing: 0.12em; color: rgba(255, 255, 255, 0.86); }
                .regional-page { min-height: 297mm; padding: 17mm; background: #f6f7f2; }
                .regional-page-header {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    border-bottom: 3px solid #14213d;
                    padding-bottom: 10px;
                    margin-bottom: 18px;
                }
                .regional-page-title span { display: block; color: #8a6f19; font-size: 10px; font-weight: 950; text-transform: uppercase; letter-spacing: 0.16em; }
                .regional-page-title h2 { margin: 4px 0 0; font-size: 27px; text-transform: uppercase; font-weight: 950; color: #14213d; }
                .regional-page-date { display: flex; align-items: center; gap: 7px; color: #596579; font-size: 13px; font-weight: 900; }
                .regional-summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
                .regional-summary-grid div {
                    background: #ffffff;
                    border: 1px solid #d8deea;
                    border-radius: 8px;
                    padding: 13px;
                    position: relative;
                    overflow: hidden;
                }
                .regional-summary-grid div::before {
                    content: "";
                    position: absolute;
                    inset: 0 auto 0 0;
                    width: 4px;
                    background: #b58900;
                }
                .regional-summary-grid svg { color: #8a6f19; margin-bottom: 8px; }
                .regional-summary-grid span { display: block; color: #596579; font-size: 8.5px; text-transform: uppercase; font-weight: 950; letter-spacing: 0.1em; }
                .regional-summary-grid strong { display: block; color: #14213d; font-size: 31px; font-weight: 950; line-height: 1; margin-top: 5px; }
                .regional-intro-panel {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    background: #14213d;
                    color: white;
                    border-radius: 8px;
                    padding: 13px 14px;
                    margin-bottom: 14px;
                }
                .regional-intro-panel svg { color: #f5d36a; flex: 0 0 auto; margin-top: 1px; }
                .regional-intro-panel h3 { margin: 0 0 4px; font-size: 12px; font-weight: 950; text-transform: uppercase; letter-spacing: 0.06em; }
                .regional-intro-panel p { margin: 0; font-size: 10.5px; line-height: 1.55; color: rgba(255, 255, 255, 0.82); font-weight: 700; }
                .regional-map { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
                .regional-map div { background: white; border: 1px solid #d8deea; border-left: 5px solid #b58900; border-radius: 8px; padding: 10px; }
                .regional-map strong { display: block; font-size: 12px; font-weight: 950; text-transform: uppercase; color: #14213d; }
                .regional-map span { display: block; color: #596579; font-size: 10px; font-weight: 800; margin-top: 3px; line-height: 1.35; }
                .regional-category-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: #ffffff;
                    border: 1px solid #d8deea;
                    border-left: 7px solid #b58900;
                    border-radius: 8px;
                    padding: 13px;
                    margin-bottom: 16px;
                }
                .regional-category-header > span {
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #14213d;
                    color: #f5d36a;
                    border-radius: 8px;
                    font-weight: 950;
                }
                .regional-category-header h2 { margin: 0; font-size: 20px; font-weight: 950; text-transform: uppercase; color: #14213d; }
                .regional-category-header p { margin: 4px 0 0; color: #596579; font-size: 9.5px; font-weight: 950; text-transform: uppercase; letter-spacing: 0.1em; }
                .regional-unit-block { margin-bottom: 16px; }
                .regional-unit-block h3 {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: #14213d;
                    color: white;
                    border-radius: 8px 8px 0 0;
                    padding: 10px 12px;
                    font-size: 13px;
                    font-weight: 950;
                    text-transform: uppercase;
                    margin: 0;
                }
                .regional-unit-block h3 > span:not(.regional-unit-mark) { color: #cbd5e1; font-size: 9.5px; font-weight: 800; margin-left: 2px; text-transform: none; }
                .regional-unit-mark { display: inline-flex; color: #f5d36a; }
                .regional-consolidated-block { margin-bottom: 16px; break-inside: avoid; page-break-inside: avoid; }
                .regional-consolidated-block h3 {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: #8a6f19;
                    color: white;
                    border-radius: 8px 8px 0 0;
                    padding: 11px 12px;
                    font-size: 13px;
                    font-weight: 950;
                    text-transform: uppercase;
                    margin: 0;
                }
                .regional-block-icon { display: inline-flex; color: #fff4c7; }
                .regional-block-label { font-size: 12px; font-weight: 950; }
                .regional-block-title { color: #fff4c7; font-size: 9.5px; font-weight: 900; margin-left: auto; opacity: 0.95; }
                .regional-detail-title {
                    margin: 18px 0 10px;
                    padding-top: 12px;
                    border-top: 2px solid #d8deea;
                    color: #596579;
                    font-size: 9.5px;
                    font-weight: 950;
                    text-transform: uppercase;
                    letter-spacing: 0.16em;
                }
                .regional-panel {
                    background: white;
                    border: 1px solid #d8deea;
                    border-top: 0;
                    padding: 11px;
                }
                .regional-panel h4 {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin: 0 0 8px;
                    font-size: 11.5px;
                    font-weight: 950;
                    color: #14213d;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }
                .regional-panel h4 svg { color: #8a6f19; }
                .regional-panel table { width: 100%; border-collapse: collapse; table-layout: fixed; overflow: hidden; border-radius: 7px; }
                .regional-panel th { background: #14213d; color: white; text-align: left; font-size: 8.7px; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px; }
                .regional-panel td { border: 1px solid #e3e8f0; padding: 8px; font-size: 10.3px; font-weight: 750; color: #24324a; vertical-align: top; line-height: 1.38; }
                .regional-panel tbody tr:nth-child(even) td { background: #fbfcfe; }
                .regional-panel td:first-child { width: 34%; background: #f6f7f2; color: #14213d; }
            `}</style>
        </div>
    );
}

type RegionalBriefingProps = {
    mode?: 'full' | 'editor';
};

export default function RegionalBriefing({ mode = 'full' }: RegionalBriefingProps) {
    const isEditorMode = mode === 'editor';
    const {
        units: allUnits,
        dataGroups,
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
    const visibleUnits = user?.role === 'editor'
        ? allUnits.filter(unit => (user.unitIds && user.unitIds.length > 0 ? user.unitIds.includes(unit.id) : unit.id === user.unitId))
        : allUnits;
    const activeRegionalCommands = regionalCommands
        .filter(command => command.isActive)
        .sort((a, b) => compareTextPtBr(a.name, b.name));
    const legacyRegionOptions = Array.from(new Set(visibleUnits.map(unit => unit.regionName?.trim()).filter(Boolean) as string[])).sort(compareTextPtBr);
    const regionOptions = activeRegionalCommands.length > 0
        ? activeRegionalCommands.map(command => command.name).sort(compareTextPtBr)
        : legacyRegionOptions;
    const [selectedRegion, setSelectedRegion] = useState(regionOptions[0] || 'Todas as regiões');
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [activeUpdateFrequency, setActiveUpdateFrequency] = useState<RegionalUpdateFrequency>('weekly');
    const [periodYear, setPeriodYear] = useState(currentYear());
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
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (selectedRegion === 'Todas as regiões' && regionOptions.length > 0) {
            setSelectedRegion(regionOptions[0]);
            return;
        }
        if (selectedRegion !== 'Todas as regiões' && !regionOptions.includes(selectedRegion)) {
            setSelectedRegion(regionOptions[0] || 'Todas as regiões');
        }
    }, [regionOptions, selectedRegion]);

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
    const regionGroups = dataGroups
        .filter(group => unitIds.includes(group.unitId))
        .sort((a, b) => {
            const firstUnit = unitsForRegion.find(unit => unit.id === a.unitId);
            const secondUnit = unitsForRegion.find(unit => unit.id === b.unitId);
            return (firstUnit?.reportCategoryOrder ?? a.categoryOrder ?? 999) - (secondUnit?.reportCategoryOrder ?? b.categoryOrder ?? 999) || a.order - b.order;
        });
    const catalogSections = regionalBriefingSections
        .filter(section => section.isActive)
        .sort((a, b) => a.categoryOrder - b.categoryOrder || a.orderIndex - b.orderIndex);
    const selectedCommand = activeRegionalCommands.find(command => command.name === selectedRegion) ?? null;
    const referenceRange = getReferenceRangeByFrequency(activeUpdateFrequency, periodYear, periodSemester, weekStartDate, customStartDate, customEndDate);
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
    const selectedGroupIds = selectedGroups.length > 0 ? selectedGroups.filter(id => regionGroups.some(group => group.id === id)) : regionGroups.map(group => group.id);
    const isPrintable = unitIds.length > 0 && selectedGroupIds.length > 0;

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

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Briefing Regional - ${selectedRegion}`
    });

    const applyHistoryPeriod = (item: { frequency: RegionalUpdateFrequency; startDate: string; endDate: string }) => {
        setActiveUpdateFrequency(item.frequency);
        setSectionFilterSearch('');
        setActiveFillCategory('');

        if (item.frequency === 'weekly') {
            setWeekStartDate(item.startDate);
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

    const toggleGroup = (groupId: string) => {
        setSelectedGroups(prev => {
            const current = prev.length > 0 ? prev : regionGroups.map(group => group.id);
            return current.includes(groupId) ? current.filter(id => id !== groupId) : [...current, groupId];
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
        if (draft !== undefined) return draft;
        const entry = findSnapshotEntry(sectionId);
        const storedValue = entry ? regionalBriefingValues.find(value => value.entryId === entry.id && value.fieldId === field.id) : undefined;
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
                                    Componha o briefing preenchido pelo preposto do Comando Regional, com unidades informadas e indicadores previstos no modelo.
                                </p>
                            </div>
                            <button
                                onClick={() => handlePrint()}
                                disabled={!isPrintable}
                                className="px-6 py-3 rounded-xl bg-red-600 text-white text-sm font-black shadow-sm hover:bg-red-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Printer className="w-4 h-4" />
                                Imprimir briefing
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
                                onChange={event => {
                                    setSelectedRegion(event.target.value);
                                    setSelectedGroups([]);
                                }}
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
                                <strong className="block text-xl text-pm-dark">{selectedGroupIds.length || catalogSections.length}</strong>
                            </div>
                            <div className="bg-pm-light rounded-xl p-3 border border-pm-secondary/10">
                                <span className="text-[9px] font-black text-pm-secondary uppercase">Modelos</span>
                                <strong className="block text-xl text-pm-dark">{regionOptions.length}</strong>
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
                                {regionGroups.map(group => {
                                    const isSelected = selectedGroupIds.includes(group.id);
                                    const unit = allUnits.find(item => item.id === group.unitId);
                                    return (
                                        <button
                                            key={group.id}
                                            onClick={() => toggleGroup(group.id)}
                                            className={`w-full p-3 rounded-xl border text-left flex gap-3 transition-colors ${isSelected ? 'bg-pm-primary/10 border-pm-primary/35' : 'bg-white border-pm-secondary/10 hover:bg-pm-light/60'}`}
                                        >
                                            <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 ${isSelected ? 'bg-pm-primary border-pm-primary text-white' : 'border-pm-secondary/30'}`}>
                                                {isSelected ? <Check className="w-3 h-3" /> : <Square className="w-3 h-3 opacity-0" />}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block text-sm font-black text-pm-dark truncate">{group.title}</span>
                                                <span className="block text-[10px] uppercase tracking-wider font-bold text-pm-secondary mt-0.5">
                                                    {unit?.reportCategoryTitle?.trim() || group.categoryTitle?.trim() || 'Geral'} • {unit?.name || 'Unidade'}
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })}
                                {regionGroups.length === 0 && catalogSections.length > 0 && (
                                    <div className="space-y-2">
                                        {catalogSections.map(section => (
                                            <div key={section.id} className="p-3 rounded-xl border border-pm-secondary/10 bg-[#fbfaf6]">
                                                <p className="text-sm font-black text-pm-dark">{section.title}</p>
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-pm-secondary mt-0.5">
                                                    {section.categoryTitle} • {section.mode === 'collection' ? 'Registros múltiplos' : 'Indicador fixo'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {regionGroups.length === 0 && catalogSections.length === 0 && (
                                    <p className="text-sm text-pm-secondary text-center py-8">Nenhuma seção cadastrada para as unidades filtradas.</p>
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
                                    onChange={event => {
                                        setSelectedRegion(event.target.value);
                                        setSelectedGroups([]);
                                    }}
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
                            {['semester', 'yearly'].includes(activeUpdateFrequency) && (
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
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
                                        <h4 className="text-sm font-black text-pm-dark">Escolha uma área para preencher</h4>
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
                                    const sectionFields = getFieldsForSection(section.id).filter(field => field.fieldType !== 'calculated');
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
                                                        const value = section.mode === 'snapshot'
                                                            ? getSnapshotValue(section.id, field)
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
                                                                    {field.label}{field.isRequired ? ' *' : ''}
                                                                </span>
                                                                {isLongText ? (
                                                                    <textarea
                                                                        value={value}
                                                                        onChange={event => onChange(event.target.value)}
                                                                        rows={4}
                                                                        disabled={!selectedCommand}
                                                                        className="mt-1 w-full resize-y border border-pm-secondary/20 rounded-xl px-3 py-2.5 text-sm font-semibold text-pm-dark bg-white outline-none focus:ring-2 focus:ring-pm-primary/20 disabled:bg-slate-50 disabled:text-slate-400"
                                                                    />
                                                                ) : (
                                                                    <input
                                                                        type={['number', 'percentage', 'currency'].includes(field.fieldType) ? 'text' : field.fieldType === 'date' ? 'date' : 'text'}
                                                                        inputMode={['number', 'percentage', 'currency'].includes(field.fieldType) ? 'decimal' : undefined}
                                                                        value={value}
                                                                        onChange={event => onChange(event.target.value)}
                                                                        disabled={!selectedCommand}
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
                                                        disabled={!selectedCommand || isSaving || sectionFields.length === 0}
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
                                                                    {sectionFields.map(field => (
                                                                        <th key={field.id} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-pm-secondary border border-pm-secondary/10">
                                                                            {field.label}
                                                                        </th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {items.map(item => (
                                                                    <tr key={item.id}>
                                                                        {sectionFields.map(field => {
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
                        onClick={() => handlePrint()}
                        disabled={!isPrintable}
                        className="px-5 py-3 rounded-xl bg-red-600 text-white text-sm font-black shadow-sm hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Printer className="w-4 h-4" />
                        Imprimir briefing
                    </button>
                </div>
            </div>
            )}

            {!isEditorMode && (
            <div style={{ display: 'none' }}>
                <div ref={printRef}>
                    <RegionalBriefingPdfRenderer
                        regionName={selectedRegion}
                        selectedUnits={unitIds}
                        selectedGroups={selectedGroupIds}
                    />
                </div>
            </div>
            )}
        </div>
    );
}
