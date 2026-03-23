-- =======================================================================
-- V2 Schema: Raitek O&M System - Solar CMMS
-- Version: 2.0.0 | Date: 2026-03-04
-- Description: Complete rewire of DB schema - simplified & scalable.
--   - Removed: MainCategory, ChildCategory, Station, StationChildConfig,
--              ProjectClassification, ProjectCharacteristic, Concepts,
--              WorkOrders, ChecklistTemplates.
--   - Added: Leader, Owner, Asset, Work, ModelProject, Assign, DetailAssign
-- =======================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =======================================================================
-- LOOKUP TABLES (Reference / Master Data)
-- =======================================================================

-- ROLES
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_roles_deleted_at ON roles(deleted_at);

-- TEAMS
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_teams_deleted_at ON teams(deleted_at);

-- OWNERS (Project owners / clients)
CREATE TABLE IF NOT EXISTS owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_owners_deleted_at ON owners(deleted_at);

-- PROCESS (Type of work process/procedure)
CREATE TABLE IF NOT EXISTS process (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_process_deleted_at ON process(deleted_at);

-- MODEL_PROJECTS (Work order blueprints / templates)
CREATE TABLE IF NOT EXISTS model_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_model_projects_deleted_at ON model_projects(deleted_at);

-- USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    number_phone TEXT,
    id_role UUID REFERENCES roles(id) ON DELETE SET NULL,
    id_team UUID REFERENCES teams(id) ON DELETE SET NULL,
    id_person_created UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(id_role);
CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(id_team);
CREATE INDEX IF NOT EXISTS idx_users_person_created ON users(id_person_created);

-- PROJECTS
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT,
    id_owner UUID REFERENCES owners(id) ON DELETE SET NULL,
    id_person_created UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at);
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(id_owner);
CREATE INDEX IF NOT EXISTS idx_projects_person_created ON projects(id_person_created);

-- TEMPLATES (Groups of configs representing work blueprints)
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    id_project UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    id_model_project UUID REFERENCES model_projects(id) ON DELETE SET NULL,
    id_config JSONB DEFAULT '[]'::jsonb NOT NULL,
    id_person_created UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_templates_deleted_at ON templates(deleted_at);
CREATE INDEX IF NOT EXISTS idx_templates_project_id ON templates(id_project);
CREATE INDEX IF NOT EXISTS idx_templates_person_created ON templates(id_person_created);

-- =======================================================================
-- CORE ENTITIES
-- =======================================================================

-- ASSETS (Physical equipment/devices under a project)
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    id_project UUID NOT NULL REFERENCES projects(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_assets_deleted_at ON assets(deleted_at);
CREATE INDEX IF NOT EXISTS idx_assets_project_id ON assets(id_project);

CREATE TABLE IF NOT EXISTS works (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_works_deleted_at ON works(deleted_at);

-- SUB_WORKS (Specific steps/sub-tasks under a Work)
-- id_process: JSONB array of process UUIDs (many processes per sub-work)
-- guide_images: JSONB array of image URLs
CREATE TABLE IF NOT EXISTS sub_works (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    id_work UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    id_process JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_sub_works_deleted_at ON sub_works(deleted_at);
CREATE INDEX IF NOT EXISTS idx_sub_works_work_id ON sub_works(id_work);

-- CONFIGS (Maps Asset → SubWork per project configuration)
CREATE TABLE IF NOT EXISTS configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_asset UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    id_sub_work UUID NOT NULL REFERENCES sub_works(id) ON DELETE CASCADE,
    status_set_image_count BOOLEAN DEFAULT FALSE,
    image_count INT DEFAULT 0,
    guide_text TEXT DEFAULT '',
    guide_images JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_configs_deleted_at ON configs(deleted_at);
CREATE INDEX IF NOT EXISTS idx_configs_asset_id ON configs(id_asset);
CREATE INDEX IF NOT EXISTS idx_configs_sub_work_id ON configs(id_sub_work);

-- =======================================================================
-- TASK MANAGEMENT
-- =======================================================================

-- ASSIGNS (Work orders: assign works of a project to multiple users)
-- id_user: JSONB array of user UUIDs (multi-person assignment)
CREATE TABLE IF NOT EXISTS assigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_project UUID NOT NULL REFERENCES projects(id),
    id_model_project UUID REFERENCES model_projects(id) ON DELETE SET NULL,
    id_template UUID REFERENCES templates(id) ON DELETE SET NULL,
    id_user JSONB NOT NULL DEFAULT '[]',
    id_person_created UUID REFERENCES users(id) ON DELETE SET NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    note_assign TEXT,
    status_assign BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_assigns_deleted_at ON assigns(deleted_at);
CREATE INDEX IF NOT EXISTS idx_assigns_project_id ON assigns(id_project);
CREATE INDEX IF NOT EXISTS idx_assigns_model_project_id ON assigns(id_model_project);
CREATE INDEX IF NOT EXISTS idx_assigns_template_id ON assigns(id_template);
CREATE INDEX IF NOT EXISTS idx_assigns_person_created ON assigns(id_person_created);

-- DETAIL_ASSIGNS (Field work reports per assignment)
-- data: JSONB array of image URLs uploaded as evidence
-- submitted_at / rejected_at / approval_at: JSONB arrays
CREATE TABLE IF NOT EXISTS detail_assigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_assign UUID NOT NULL REFERENCES assigns(id) ON DELETE CASCADE,
    id_config UUID REFERENCES configs(id) ON DELETE SET NULL,
    id_process UUID REFERENCES process(id) ON DELETE SET NULL,

    -- Evidence
    data JSONB DEFAULT '[]',
    note_data TEXT,

    -- Workflow Status (0 = pending, 1 = done/approved)
    status_work INTEGER NOT NULL DEFAULT 0,
    status_submit INTEGER NOT NULL DEFAULT 0,
    status_reject INTEGER NOT NULL DEFAULT 0,
    status_approve INTEGER NOT NULL DEFAULT 0,

    -- Timestamp history arrays (JSONB) for full audit trail
    submitted_at JSONB DEFAULT '[]',
    rejected_at JSONB DEFAULT '[]',
    approval_at JSONB DEFAULT '[]',

    -- Person tracking: arrays matching the timestamp arrays above
    -- id_person_approve[i] is the user who approved at approval_at[i]
    -- id_person_reject[i] is the user who rejected at rejected_at[i]
    id_person_approve JSONB DEFAULT '[]',
    id_person_reject JSONB DEFAULT '[]',

    -- Notes for each action
    note_reject TEXT,
    note_approval TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_detail_assigns_deleted_at ON detail_assigns(deleted_at);
CREATE INDEX IF NOT EXISTS idx_detail_assigns_assign_id ON detail_assigns(id_assign);
CREATE INDEX IF NOT EXISTS idx_detail_assigns_config_id ON detail_assigns(id_config);
CREATE INDEX IF NOT EXISTS idx_detail_assigns_status_approve ON detail_assigns(status_approve, deleted_at);
CREATE INDEX IF NOT EXISTS idx_detail_assigns_status_submit ON detail_assigns(status_submit, deleted_at);

-- =======================================================================
-- ATTENDANCE MANAGEMENT
-- =======================================================================

-- ATTENDANCES
CREATE TABLE IF NOT EXISTS attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_user UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id_project UUID REFERENCES projects(id) ON DELETE SET NULL,
    id_assign UUID REFERENCES assigns(id) ON DELETE SET NULL,

    status_checkin INTEGER DEFAULT 0,
    date_checkin TIMESTAMP,
    status_checkout INTEGER DEFAULT 0,
    date_checkout TIMESTAMP,
    site_status INTEGER DEFAULT 0,
    
    personnel_photo TEXT,
    id_card_front TEXT,
    id_card_back TEXT,
    safety_card_front TEXT,
    safety_card_back TEXT,
    tools_photos TEXT,
    documents_photos TEXT,
    
    address_checkin TEXT,
    address_checkout TEXT,
    
    checkout_requested BOOLEAN DEFAULT FALSE,
    checkout_request_time TIMESTAMP,
    checkout_approved BOOLEAN DEFAULT FALSE,
    checkout_approved_by UUID,
    checkout_approved_time TIMESTAMP,
    checkout_rejected BOOLEAN DEFAULT FALSE,
    checkout_reject_reason TEXT,
    checkout_img_url TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_attendances_deleted_at ON attendances(deleted_at);
CREATE INDEX IF NOT EXISTS idx_attendances_id_user ON attendances(id_user);
CREATE INDEX IF NOT EXISTS idx_attendances_id_project ON attendances(id_project);
CREATE INDEX IF NOT EXISTS idx_attendances_created_at ON attendances(created_at);
CREATE INDEX IF NOT EXISTS idx_attendances_id_assign ON attendances(id_assign);
-- =======================================================================
-- NOTIFICATION TABLES (Kept for future use)
-- =======================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- =======================================================================
-- SEED DATA (Initial master data)
-- =======================================================================

-- Default Roles
INSERT INTO roles (name) VALUES ('manager'), ('engineer')
ON CONFLICT (name) DO NOTHING;

-- Default Teams
INSERT INTO teams (name) VALUES ('Research and Development')
ON CONFLICT (name) DO NOTHING;

-- Default Admin User (manager)
INSERT INTO users (name, email, password_hash, id_role, id_team, created_at, updated_at)
SELECT
    'Phạm Hoàng Phúc',
    'phphuc0539@gmail.com',
    crypt('090103Phuc', gen_salt('bf', 10)),
    r.id,
    t.id,
    NOW(),
    NOW()
FROM roles r, teams t
WHERE r.name = 'manager' AND t.name = 'Research and Development'
AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'phphuc0539@gmail.com');

-- Default Processes
INSERT INTO process (name) VALUES
('Trước khi làm'), ('Trong khi làm'), ('Sau khi làm'), ('Trước khi vệ sinh'), ('Trong khi vệ sinh'), ('Sau khi vệ sinh'), ('Khác');

-- Default Model Projects
INSERT INTO model_projects (name) VALUES
('Bảo dưỡng phòng ngừa'), ('Bảo dưỡng khắc phục'), ('Vệ sinh'), ('Khác');
