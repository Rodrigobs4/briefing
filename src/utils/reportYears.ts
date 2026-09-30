export const FIRST_REPORT_YEAR = 2023;
export const CURRENT_REPORT_YEAR = Math.max(FIRST_REPORT_YEAR, new Date().getFullYear());
// Limite inferior para lançamentos retroativos adicionados pelo editor.
export const MIN_REPORT_YEAR = 2000;

/**
 * Anos em ordem crescente, do mais antigo com dado (ou 2023) até o ano atual.
 * Anos anteriores a 2023 só entram quando há lançamento para eles.
 */
export const getReportYears = (extraYears: Array<number | string | null | undefined> = []): number[] => {
    const validExtras = extraYears
        .map(Number)
        .filter(year => Number.isInteger(year) && year >= MIN_REPORT_YEAR && year <= CURRENT_REPORT_YEAR);
    const firstYear = Math.min(FIRST_REPORT_YEAR, ...validExtras);

    return Array.from({ length: CURRENT_REPORT_YEAR - firstYear + 1 }, (_, index) => firstYear + index);
};
