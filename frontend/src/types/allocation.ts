export interface TaskDetail {
    id: string;
    child_category_id: string;
    station_name: string | null;
    inverter_name: string | null;
    status: string;
    check: number;
    accept: number;
    note: string;
    image_path: string;
    updated_at: string;
}

export interface WorkItem {
    name: string;
    id: string;
    quantity: string;
}

export interface MainCategory {
    name: string;
    id: string;
    num: string;
    child_categories: WorkItem[];
}

export interface Allocation {
    id: string;
    project_id: string;
    id_project: string;
    project: { project_name: string; location: string };
    classification: { name: string };
    data_work: {
        timestamp: string;
        main_categories: MainCategory[];
    };
    task_details?: TaskDetail[];
    start_time?: string;
    end_time?: string;
}

export interface TaskStats {
    total: number;
    approved: number;
    rejected: number;
    submitted: number;
    inProgress: number;
    pending: number;
}

export interface DetailedTask {
    id: string;
    projectName: string;
    classificationName: string;
    categoryName: string;
    itemName: string;
    status: 'approved' | 'rejected' | 'submitted' | 'in_progress' | 'pending';
    note: string;
    stationName?: string;
    inverterName?: string;
    dateSubmitted?: string;
    dateReviewed?: string;
}

export interface AllocationWithProgress extends Allocation {
    totalTasks: number;
    completedTasks: number;
    progress: string;
}
