-- Add id_project column to attendances table
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS id_project UUID;

-- Add foreign key constraint to projects table
ALTER TABLE attendances ADD CONSTRAINT fk_attendances_project 
    FOREIGN KEY (id_project) REFERENCES projects(project_id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_attendances_id_project ON attendances(id_project);
