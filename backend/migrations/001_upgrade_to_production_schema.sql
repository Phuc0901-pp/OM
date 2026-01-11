-- Migration Script: Upgrade to Production-Ready CMMS Schema
-- This script upgrades the existing database schema to support:
-- 1. Asset hierarchy with materialized path pattern
-- 2. Dynamic JSONB attributes for assets
-- 3. SLA tracking for work orders
-- 4. Checklist data snapshots
-- 5. Comprehensive audit logging

/*
-- ============================================================================
-- ASSETS TABLE MODIFICATIONS (REMOVED)
-- ============================================================================

-- Add hierarchy fields to assets table
ALTER TABLE assets ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES assets(id) ON DELETE SET NULL;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS hierarchy_path TEXT NOT NULL DEFAULT '';

-- Rename metadata column to attributes for clarity
ALTER TABLE assets RENAME COLUMN metadata TO attributes;

-- Add indexes for assets
CREATE INDEX IF NOT EXISTS idx_assets_parent_id ON assets(parent_id);
CREATE INDEX IF NOT EXISTS idx_hierarchy_path ON assets USING btree(hierarchy_path);
CREATE INDEX IF NOT EXISTS idx_attributes ON assets USING gin(attributes);
*/

-- ============================================================================
-- WORK_ORDERS TABLE MODIFICATIONS
-- ============================================================================

-- Add SLA tracking fields
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS expected_start_at TIMESTAMP;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS expected_finish_at TIMESTAMP;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS actual_start_at TIMESTAMP;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS actual_finish_at TIMESTAMP;

-- Rename steps_data to checklist_data for clarity
ALTER TABLE work_orders RENAME COLUMN steps_data TO checklist_data;

-- ============================================================================
-- WORK_ORDER_ACTIVITIES TABLE MODIFICATIONS
-- ============================================================================

-- Convert old_value and new_value from text to JSONB
ALTER TABLE work_order_activities 
    ALTER COLUMN old_value TYPE JSONB USING 
        CASE 
            WHEN old_value IS NULL THEN NULL
            WHEN old_value = '' THEN '{}'::jsonb
            ELSE json_build_object('value', old_value)::jsonb
        END;

ALTER TABLE work_order_activities 
    ALTER COLUMN new_value TYPE JSONB USING 
        CASE 
            WHEN new_value IS NULL THEN NULL
            WHEN new_value = '' THEN '{}'::jsonb
            ELSE json_build_object('value', new_value)::jsonb
        END;

-- ============================================================================
-- CREATE AUDIT_LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    changes JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_changes ON audit_logs USING gin(changes);

/*
-- ============================================================================
-- DATA MIGRATION FOR EXISTING ASSETS (REMOVED)
-- ============================================================================

-- Initialize hierarchy_path for existing root assets (those without parents)
-- This will be updated by the application's GORM hooks going forward
UPDATE assets 
SET hierarchy_path = id::text 
WHERE parent_id IS NULL AND hierarchy_path = '';

-- For assets with parents, you'll need to run a recursive query or 
-- let the application rebuild the paths when assets are next updated
-- Here's a recursive CTE to build paths for all existing assets:

WITH RECURSIVE asset_hierarchy AS (
    -- Base case: root assets
    SELECT 
        id,
        parent_id,
        id::text AS hierarchy_path
    FROM assets
    WHERE parent_id IS NULL
    
    UNION ALL
    
    -- Recursive case: child assets
    SELECT 
        a.id,
        a.parent_id,
        ah.hierarchy_path || '/' || a.id::text AS hierarchy_path
    FROM assets a
    INNER JOIN asset_hierarchy ah ON a.parent_id = ah.id
)
UPDATE assets
SET hierarchy_path = ah.hierarchy_path
FROM asset_hierarchy ah
WHERE assets.id = ah.id AND assets.hierarchy_path = '';
*/

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify assets table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'assets'
ORDER BY ordinal_position;

-- Verify work_orders table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'work_orders'
ORDER BY ordinal_position;

-- Verify audit_logs table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'audit_logs'
ORDER BY ordinal_position;

-- Verify indexes
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('assets', 'work_orders', 'work_order_activities', 'audit_logs')
ORDER BY tablename, indexname;

-- ============================================================================
-- ROLLBACK SCRIPT (Use with caution!)
-- ============================================================================

/*
-- To rollback these changes (WARNING: This will lose data!)

-- Drop audit_logs table
DROP TABLE IF EXISTS audit_logs;

-- Revert work_order_activities
ALTER TABLE work_order_activities ALTER COLUMN old_value TYPE TEXT;
ALTER TABLE work_order_activities ALTER COLUMN new_value TYPE TEXT;

-- Revert work_orders
ALTER TABLE work_orders RENAME COLUMN checklist_data TO steps_data;
ALTER TABLE work_orders DROP COLUMN IF EXISTS expected_start_at;
ALTER TABLE work_orders DROP COLUMN IF EXISTS expected_finish_at;
ALTER TABLE work_orders DROP COLUMN IF EXISTS actual_start_at;
ALTER TABLE work_orders DROP COLUMN IF EXISTS actual_finish_at;

-- Revert assets
DROP INDEX IF EXISTS idx_attributes;
DROP INDEX IF EXISTS idx_hierarchy_path;
DROP INDEX IF EXISTS idx_assets_parent_id;
ALTER TABLE assets RENAME COLUMN attributes TO metadata;
ALTER TABLE assets DROP COLUMN IF EXISTS hierarchy_path;
ALTER TABLE assets DROP COLUMN IF EXISTS parent_id;
*/
