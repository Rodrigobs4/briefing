export const parseBrazilianNumber = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    if (value === null || value === undefined) return NaN;

    const normalized = String(value)
        .replace(/R\$/gi, '')
        .replace(/%/g, '')
        .replace(/\s/g, '')
        .replace(/\./g, '')
        .replace(',', '.');

    if (!/^-?\d*(?:\.\d*)?$/.test(normalized) || normalized === '' || normalized === '-' || normalized === '.' || normalized === '-.') {
        return NaN;
    }

    return Number(normalized);
};

export const formatBrazilianNumber = (value: number, currency = false): string => {
    if (!Number.isFinite(value)) return '';

    return value.toLocaleString('pt-BR', currency
        ? { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }
        : { maximumFractionDigits: 20 });
};

export const formatStoredNumericValue = (value: unknown, currency = false): string => {
    if (value === null || value === undefined || value === '') return '';
    const numericValue = typeof value === 'number' ? value : Number(String(value));
    return formatBrazilianNumber(numericValue, currency);
};

export const formatBrazilianNumericInput = (value: string, currency = false): string => {
    const cleaned = value.replace(/R\$/gi, '').replace(/%/g, '').replace(/\s/g, '');
    if (!cleaned) return '';

    const isNegative = cleaned.startsWith('-');
    const unsigned = cleaned.replace(/-/g, '');
    const commaIndex = unsigned.indexOf(',');
    const hasDecimalSeparator = commaIndex >= 0;
    const integerRaw = (hasDecimalSeparator ? unsigned.slice(0, commaIndex) : unsigned).replace(/\D/g, '');
    let decimalRaw = hasDecimalSeparator ? unsigned.slice(commaIndex + 1).replace(/\D/g, '') : '';
    if (currency) decimalRaw = decimalRaw.slice(0, 2);

    const integerValue = integerRaw ? Number(integerRaw).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '0';
    const numberText = `${isNegative ? '-' : ''}${integerValue}${hasDecimalSeparator ? `,${decimalRaw}` : ''}`;
    return currency ? `R$ ${numberText}` : numberText;
};
