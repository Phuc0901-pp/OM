// ==================== V2 Backend Model Types ====================
// These interfaces mirror the Go V2 domain structs.

export interface User {
 id: string;
 email: string;
 name: string;
 id_role?: string;
 role_id?: string;
 id_team?: string;
 team_id?: string;
 number_phone?: string;
 role_model?: Role;
 role?: Role;
 team?: Team;
 id_person_created?: string | null;
 person_created?: { id: string; name: string } | null;
 created_at: string;
 updated_at: string;
}

export interface Role {
 id: string;
 name: string;
}

export interface Team {
 id: string;
 name: string;
}



export interface Owner {
 id: string;
 name: string;
 created_at?: string;
 updated_at?: string;
}

export interface Project {
 id: string;
 name: string;
 location: string;
 id_owner?: string;
 owner?: Owner;
 assets?: Asset[];
 created_at: string;
 updated_at: string;
}

export interface Asset {
 id: string;
 name: string;
 id_project: string;
 project?: Project;
 parent_id?: string;
 parent?: Asset;
 sub_assets?: Asset[];
 works?: Work[];
 created_at: string;
 updated_at: string;
}

export interface Process {
 id: string;
 name: string;
 created_at?: string;
 updated_at?: string;
}

export interface Work {
 id: string;
 name: string;
 id_asset: string;
 asset?: Asset;
 sub_works?: SubWork[];
 created_at: string;
 updated_at: string;
}

export interface SubWork {
 id: string;
 name: string;
 id_work: string;
 work?: Work;
 process_ids?: string[];
 status_set_image_count: boolean;
 image_count: number;
 guide_text?: string;
 guide_images?: string[];
 created_at: string;
 updated_at: string;
}

export interface ModelProject {
 id: string;
 name: string;
 created_at?: string;
 updated_at?: string;
}

export interface Template {
 id: string;
 name: string;
 id_project?: string;
 id_model_project?: string;
 created_at?: string;
 updated_at?: string;
}

export interface Assign {
 id: string;
 // id_user stored as JSONB array in backend
 id_user?: string[];
 id_project: string;
 id_model_project?: string;
 id_template?: string;
 project?: Project;
 model_project?: ModelProject;
 template?: Template;
 users?: User[];
 details?: DetailAssign[];
 note_assign?: string;
 start_time?: string;
 end_time?: string;
 status_assign?: boolean;
 created_at: string;
 updated_at: string;
}

export interface DetailAssign {
 id: string;
 id_assign: string;
 assign?: Assign;
 id_config?: string;
 config?: Config;
 id_process?: string;
 process?: Process;
 data?: string[];

 // Status flags (0 = not done, 1 = done)
 status_work?: number;
 status_submit?: number;
 status_reject?: number;
 status_approve?: number; // ← PRIMARY approved indicator (1 = approved)

 // Timestamps (JSONB arrays, backend field names)
 submitted_at?: any; // json key from backend: "submitted_at"
 approval_at?: any; // json key from backend: "approval_at" (NOT "approved_at"!)
 rejected_at?: any; // json key from backend: "rejected_at"

 // Person tracking (arrays matching the timestamp arrays)
 id_person_approve?: any;
 id_person_reject?: any;

 // Notes
 note_data?: string;
 note_approval?: string;
 note_reject?: string;

 created_at: string;
 updated_at: string;
}

export interface Config {
 id: string;
 id_asset: string;
 asset?: Asset;
 id_sub_work: string;
 sub_work?: SubWork;
 status_set_image_count: boolean;
 image_count: number;
 guide_text?: string;
 guide_images?: string[];
 created_at: string;
 updated_at: string;
}

// ==================== API Response Types ====================

export interface APIResponse<T = unknown> {
 success: boolean;
 data?: T;
 message?: string;
 error_code?: number;
}

export interface ManagerStatsResponse {
 total_projects: number;
 active_assignments: number;
 completed_tasks: number;
 total_users: number;
 total_teams: number;
}

export interface DashboardStats {
 totalProjects: number;
 activeAssignments: number;
 completedTasks: number;
 totalUsers: number;
 totalTeams: number;
}

export interface Option {
 id: string;
 name: string;
 label?: string;
}

export interface PendingCheckout {
 id: string;
 user?: User;
 project?: Project;
 checkout_request_time: string;
 checkout_img_url?: string;
}

export interface Attendance {
 id: string;
 user_id: string;
 user?: User;
 project_id?: string;
 project?: Project;
 check_in_time?: string;
 check_out_time?: string;
 status: string;
 address_checkin?: string;
 address_checkout?: string;
}

export interface RecentActivity {
 id: string;
 project_name: string;
 user_name: string;
 action: string;
 timestamp: string;
}

/**
 * Normalized user shape read from localStorage.
 * `role` may be an object (from DB V2) or a plain string (legacy login response).
 * MainLayout normalizes it into `_roleName` before passing to children.
 */
export interface LocalUser {
 id: string;
 email: string;
 name: string;
 full_name?: string;
 role?: Role | string;
 role_name?: string;
 _roleName?: string; // Computed by MainLayout
 team?: Team;
 number_phone?: string;
 created_at?: string;
 updated_at?: string;
}
