-- Migration: Add station_child_config_id and new columns to task_details
-- This is a non-breaking migration that adds new columns while keeping existing ones

-- Step 1: Add new columns to task_details (if they don't exist)
DO $$ 
BEGIN
    -- Add station_child_config_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'task_details' AND column_name = 'station_child_config_id') THEN
        ALTER TABLE task_details ADD COLUMN station_child_config_id UUID;
        CREATE INDEX IF NOT EXISTS idx_task_details_station_child_config_id ON task_details(station_child_config_id);
    END IF;
    
    -- Add notes column (new, text type)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'task_details' AND column_name = 'notes') THEN
        ALTER TABLE task_details ADD COLUMN notes TEXT;
    END IF;
    
    -- Add data_result column (jsonb for work results)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'task_details' AND column_name = 'data_result') THEN
        ALTER TABLE task_details ADD COLUMN data_result JSONB;
    END IF;
    
    -- Add approved_at column (new name, mirrors approval_at)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'task_details' AND column_name = 'approved_at') THEN
        ALTER TABLE task_details ADD COLUMN approved_at TIMESTAMPTZ;
    END IF;
END $$;

-- Step 2: Add foreign key constraint for station_child_config_id (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'station_child_configs') THEN
        -- Only add FK if it doesn't already exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_task_details_station_child_config'
        ) THEN
            ALTER TABLE task_details 
            ADD CONSTRAINT fk_task_details_station_child_config 
            FOREIGN KEY (station_child_config_id) 
            REFERENCES station_child_configs(id) 
            ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- Migration complete - No breaking changes, all existing data preserved
