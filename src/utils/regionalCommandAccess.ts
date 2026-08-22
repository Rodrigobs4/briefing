import { compareTextPtBr } from './textOrdering';
import type { RegionalCommand, Role, User } from '../store/AuthContext';

type RegionalAccessUser = Pick<User, 'role' | 'regionalCommandIds'> | null | undefined;

const canAccessAllRegionalCommands = (role?: Role) => role === 'admin' || role === 'commander';

export function getAccessibleRegionalCommands(
    regionalCommands: RegionalCommand[],
    user: RegionalAccessUser
): RegionalCommand[] {
    const active = regionalCommands
        .filter(command => command.isActive)
        .sort((a, b) => compareTextPtBr(a.name, b.name));

    if (!user || canAccessAllRegionalCommands(user.role)) {
        return active;
    }

    if (user.role === 'editor') {
        const allowedIds = new Set(user.regionalCommandIds ?? []);
        if (allowedIds.size === 0) return [];
        return active.filter(command => allowedIds.has(command.id));
    }

    return [];
}

export function userCanAccessRegionalCommand(
    user: RegionalAccessUser,
    regionalCommandId: string
): boolean {
    if (!user) return false;
    if (canAccessAllRegionalCommands(user.role)) return true;
    if (user.role === 'editor') {
        return (user.regionalCommandIds ?? []).includes(regionalCommandId);
    }
    return false;
}
