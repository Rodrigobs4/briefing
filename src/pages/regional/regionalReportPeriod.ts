export type RegionalUpdateFrequency = 'fixed' | 'weekly' | 'monthly' | 'semester' | 'yearly' | 'custom';

export const REGIONAL_UPDATE_FREQUENCIES: RegionalUpdateFrequency[] = ['yearly', 'fixed', 'custom', 'monthly', 'weekly', 'semester'];

export const todayIsoDate = () => new Date().toISOString().slice(0, 10);

export const currentYearStartIsoDate = () => `${new Date().getFullYear()}-01-01`;

export const currentYear = () => new Date().getFullYear();

export const addDaysIsoDate = (value: string, days: number) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};

export const formatDatePtBr = (value?: string | null) => {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
};

export const buildReferenceLabel = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return '';
    if (startDate.slice(0, 4) === endDate.slice(0, 4) && startDate.endsWith('-01-01') && endDate.endsWith('-12-31')) {
        return `Ano de ${startDate.slice(0, 4)}`;
    }
    return `${formatDatePtBr(startDate)} a ${formatDatePtBr(endDate)}`;
};

export const getFrequencyLabel = (frequency: RegionalUpdateFrequency) => {
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

export const getReferenceRangeByFrequency = (
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
