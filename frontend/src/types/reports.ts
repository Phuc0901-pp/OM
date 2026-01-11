export interface TaskEvidence {
    before: string[];
    after: string[];
}

export interface CompletedTask {
    id: string;
    project_name: string;
    user_name: string;
    main_category: string;
    child_category: string;
    station_name?: string;
    inverter_name?: string;
    status: string;
    note: string;
    image_path: string; // Keep for legacy fallback
    evidence: TaskEvidence;
    completed_at: string;
}

export interface GroupedTasks {
    [mainCategory: string]: {
        [childCategory: string]: CompletedTask[];
    };
}
