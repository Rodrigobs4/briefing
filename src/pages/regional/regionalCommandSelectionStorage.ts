const STORAGE_KEY = 'pmba_selected_regional_command_id';

export const loadSelectedRegionalCommandId = (): string | null => {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
};

export const saveSelectedRegionalCommandId = (regionalCommandId: string) => {
    try {
        localStorage.setItem(STORAGE_KEY, regionalCommandId);
    } catch {
        // Ignore storage failures (private mode, quota, etc.)
    }
};
