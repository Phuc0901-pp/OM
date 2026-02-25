
export interface TaskRow {
    id: string;
    assignId: string;
    projectName: string;
    projectLocation: string;
    userName: string;
    userEmail: string;
    mainCategoryName: string;
    childCategoryId: string; // Used for grouping
    categoryName: string;
    stationId?: string; // Added for frontend lookup
    stationName: string | null;
    inverterName: string | null;
    processName: string | null; // NEW: Display process name
    status: string;
    updatedAt: string;
    submittedAt: string | null;
    approvalAt: string | null;
    rejectedAt?: string | null;
    note?: string;
    dataResult?: any;
    check: number;
    accept: number;
    status_reject?: number; // Added for new status logic
    images: string[];
    beforeImages?: string[];
    afterImages?: string[];
    generalImages?: string[];
    beforeNote?: string;
    afterNote?: string;
    statusString?: string;
    subTasks?: TaskRow[];
    noteRecall?: string;
    note_reject?: string;
    note_approval?: string;
    leaderName: string | null; // Added leaderName
}

export interface ProjectStat {
    name: string;
    total: number;
    completed: number;
    pending: number;
    location: string;
}
