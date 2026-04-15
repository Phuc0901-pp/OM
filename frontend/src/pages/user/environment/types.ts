export interface Work {
    id: string;
    name: string;
}

export interface SubWork {
    id: string;
    name: string;
    work?: Work;
}

export interface Asset {
    id: string;
    name: string;
}

export interface Process {
    id: string;
    name: string;
}

export interface Config {
    id: string;
    asset?: Asset;
    sub_work?: SubWork;
    status_set_image_count?: boolean;
    image_count?: number;
    guide_text?: string;
    /** MinIO paths stored as JSON array of strings */
    guide_images?: string[];
}

export interface DetailAssign {
    id: string;
    id_assign: string;
    config?: Config;
    process?: Process;

    /** MinIO file paths (stored as JSONB string[] in DB) */
    data?: string[];
    note_data?: string;

    status_work: number;
    status_submit: number;
    status_approve: number;
    status_reject: number;

    /** ISO timestamp strings for each round of submission */
    submitted_at?: string | null;
    approval_at?: string | null;
    rejected_at?: string | null;

    /** UUID arrays: who approved / rejected each round (matches approval_at / rejected_at indices) */
    id_person_approve?: string[] | string | null;
    id_person_reject?: string[] | string | null;

    note_reject?: string;
    note_approval?: string;
}

export interface Assign {
    id: string;
    id_project: string;
    /** Array of User IDs (stored as JSONB in DB) */
    id_user: string[];
    start_time?: string;
    end_time?: string;
    note_assign?: string;
    status_assign?: boolean;
    project?: {
        id: string;
        name: string;
        location: string;
    };
    template?: {
        id: string;
        name: string;
    };
    details?: DetailAssign[];
}

export interface StationChildConfig {
    id: string;
    station_id: string;
    child_category_id: string;
    guide_text?: string;
    guide_images?: string[];
    image_count?: number;
    status_set_image_count?: boolean;
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

/** Normalized user info from localStorage — role may come as object or string depending on login response */
export interface LocalUser {
    id: string;
    email: string;
    name: string;
    full_name?: string;
    /** Can be a Role object or a plain string — always normalize via `_roleName` computed in MainLayout */
    role?: { id: string; name: string } | string;
    role_name?: string;
    /** Normalized role name string set by MainLayout at runtime */
    _roleName?: string;
    team?: { id: string; name: string };
}

