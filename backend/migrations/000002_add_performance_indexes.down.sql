-- Rollback performance indexes
DROP INDEX IF EXISTS idx_task_details_assign_status;
DROP INDEX IF EXISTS idx_task_details_created_at;
DROP INDEX IF EXISTS idx_notifications_created_at;
DROP INDEX IF EXISTS idx_assign_created_at;
DROP INDEX IF EXISTS idx_assign_user_created;
DROP INDEX IF EXISTS idx_stations_project_main;
