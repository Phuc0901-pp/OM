export interface TaskDetail {
    id: string;
    assign_id: string;
    child_category_id?: string;
    station_id?: string;
    process_id?: string;
    status_work: number;
    status_submit: number;
    status_approve: number;
    status_reject: number;
    submitted_at?: string;
    approval_at?: string;
    reject_at?: string;
    note_reject?: string;
    note_approval?: string;
    project_start_time?: string;
    project_end_time?: string;
    data_note?: string;
    work_note?: string;
    check?: number;
}

export interface Assign {
    id: string;
    id_project: string;
    id_user: string;
    project_classification_id: string;
    start_time?: string;
    end_time?: string;
    note?: string;
    project?: {
        project_id: string;
        project_name: string;
        location: string;
    };
    classification?: {
        id: string;
        name: string;
    };
    task_details?: TaskDetail[];
}

export interface ChildCategory {
    id: string;
    name: string;
    id_main_categories?: string;
}

export interface StationChildConfig {
    id: string;
    station_id: string;
    child_category_id: string;
    guide_text?: string;
    guide_images?: string[];
    image_count?: number;
}

export interface GuidePopupData {
    title: string;
    text: string;
    images: string[];
}

export interface ViewImageData {
    images: string[];
    currentIndex: number;
}
