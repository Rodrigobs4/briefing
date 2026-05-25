export const compareTextPtBr = (left?: string | null, right?: string | null) =>
    (left || '').localeCompare(right || '', 'pt-BR', {
        sensitivity: 'base',
        numeric: true
    });

export const sortByTextPtBr = <T>(items: T[], getLabel: (item: T) => string | null | undefined) =>
    [...items].sort((left, right) => compareTextPtBr(getLabel(left), getLabel(right)));
