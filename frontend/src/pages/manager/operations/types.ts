
export interface TaskRow {
    id: string; // detail_assign_id
    assignId: string;
    projectName: string;
    projectLocation: string;
    projectOwnerId?: string;
    modelProjectName?: string;
    templateName?: string;
    userName: string; // Joined names of assigned users
    userEmail: string;

    // V2 Taxonomy
    assetName: string;
    assetId: string; // For grouping and lookup
    workName: string;
    workId: string; // For grouping
    subWorkName: string;
    subWorkId: string; // For grouping - to separate same-asset different-subwork tasks
    processName: string | null;

    // Status
    statusWork: number;
    statusSubmit: number;
    statusApprove: number;
    statusAssign: boolean;
    statusReject: number;
    statusString: string; // Calculated '0000', '1000', '1100', '1110', '1101'

    updatedAt: string;
    submittedAt: string | null;
    approvalAt: string | null;
    rejectedAt: string | null;

    noteData?: string;
    noteReject?: string;
    noteApproval?: string;

    // Person tracking - arrays matching approval_at and rejected_at
    idPersonApprove?: string[];
    idPersonReject?: string[];

    images: string[];

    subTasks?: TaskRow[]; // For grouping by Work
}

export interface ProjectStat {
    name: string;
    total: number;
    completed: number;
    pending: number;
    location: string;
    ownerName?: string;
    modelProjectName?: string;
    templateName?: string;
    assignId: string;
    statusAssign: boolean;
}

