-- Performance indexes for frequently queried columns
-- task_details: composite index for faster task listing by assignment and status
CREATE INDEX IF NOT EXISTS idx_task_details_assign_status ON task_details(assign_id, status_work);

-- task_details: created_at for date-range filtering
CREATE INDEX IF NOT EXISTS idx_task_details_created_at ON task_details(created_at);

-- notifications: created_at for chronological listing
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- assign: created_at for history queries and smart ranking
CREATE INDEX IF NOT EXISTS idx_assign_created_at ON assign(created_at);

-- assign: composite for user+date lookups (used by LookupAssignment)
CREATE INDEX IF NOT EXISTS idx_assign_user_created ON assign(id_user, created_at);

-- stations: project + main_category for filtered queries
CREATE INDEX IF NOT EXISTS idx_stations_project_main ON stations(id_project, id_main_category);
