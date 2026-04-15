export interface Notification {
    id: string;
    title: string;
    message: string;
    type?: string;
    metadata?: string | Record<string, any>;
    created_at?: string;
    is_read?: boolean;
}
