/**
 * TaskDetail represents a single work item within an allocation
 * Maps to backend domain.TaskDetail
 */
export interface TaskDetail {
    id: string;
    child_category_id: string;
    station_id?: string;
    /** Station name from joined Station table */
    station_name?: string;
    /** Inverter name if applicable */
    inverter_name?: string;
    status: string;
    check: number;
    accept: number;
    /** Process ID (UUID string from backend) */
    process_id?: string;
    /** 0 = not started, 1 = in progress */
    status_work?: number;
    /** 0 = not submitted, 1 = submitted */
    status_submit?: number;
    /** 0 = pending, 1 = approved */
    status_approve?: number;
    /** 0 = not rejected, 1 = rejected, -1 = resubmitted */
    status_reject?: number;
    note: string;
    image_path: string;
    /** JSON array of image URLs from MinIO */
    image_url?: string;
    submitted_at?: string;
    reject_at?: string;
    approval_at?: string;
    updated_at: string;
    child_category?: {
        name: string;
        station_id?: string;
        station?: {
            name: string;
        };
        main_category?: {
            name: string;
        };
    };
}

/**
 * WorkItem represents a child category entry in allocation data
 */
export interface WorkItem {
    name: string;
    id: string;
    quantity: string;
}

/**
 * MainCategory represents a main category with its child categories
 */
export interface MainCategory {
    name: string;
    id: string;
    num: string;
    child_categories: WorkItem[];
}

/**
 * Allocation represents a work assignment to a user
 * Maps to backend domain.Assign
 */
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

/**
 * TaskStats for dashboard statistics
 */
export interface TaskStats {
    total: number;
    approved: number;
    rejected: number;
    submitted: number;
    inProgress: number;
    pending: number;
}

/**
 * DetailedTask for statistics page display
 */
export interface DetailedTask {
    id: string;
    projectName: string;
    classificationName: string;
    categoryName: string;
    itemName: string;
    processId?: string;
    status: 'approved' | 'rejected' | 'submitted' | 'in_progress' | 'pending';
    note: string;
    stationName?: string;
    inverterName?: string;
    dateSubmitted?: string;
    dateReviewed?: string;
}

/**
 * AllocationWithProgress extends Allocation with computed progress fields
 */
export interface AllocationWithProgress extends Allocation {
    totalTasks: number;
    completedTasks: number;
    progress: string;
}

