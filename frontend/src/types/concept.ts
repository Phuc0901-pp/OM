export interface Concept {
    id: string;
    name: string;
    description: string;
    columns: ColumnDef[];
    created_at: string;
    updated_at: string;
}

export interface ColumnDef {
    name: string;
    label: string;
    type: 'text' | 'number' | 'boolean' | 'date';
    required: boolean;
    unit?: string;
}
