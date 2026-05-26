type UnitCandidate = {
    name: string;
    unitType?: string | null;
};

type RegionalCommandCandidate = {
    code: string;
    name: string;
};

const LEGACY_REGIONAL_COMMAND_KEYS = new Set([
    'cprms',
    'atlantico',
    'baia de todos os santos',
    'central',
    'norte',
    'sul',
    'leste',
    'sudoeste',
    'oeste',
    'chapada',
    'cpme',
    'comando de operacoes especializadas',
]);

const normalizeCommandKey = (value?: string | null) =>
    (value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[_\-\s]+/g, ' ')
        .trim()
        .toLowerCase();

export function isGeneralBriefingUnit(
    unit: UnitCandidate,
    regionalCommands: RegionalCommandCandidate[] = [],
) {
    if (unit.unitType === 'regional_command') return false;

    const commandKeys = new Set([
        ...regionalCommands.flatMap(command => [
            normalizeCommandKey(command.code),
            normalizeCommandKey(command.name),
        ]),
        ...LEGACY_REGIONAL_COMMAND_KEYS,
    ]);

    return !commandKeys.has(normalizeCommandKey(unit.name));
}
