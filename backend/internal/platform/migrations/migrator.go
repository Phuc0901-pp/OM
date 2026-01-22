package migrations

import (
	"log"

	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/gorm"
)

func RunManualMigrations(db *gorm.DB) {
	log.Println("Running Database Migrations...")

	// Pre-Migration Fixes: Drop constraints that might cause conflicts
    // DEPRECATED: locations table removed by user request
    db.Exec("DROP TABLE IF EXISTS locations CASCADE")

	db.Exec("ALTER TABLE main_categories DROP CONSTRAINT IF EXISTS uni_main_categories_name")
	db.Exec("DROP INDEX IF EXISTS uni_main_categories_name")
	db.Exec("ALTER TABLE roles DROP CONSTRAINT IF EXISTS uni_roles_name")
	db.Exec("DROP INDEX IF EXISTS uni_roles_name")
	db.Exec("ALTER TABLE project_classification DROP CONSTRAINT IF EXISTS uni_project_classification_name")

	// Auto Migrate (GORM)
	err := db.AutoMigrate(
		&domain.User{},
		&domain.Role{},
		&domain.Team{},
		&domain.WorkOrder{},
		&domain.WorkOrderActivity{},
		&domain.Project{},
		&domain.ProjectClassification{},
		&domain.MainCategory{},
		&domain.Station{},        // Must be before ChildCategory due to FK
        &domain.StationChildConfig{}, // NEW TABLE
		&domain.ChildCategory{},
		&domain.ProjectCharacteristic{},
		&domain.Assign{},
		&domain.TaskDetail{},
		&domain.Attendance{},
		&domain.Process{}, // NEW: Process Table
	)
	if err != nil {
		log.Printf("AutoMigrate Failed: %v", err)
	}

	// Post-Migration Manual Fixes
	
	// ==================== TASK_DETAILS NEW SCHEMA (2026-01-17) ====================
	// Drop old columns
	db.Exec("ALTER TABLE task_details DROP COLUMN IF EXISTS station_name")
	db.Exec("ALTER TABLE task_details DROP COLUMN IF EXISTS inverter_name")
	db.Exec("ALTER TABLE task_details DROP COLUMN IF EXISTS \"check\"")
	db.Exec("ALTER TABLE task_details DROP COLUMN IF EXISTS accept")
	db.Exec("ALTER TABLE task_details DROP COLUMN IF EXISTS status")
	db.Exec("ALTER TABLE task_details DROP COLUMN IF EXISTS note")
	db.Exec("ALTER TABLE task_details DROP COLUMN IF EXISTS notes")
	db.Exec("ALTER TABLE task_details DROP COLUMN IF EXISTS image_path")
	db.Exec("ALTER TABLE task_details DROP COLUMN IF EXISTS data_result")
	db.Exec("ALTER TABLE task_details DROP COLUMN IF EXISTS approved_at")
	db.Exec("ALTER TABLE task_details DROP COLUMN IF EXISTS rejected_at")
	db.Exec("ALTER TABLE task_details DROP COLUMN IF EXISTS station_child_config_id")
	db.Exec("ALTER TABLE task_details DROP COLUMN IF EXISTS item_index")
	
	// Add new columns
	db.Exec("ALTER TABLE task_details ADD COLUMN IF NOT EXISTS station_id UUID")
	db.Exec("ALTER TABLE task_details ADD COLUMN IF NOT EXISTS process_id UUID")
	db.Exec("ALTER TABLE task_details ADD COLUMN IF NOT EXISTS status_work INTEGER DEFAULT 0")
	db.Exec("ALTER TABLE task_details ADD COLUMN IF NOT EXISTS status_submit INTEGER DEFAULT 0")
	db.Exec("ALTER TABLE task_details ADD COLUMN IF NOT EXISTS status_approve INTEGER DEFAULT 0")
	db.Exec("ALTER TABLE task_details ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE")
	db.Exec("ALTER TABLE task_details ADD COLUMN IF NOT EXISTS approval_at TIMESTAMP WITH TIME ZONE")
	db.Exec("ALTER TABLE task_details ADD COLUMN IF NOT EXISTS reject_at TIMESTAMP WITH TIME ZONE")
	db.Exec("ALTER TABLE task_details ADD COLUMN IF NOT EXISTS note_reject TEXT")
	db.Exec("ALTER TABLE task_details ADD COLUMN IF NOT EXISTS note_approval TEXT")
	
	// NEW: Timeline and notes from allocation UI (2026-01-17)
	db.Exec("ALTER TABLE task_details ADD COLUMN IF NOT EXISTS project_start_time TIMESTAMP WITH TIME ZONE")
	db.Exec("ALTER TABLE task_details ADD COLUMN IF NOT EXISTS project_end_time TIMESTAMP WITH TIME ZONE")
	db.Exec("ALTER TABLE task_details ADD COLUMN IF NOT EXISTS data_note TEXT")
	
	db.Exec("ALTER TABLE task_details ADD COLUMN IF NOT EXISTS status_reject INTEGER DEFAULT 0")
	// db.Exec("ALTER TABLE task_details ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE")
	db.Exec("ALTER TABLE task_details DROP COLUMN IF EXISTS rejected_at") // Removed per user request 2026-01-22
	
	// NEW: Work note stored in MinIO (2026-01-20)
	db.Exec("ALTER TABLE task_details ADD COLUMN IF NOT EXISTS work_note TEXT")
	
	// Index for station_id
	db.Exec("CREATE INDEX IF NOT EXISTS idx_task_details_station_id ON task_details(station_id)")

    
    // Manual fallback for station_child_configs if AutoMigrate fails
    db.Exec(`
        CREATE TABLE IF NOT EXISTS station_child_configs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            station_id UUID NOT NULL,
            child_category_id UUID NOT NULL,
            process_ids JSONB,
            guide_text TEXT,
            guide_images JSONB,
            image_count INTEGER DEFAULT 0,
            id_project_classification UUID,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_station_child_configs_station_id ON station_child_configs(station_id);
    `)
    
    // Add id_project_classification if not exists
    db.Exec("ALTER TABLE station_child_configs ADD COLUMN IF NOT EXISTS id_project_classification UUID")

	
	// Stations Table (Manual Fallback)
	db.Exec(`CREATE TABLE IF NOT EXISTS stations (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		name TEXT NOT NULL,
		id_project UUID,
		id_main_category UUID,
		id_process JSONB,
		status TEXT DEFAULT 'pending',
		accept INTEGER DEFAULT 0,
		"check" INTEGER DEFAULT 0,
		submitted_at TIMESTAMP WITH TIME ZONE,
		approval_at TIMESTAMP WITH TIME ZONE,
		rejected_at TIMESTAMP WITH TIME ZONE,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		deleted_at TIMESTAMP WITH TIME ZONE
	)`)
	
	// Add StationID column to child_categories for hierarchy
	db.Exec("ALTER TABLE child_categories ADD COLUMN IF NOT EXISTS id_station UUID")
	
	// Add child_category_ids column to stations for storing config
	db.Exec("ALTER TABLE stations ADD COLUMN IF NOT EXISTS child_category_ids JSONB")
	
	// Add child_configs column for per-child-category configuration
	// CLEANUP: Drop columns moved to station_child_configs table
	db.Exec("ALTER TABLE stations DROP COLUMN IF EXISTS child_configs")
    db.Exec("ALTER TABLE stations DROP COLUMN IF EXISTS huong_dan")
    db.Exec("ALTER TABLE stations DROP COLUMN IF EXISTS so_luong_anh")
    db.Exec("ALTER TABLE stations DROP COLUMN IF EXISTS duong_dan_anh")
	
	// NEW: Drop deprecated columns from stations (2026-01-17)
	// Status tracking is now in task_details table
	db.Exec("ALTER TABLE stations DROP COLUMN IF EXISTS id_process")
	db.Exec("ALTER TABLE stations DROP COLUMN IF EXISTS status")
	db.Exec("ALTER TABLE stations DROP COLUMN IF EXISTS accept")
	db.Exec("ALTER TABLE stations DROP COLUMN IF EXISTS \"check\"")
	db.Exec("ALTER TABLE stations DROP COLUMN IF EXISTS submitted_at")
	db.Exec("ALTER TABLE stations DROP COLUMN IF EXISTS approval_at")
	db.Exec("ALTER TABLE stations DROP COLUMN IF EXISTS rejected_at")

    // Assign Relation for Stations (User Request)
    db.Exec("ALTER TABLE stations ADD COLUMN IF NOT EXISTS assign_id UUID")
    db.Exec("CREATE INDEX IF NOT EXISTS idx_stations_assign_id ON stations(assign_id)")
    // Add FK manually to avoid errors if parent missing (though Assign should exist)
    db.Exec(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_stations_assign'
            ) THEN
                ALTER TABLE stations ADD CONSTRAINT fk_stations_assign 
                    FOREIGN KEY (assign_id) REFERENCES assign(id) ON DELETE SET NULL;
            END IF;
        END $$;
    `)

	
	// Users
	db.Exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id text")
    db.Exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS id_leader UUID")

	// Attendances (Safe IDEMPOTENT Execution)
	db.Exec(`
        CREATE TABLE IF NOT EXISTS attendances (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            id_user UUID NOT NULL,
            date_checkin TIMESTAMP,
            date_checkout TIMESTAMP,
            status_checkin INTEGER DEFAULT 0,
            status_checkout INTEGER DEFAULT 0,
            site_status INTEGER DEFAULT 0,
            personnel_photo TEXT,
            id_card_front TEXT,
            id_card_back TEXT,
            safety_card_front TEXT,
            safety_card_back TEXT,
            tools_photos TEXT,
            documents_photos TEXT,
            checkout_requested BOOLEAN DEFAULT FALSE,
            checkout_request_time TIMESTAMP,
            checkout_approved BOOLEAN DEFAULT FALSE,
            checkout_approved_by UUID,
            checkout_approved_time TIMESTAMP,
            checkout_rejected BOOLEAN DEFAULT FALSE,
            checkout_reject_reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP
        )
    `)
	// Ensure columns exist (in case table existed but columns didn't)
	db.Exec("ALTER TABLE attendances ADD COLUMN IF NOT EXISTS checkout_requested BOOLEAN DEFAULT FALSE")
	db.Exec("ALTER TABLE attendances ADD COLUMN IF NOT EXISTS checkout_request_time TIMESTAMP")
	db.Exec("ALTER TABLE attendances ADD COLUMN IF NOT EXISTS checkout_approved BOOLEAN DEFAULT FALSE")
	db.Exec("ALTER TABLE attendances ADD COLUMN IF NOT EXISTS checkout_approved_by UUID")
	db.Exec("ALTER TABLE attendances ADD COLUMN IF NOT EXISTS checkout_approved_time TIMESTAMP")
	db.Exec("ALTER TABLE attendances ADD COLUMN IF NOT EXISTS checkout_rejected BOOLEAN DEFAULT FALSE")
	db.Exec("ALTER TABLE attendances ADD COLUMN IF NOT EXISTS checkout_reject_reason TEXT")
	
	// Add id_project column and foreign key
	db.Exec("ALTER TABLE attendances ADD COLUMN IF NOT EXISTS id_project UUID")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_attendances_id_project ON attendances(id_project)")
	// Note: Foreign key constraint added separately to handle existing NULL values
	db.Exec(`
		DO $$
		BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendances_project'
			) THEN
				ALTER TABLE attendances ADD CONSTRAINT fk_attendances_project 
					FOREIGN KEY (id_project) REFERENCES projects(project_id) ON DELETE SET NULL;
			END IF;
		END $$;
	`)

	// Categories & Projects
	if !db.Migrator().HasColumn(&domain.MainCategory{}, "UpdatedAt") {
		db.Migrator().AddColumn(&domain.MainCategory{}, "UpdatedAt")
	}
	if !db.Migrator().HasColumn(&domain.ChildCategory{}, "UpdatedAt") {
		db.Migrator().AddColumn(&domain.ChildCategory{}, "UpdatedAt")
	}
	db.Exec("ALTER TABLE project_classification ADD COLUMN IF NOT EXISTS description TEXT")
	
	// Child Categories - New fields for requires_inverter feature
	db.Exec("ALTER TABLE child_categories ADD COLUMN IF NOT EXISTS requires_inverter BOOLEAN DEFAULT FALSE")
	db.Exec("ALTER TABLE child_categories ADD COLUMN IF NOT EXISTS column_key VARCHAR(100)")
	
	// ====================== PROJECT CHARACTERISTICS REFACTOR ======================
	// Add new JSONB columns for dynamic child category data
	db.Exec("ALTER TABLE project_characteristics ADD COLUMN IF NOT EXISTS child_category_data JSONB DEFAULT '{}'")
	// Restore Global Inverter Columns
	db.Exec("ALTER TABLE project_characteristics ADD COLUMN IF NOT EXISTS inverter_sub_area_count INTEGER DEFAULT 0")
	db.Exec("ALTER TABLE project_characteristics ADD COLUMN IF NOT EXISTS inverter_details JSONB DEFAULT '[]'")
	db.Exec("ALTER TABLE project_characteristics ADD COLUMN IF NOT EXISTS inverter INTEGER DEFAULT 0")

	// Drop Local Columns (moved to JSON)
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS area_name")
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS process_ids")

	
	// Drop old Main Category columns (data will be lost - as requested by user)
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS pv_module")
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS dc_wire")
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS ac_wire")

	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS smdb")
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS sdb")
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS transformer_and_fco")
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS grounding")
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS water_system")
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS walkway")
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS fire_fight")
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS monitoring")
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS ups")
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS life_line")
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS cable_tray")
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS sensor")
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS heart_ladder")
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS ton_lay_sang")
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS combiner_box")
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS framework")
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS thermal")
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS report_image")
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS inv_station")
	db.Exec("ALTER TABLE project_characteristics DROP COLUMN IF EXISTS camera")
	
	// Generate column_key for existing child categories that don't have one
	db.Exec(`
		UPDATE child_categories 
		SET column_key = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '\s+', '_', 'g'), '[^a-zA-Z0-9_]', '', 'g'))
		WHERE column_key IS NULL OR column_key = ''
	`)
	
	// Concepts table
	db.Exec(`
		CREATE TABLE IF NOT EXISTS concepts (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name VARCHAR(100) NOT NULL UNIQUE,
			description TEXT,
			columns JSONB NOT NULL,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)
	`)
	db.Exec("CREATE INDEX IF NOT EXISTS idx_concepts_name ON concepts(name)")
	
	// Concepts trigger for updated_at
	db.Exec(`
		CREATE OR REPLACE FUNCTION update_concepts_updated_at()
		RETURNS TRIGGER AS $$
		BEGIN
			NEW.updated_at = NOW();
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql
	`)
	db.Exec(`
		DROP TRIGGER IF EXISTS update_concepts_updated_at_trigger ON concepts;
		CREATE TRIGGER update_concepts_updated_at_trigger
			BEFORE UPDATE ON concepts
			FOR EACH ROW
			EXECUTE FUNCTION update_concepts_updated_at()
	`)
	

	// Checklist Templates - NEW SCHEMA (Drop and recreate)
	db.Exec(`DROP TABLE IF EXISTS checklist_templates CASCADE`)
	db.Exec(`
		CREATE TABLE IF NOT EXISTS checklist_templates (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			assign_id UUID NOT NULL REFERENCES assign(id) ON DELETE CASCADE,
			structure_site_of_inverter JSONB DEFAULT '{}',
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			deleted_at TIMESTAMP WITH TIME ZONE
		)
	`)
	// Ensure indices
	db.Exec("CREATE INDEX IF NOT EXISTS idx_checklist_templates_assign ON checklist_templates(assign_id)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_checklist_templates_deleted_at ON checklist_templates(deleted_at)")

	// Add process_id to task_details
	db.Exec("ALTER TABLE task_details ADD COLUMN IF NOT EXISTS process_id UUID")

	// Checklist trigger for updated_at
	db.Exec(`
		CREATE OR REPLACE FUNCTION update_checklist_templates_updated_at()
		RETURNS TRIGGER AS $$
		BEGIN
			NEW.updated_at = NOW();
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql
	`)
	db.Exec(`
		DROP TRIGGER IF EXISTS update_checklist_templates_updated_at_trigger ON checklist_templates;
		CREATE TRIGGER update_checklist_templates_updated_at_trigger
			BEFORE UPDATE ON checklist_templates
			FOR EACH ROW
			EXECUTE FUNCTION update_checklist_templates_updated_at()
	`)

	if !db.Migrator().HasColumn(&domain.Assign{}, "DataResult") {
		db.Migrator().RenameColumn(&domain.Project{}, "create_at", "created_at")
	}

	log.Println("Migrations Completed Successfully.")
}
