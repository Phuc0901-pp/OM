-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ROLES
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_roles_deleted_at ON roles(deleted_at);

-- TEAMS
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    character TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_teams_deleted_at ON teams(deleted_at);

-- USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    full_name TEXT,
    id_role UUID REFERENCES roles(id),
    id_team UUID REFERENCES teams(id),
    id_leader UUID REFERENCES users(id),
    number_phone TEXT,
    telegram_chat_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(id_role);
CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(id_team);

-- PROJECTS
CREATE TABLE IF NOT EXISTS projects (
    project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Mapped from ID field with column:project_id
    project_name TEXT NOT NULL,
    owner TEXT,
    area FLOAT,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at);

-- PROJECT CLASSIFICATION
CREATE TABLE IF NOT EXISTS project_classification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    character TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Implicit
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()  -- Implicit
);

-- MAIN CATEGORIES
CREATE TABLE IF NOT EXISTS main_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_main_categories_deleted_at ON main_categories(deleted_at);

-- CHILD CATEGORIES
CREATE TABLE IF NOT EXISTS child_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    id_main_categories UUID NOT NULL REFERENCES main_categories(id),
    id_station UUID, -- Will reference stations(id), FK added later to avoid circular dependency issues if any, but simplified here
    requires_inverter BOOLEAN DEFAULT FALSE,
    column_key VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_child_categories_deleted_at ON child_categories(deleted_at);
CREATE INDEX IF NOT EXISTS idx_child_name_main ON child_categories(name, id_main_categories);

-- PROJECT CHARACTERISTICS
CREATE TABLE IF NOT EXISTS project_characteristics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_project UUID REFERENCES projects(project_id),
    child_category_data JSONB,
    inverter INTEGER DEFAULT 0,
    inverter_sub_area_count INTEGER DEFAULT 0,
    inverter_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_project_characteristics_deleted_at ON project_characteristics(deleted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_characteristics_project_id ON project_characteristics(id_project);

-- ASSIGN
CREATE TABLE IF NOT EXISTS assign (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_user UUID REFERENCES users(id),
    id_project UUID REFERENCES projects(project_id),
    id_project_classification UUID REFERENCES project_classification(id),
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_assign_deleted_at ON assign(deleted_at);
CREATE INDEX IF NOT EXISTS idx_assign_id_user ON assign(id_user);
CREATE INDEX IF NOT EXISTS idx_assign_id_project ON assign(id_project);

-- STATIONS
CREATE TABLE IF NOT EXISTS stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    assign_id UUID REFERENCES assign(id) ON DELETE SET NULL,
    id_project UUID REFERENCES projects(project_id) ON DELETE SET NULL,
    id_main_category UUID REFERENCES main_categories(id),
    child_category_ids JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_stations_deleted_at ON stations(deleted_at);
CREATE INDEX IF NOT EXISTS idx_stations_assign_id ON stations(assign_id);

-- Add manual Foreign Key for child_categories.id_station
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_child_categories_station') THEN
        ALTER TABLE child_categories ADD CONSTRAINT fk_child_categories_station FOREIGN KEY (id_station) REFERENCES stations(id);
    END IF;
END $$;

-- PROCESS
CREATE TABLE IF NOT EXISTS process (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_process_deleted_at ON process(deleted_at);

-- STATION CHILD CONFIGS
CREATE TABLE IF NOT EXISTS station_child_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL, -- References stations(id) but GORM struct didn't have FK constraint explicit in tags usually for this
    child_category_id UUID NOT NULL,
    process_ids JSONB,
    id_project_classification UUID,
    guide_text TEXT,
    guide_images JSONB,
    image_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_station_child_configs_station_id ON station_child_configs(station_id);
-- Check if we should add FK constraint explicitly:
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_station_child_configs_station') THEN
        ALTER TABLE station_child_configs ADD CONSTRAINT fk_station_child_configs_station FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE;
    END IF;
END $$;

-- TASK DETAILS
CREATE TABLE IF NOT EXISTS task_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assign_id UUID NOT NULL REFERENCES assign(id),
    child_category_id UUID REFERENCES child_categories(id),
    station_id UUID REFERENCES stations(id),
    process_id UUID REFERENCES process(id),
    
    project_start_time TIMESTAMP WITH TIME ZONE,
    project_end_time TIMESTAMP WITH TIME ZONE,
    data_note TEXT,
    work_note TEXT,
    
    status_work INTEGER DEFAULT 0,
    status_submit INTEGER DEFAULT 0,
    status_approve INTEGER DEFAULT 0,
    status_reject INTEGER DEFAULT 0,
    
    image_url TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    submitted_at TIMESTAMP WITH TIME ZONE,
    approval_at TIMESTAMP WITH TIME ZONE,
    reject_at TIMESTAMP WITH TIME ZONE,
    note_reject TEXT,
    note_approval TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_task_details_deleted_at ON task_details(deleted_at);
CREATE INDEX IF NOT EXISTS idx_task_details_station_id ON task_details(station_id);
CREATE INDEX IF NOT EXISTS idx_task_details_assign_id ON task_details(assign_id);

-- ATTENDANCES
CREATE TABLE IF NOT EXISTS attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_user UUID NOT NULL REFERENCES users(id),
    id_project UUID REFERENCES projects(project_id) ON DELETE SET NULL,
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
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_attendances_deleted_at ON attendances(deleted_at);
CREATE INDEX IF NOT EXISTS idx_attendances_id_user ON attendances(id_user);
CREATE INDEX IF NOT EXISTS idx_attendances_id_project ON attendances(id_project);
CREATE INDEX IF NOT EXISTS idx_attendances_created_at ON attendances(created_at);

-- CHECKLIST TEMPLATES
CREATE TABLE IF NOT EXISTS checklist_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assign_id UUID NOT NULL REFERENCES assign(id) ON DELETE CASCADE,
    structure_site_of_inverter JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_deleted_at ON checklist_templates(deleted_at);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_assign ON checklist_templates(assign_id);

-- CHECKLIST TEMPLATE UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION update_checklist_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_checklist_templates_updated_at_trigger ON checklist_templates;
CREATE TRIGGER update_checklist_templates_updated_at_trigger
    BEFORE UPDATE ON checklist_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_checklist_templates_updated_at();

-- CONCEPTS
CREATE TABLE IF NOT EXISTS concepts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    columns JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_concepts_name ON concepts(name);

-- CONCEPT UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION update_concepts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_concepts_updated_at_trigger ON concepts;
CREATE TRIGGER update_concepts_updated_at_trigger
    BEFORE UPDATE ON concepts
    FOR EACH ROW
    EXECUTE FUNCTION update_concepts_updated_at();

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- PUSH SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- WORK ORDERS (Include if GORM AutoMigrate created them)
CREATE TABLE IF NOT EXISTS work_orders (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    requester_id UUID NOT NULL,
    assignee_id UUID,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open',
    
    project_id UUID REFERENCES projects(project_id),
    project_classification_id UUID REFERENCES project_classification(id),
    
    main_category_id UUID REFERENCES main_categories(id),
    child_category_id UUID REFERENCES child_categories(id),
    
    characteristics_data JSONB, -- Serialized
    
    due_date TIMESTAMP WITH TIME ZONE,
    version INTEGER DEFAULT 1,
    
    expected_start_at TIMESTAMP WITH TIME ZONE,
    expected_finish_at TIMESTAMP WITH TIME ZONE,
    actual_start_at TIMESTAMP WITH TIME ZONE,
    actual_finish_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    checklist_data JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_work_orders_deleted_at ON work_orders(deleted_at);

-- WORK ORDER ACTIVITIES
CREATE TABLE IF NOT EXISTS work_order_activities (
    id BIGSERIAL PRIMARY KEY,
    work_order_id BIGINT NOT NULL,
    user_id UUID NOT NULL,
    activity_type TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    comment TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE
);

