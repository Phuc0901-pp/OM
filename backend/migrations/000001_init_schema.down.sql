-- Drop Triggers
DROP TRIGGER IF EXISTS update_concepts_updated_at_trigger ON concepts;
DROP FUNCTION IF EXISTS update_concepts_updated_at;

DROP TRIGGER IF EXISTS update_checklist_templates_updated_at_trigger ON checklist_templates;
DROP FUNCTION IF EXISTS update_checklist_templates_updated_at;

-- Drop Tables (Order Matters due to Foreign Keys)
DROP TABLE IF EXISTS work_order_activities CASCADE;
DROP TABLE IF EXISTS work_orders CASCADE;
DROP TABLE IF EXISTS push_subscriptions CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS concepts CASCADE;
DROP TABLE IF EXISTS checklist_templates CASCADE;
DROP TABLE IF EXISTS attendances CASCADE;
DROP TABLE IF EXISTS task_details CASCADE;
DROP TABLE IF EXISTS station_child_configs CASCADE;
DROP TABLE IF EXISTS process CASCADE;
DROP TABLE IF EXISTS stations CASCADE;
DROP TABLE IF EXISTS assign CASCADE;
DROP TABLE IF EXISTS project_characteristics CASCADE;
DROP TABLE IF EXISTS child_categories CASCADE;
DROP TABLE IF EXISTS main_categories CASCADE;
DROP TABLE IF EXISTS project_classification CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- Drop Extensions (Optional, usually keep them)
-- DROP EXTENSION IF EXISTS "uuid-ossp";
-- DROP EXTENSION IF EXISTS "pgcrypto";
