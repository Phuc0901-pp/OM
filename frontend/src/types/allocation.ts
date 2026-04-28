// ==================== V2 Allocation Types ====================
// Re-exports key V2 types relevant to the allocation/assignment flow.

export type {
 Assign,
 DetailAssign,
 Work,
 Asset,
 Project,
 User,
 ModelProject,
 Process,
} from './models';

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
 * WorkItem for list display
 */
export interface WorkItem {
 id: string;
 name: string;
 asset_id: string;
 asset_name?: string;
}