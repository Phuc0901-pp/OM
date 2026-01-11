-- Migration: Refactor checklist_templates and add process_id to task_details
-- Date: 2026-01-08

-- 1. Drop old checklist_templates table and recreate with new schema
DROP TABLE IF EXISTS checklist_templates;

CREATE TABLE checklist_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assign_id UUID NOT NULL REFERENCES assign(id) ON DELETE CASCADE,
    structure_site_of_inverter JSONB, -- e.g., {"Building 1": 3, "Building 2": 5}
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_checklist_templates_assign_id ON checklist_templates(assign_id);
CREATE INDEX idx_checklist_templates_deleted_at ON checklist_templates(deleted_at);

-- 2. Add process_id column to task_details
ALTER TABLE task_details ADD COLUMN IF NOT EXISTS process_id UUID REFERENCES processes(id);

-- 3. Optional: Add comment explaining the structure
COMMENT ON COLUMN checklist_templates.structure_site_of_inverter IS 'JSON object mapping site/building name to inverter count, e.g., {"Building 1": 3, "Building 2": 5}';
