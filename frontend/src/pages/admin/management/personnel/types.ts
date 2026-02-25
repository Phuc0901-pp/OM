// Types for Personnel Management
export interface UserData {
    id: string;
    full_name: string;
    email: string;
    role: string;
    team: { id: string; name: string } | null;
    number_phone?: string;
    leader?: { id: string; full_name: string } | null;
    telegram_chat_id?: string;
}

export interface RoleData {
    id: string;
    name: string;
}

export type SortConfig = {
    key: keyof UserData | 'team';
    direction: 'asc' | 'desc';
} | null;

export type SubTabType = 'all' | 'allocation';

export interface ConfirmState {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
}
