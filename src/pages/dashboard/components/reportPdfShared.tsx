import { formatBrazilianNumber } from '../../../utils/brazilianNumbers';
import { getReportYears } from '../../../utils/reportYears';
import { type ReactNode } from 'react';

export type ReportHighlightTarget = 'row' | 'column' | 'cell';
export type ReportHighlightColor = 'khaki' | 'blue' | 'green' | 'amber' | 'red';
export type ReportTableHighlightRule = {
    id: string;
    groupId: string;
    target: ReportHighlightTarget;
    rowIndex?: number;
    columnIndex?: number;
    color: ReportHighlightColor;
};

export { FIRST_REPORT_YEAR, CURRENT_REPORT_YEAR } from '../../../utils/reportYears';
// Colunas de ano do relatório: inclui anos anteriores a 2023 apenas quando houver dado.
export const getReportYearColumns = (yearsWithData: Iterable<string | number>) =>
    getReportYears(Array.from(yearsWithData)).map(String);
export const formatMonthlyPeriod = (period: string) => {
    const [year, month] = period.split('-').map(Number);
    return new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');
};

export type TableRow = ReactNode[] | { type: 'section'; label: string; groupId?: string };
export type RawMetricRow = TableRow | { type: 'yearly'; label: string; valuesByYear: Record<string, ReactNode>; showTotal: boolean; isCurrency: boolean; periodType?: 'yearly' | 'monthly' };
export type IconStatCardProps = {
    icon: ReactNode;
    label: string;
    value: string;
    description: string;
    tone?: 'khaki' | 'emerald' | 'amber' | 'slate';
};
export const SectionHeader = ({ title }: { title: string }) => (
    <div className="report-section-header bg-slate-100 border-l-4 border-slate-900 px-3 py-2 mb-2">
        <h2 className="text-[12px] font-black text-slate-900 uppercase tracking-tight">{title}</h2>
    </div>
);

export const TextSection = ({ title, values }: { title: string; values: ReactNode[] }) => (
    <div className="report-text-panel break-inside-avoid">
        <SectionHeader title={title} />
        <div className="report-text-content">
            {values.length > 0
                ? values.map((value, index) => <p key={index}>{value}</p>)
                : <p className="report-text-empty">Sem observações registradas.</p>}
        </div>
    </div>
);

export const IconStatCard = ({ icon, label, value, description, tone = 'slate' }: IconStatCardProps) => (
    <div className={`executive-stat-card executive-stat-card-${tone}`}>
        <div className="executive-stat-icon">{icon}</div>
        <div>
            <span>{label}</span>
            <strong>{value}</strong>
            <p>{description}</p>
        </div>
    </div>
);

export const parseDisplayNumber = (value: ReactNode) => {
    if (typeof value !== 'string') return null;
    if (value.includes('%')) return null;
    const numericValue = Number(value.replace(/R\$/gi, '').replace(/\./g, '').replace(',', '.').replace('%', '').trim());
    return Number.isFinite(numericValue) ? numericValue : null;
};

export const formatDisplayNumber = (value: number) => value.toLocaleString('pt-BR');

export const getMetricTotal = (valuesByYear: Record<string, ReactNode>, years: string[], isCurrency = false) => {
    const values = years.map(year => valuesByYear[year]).filter(value => value !== undefined && value !== null && value !== '-');
    if (values.length === 0) return '-';

    const numericValues = values.map(parseDisplayNumber);
    if (numericValues.length > 1 && numericValues.every(value => value !== null)) {
        const total = numericValues.reduce((sum, value) => sum + (value ?? 0), 0);
        return isCurrency ? formatBrazilianNumber(total, true) : formatDisplayNumber(total);
    }

    return values[0];
};

export const MetricValue = ({ value, label }: { value: ReactNode; label: ReactNode }) => {
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

export const getValueToneClass = (cell: ReactNode, columnIndex: number, rowLabel: ReactNode) => {
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

export const isDateOrPeriodField = (fieldName: string) => {
    const normalized = fieldName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    return ['data', 'periodo', 'prazo', 'inicio', 'fim', 'vigencia', 'competencia', 'mes', 'ano']
        .some(term => normalized.includes(term));
};

export const getYearMetricInfo = (fieldName: string) => {
    const yearMatch = fieldName.match(/\b(19|20)\d{2}\b/);
    if (!yearMatch) return null;

    const year = yearMatch[0];
    const baseName = normalizeMetricBaseName(fieldName, year);

    return {
        year,
        baseName
    };
};

export const normalizeMetricBaseName = (value: string, yearToRemove?: string) => {
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

export const getMetricGroupKey = (value: string) => normalizeMetricBaseName(value).toLowerCase();

export const getMetricLabelWithoutYear = (fieldName: string, fallback = 'Total') => {
    const normalized = normalizeMetricBaseName(fieldName);
    return normalized || fallback;
};

export const getYearFromText = (value: string) => value.match(/\b(19|20)\d{2}\b/)?.[0] ?? null;

export const formatCollectionValue = (field: any, value: any) => {
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

export const isExplicitTotalField = (field: any) => {
    const normalizedName = String(field?.name ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    return normalizedName === 'total' || normalizedName === 'total geral';
};

export const getCollectionColumnWidths = (collectionFields: any[], showTotalColumn = false) => {
    if (collectionFields.length === 0) return [];

    const weights: number[] = collectionFields.map(field => {
        if (field.type === 'currency') return 1.35;
        if (['number', 'percentage', 'calculated'].includes(field.type)) return 0.85;
        if (field.type === 'textarea') return 2.6;
        if (isDateOrPeriodField(field.name)) return 1;
        return 1.8;
    });
    if (showTotalColumn) weights.push(0.9);

    const totalWeight = weights.reduce((total, weight) => total + weight, 0);

    return weights.map(weight => `${((weight / totalWeight) * 100).toFixed(2)}%`);
};

export const HIGHLIGHT_CLASS_BY_COLOR: Record<ReportHighlightColor, string> = {
    khaki: 'report-highlight-khaki',
    blue: 'report-highlight-blue',
    green: 'report-highlight-green',
    amber: 'report-highlight-amber',
    red: 'report-highlight-red'
};

export const getCellHighlightClass = (highlightRules: ReportTableHighlightRule[], rowIndex: number, columnIndex: number) => {
    const reversedRules = [...highlightRules].reverse();
    const rule = reversedRules.find(item => item.target === 'cell' && item.rowIndex === rowIndex && item.columnIndex === columnIndex)
        ?? reversedRules.find(item => item.target === 'row' && item.rowIndex === rowIndex)
        ?? reversedRules.find(item => item.target === 'column' && item.columnIndex === columnIndex);

    return rule ? HIGHLIGHT_CLASS_BY_COLOR[rule.color] : '';
};

export const getColumnHighlightClass = (highlightRules: ReportTableHighlightRule[], columnIndex: number) => {
    const rule = [...highlightRules].reverse().find(item => item.target === 'column' && item.columnIndex === columnIndex);
    return rule ? HIGHLIGHT_CLASS_BY_COLOR[rule.color] : '';
};

export const CompactTable = ({
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
        <table className={`w-full text-left border-collapse bg-white table-fixed report-table-${variant} ${financial ? 'report-table-financial' : ''} ${narrative ? 'report-table-narrative' : ''} ${headers.length >= 10 ? 'report-table-many-columns' : ''}`}>
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
                                <td key={j} className={`px-3 py-2 text-[11px] font-bold border-r border-slate-100 last:border-0 ${j === 0 ? 'bg-slate-50/40 text-slate-900' : getValueToneClass(cell, j, row[0])} ${j > 0 && typeof cell === 'string' && cell !== '-' ? 'report-table-text-cell' : ''} ${getCellHighlightClass(highlightRules, dataRowIndex, j)}`}>
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

export const REPORT_PDF_STYLES = `
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
                    overflow-wrap: normal;
                    word-break: normal;
                    white-space: normal;
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
                    overflow-wrap: normal;
                    word-break: normal;
                    white-space: normal;
                }

                .report-table-metrics td:first-child {
                    width: 34%;
                    white-space: normal;
                    overflow-wrap: normal;
                    word-break: normal;
                }

                .report-table-metrics td:nth-child(2) {
                    font-size: 13px;
                    line-height: 1.4;
                }

                .report-table-metrics th:not(:first-child),
                .report-table-metrics td:not(:first-child) {
                    text-align: center;
                }

                .report-table-metrics td.report-table-text-cell {
                    text-align: left;
                    line-height: 1.45;
                    overflow-wrap: normal;
                    word-break: normal;
                    white-space: normal;
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

                .report-table-financial .report-metric-value {
                    font-size: 12px !important;
                    letter-spacing: -0.025em;
                }

                .report-table-financial .report-metric-value-long,
                .report-table-financial .report-metric-value-xlong {
                    font-size: 10.5px !important;
                    letter-spacing: -0.04em;
                }

                .report-table-many-columns th {
                    font-size: 8px !important;
                    padding-left: 2px !important;
                    padding-right: 2px !important;
                    letter-spacing: 0;
                    white-space: nowrap;
                }

                .report-table-many-columns td {
                    padding-left: 3px !important;
                    padding-right: 3px !important;
                }

                .report-font-large .report-table-many-columns th {
                    font-size: 8px !important;
                    padding-left: 2px !important;
                    padding-right: 2px !important;
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
`;
