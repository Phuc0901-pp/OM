package services

import (
	"fmt"
	"regexp"
	"strings"

	"gorm.io/gorm"
)

// SchemaService handles dynamic table creation and management
type SchemaService struct {
	db *gorm.DB
}

// Column represents a database column definition
type Column struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Required bool   `json:"required"`
}

// PostgreSQL reserved keywords (partial list - critical ones)
var reservedKeywords = map[string]bool{
	"select": true, "insert": true, "update": true, "delete": true,
	"drop": true, "create": true, "table": true, "index": true,
	"user": true, "group": true, "order": true, "where": true,
	"from": true, "join": true, "union": true, "all": true,
}

func NewSchemaService(db *gorm.DB) *SchemaService {
	return &SchemaService{db: db}
}

// ValidateTableName validates PostgreSQL table name
func (s *SchemaService) ValidateTableName(name string) error {
	// Must be lowercase, alphanumeric + underscore, start with letter
	// Length: 1-63 characters
	if len(name) == 0 || len(name) > 63 {
		return fmt.Errorf("table name must be between 1 and 63 characters")
	}

	matched, _ := regexp.MatchString(`^[a-z][a-z0-9_]*$`, name)
	if !matched {
		return fmt.Errorf("table name must start with a letter and contain only lowercase letters, numbers, and underscores")
	}

	// Check reserved keywords
	if reservedKeywords[strings.ToLower(name)] {
		return fmt.Errorf("table name '%s' is a reserved keyword", name)
	}

	return nil
}

// ValidateColumnName validates PostgreSQL column name
func (s *SchemaService) ValidateColumnName(name string) error {
	// Same rules as table name
	return s.ValidateTableName(name)
}

// MapTypeToPostgreSQL converts application types to PostgreSQL types
func (s *SchemaService) MapTypeToPostgreSQL(appType string) (string, error) {
	typeMap := map[string]string{
		"text":     "TEXT",
		"number":   "NUMERIC",
		"integer":  "INTEGER",
		"boolean":  "BOOLEAN",
		"date":     "DATE",
		"datetime": "TIMESTAMP",
		"json":     "JSONB",
	}

	pgType, ok := typeMap[strings.ToLower(appType)]
	if !ok {
		return "", fmt.Errorf("unsupported type: %s", appType)
	}

	return pgType, nil
}

// CreateDynamicTable creates a PostgreSQL table based on column definitions
func (s *SchemaService) CreateDynamicTable(tableName string, columns []Column) error {
	// Validate table name
	if err := s.ValidateTableName(tableName); err != nil {
		return fmt.Errorf("invalid table name: %w", err)
	}

	// Build CREATE TABLE SQL
	var columnDefs []string

	// Add standard columns
	columnDefs = append(columnDefs, "id UUID PRIMARY KEY DEFAULT gen_random_uuid()")

	// Add user-defined columns
	for _, col := range columns {
		// Validate column name
		if err := s.ValidateColumnName(col.Name); err != nil {
			return fmt.Errorf("invalid column name '%s': %w", col.Name, err)
		}

		// Map type
		pgType, err := s.MapTypeToPostgreSQL(col.Type)
		if err != nil {
			return fmt.Errorf("column '%s': %w", col.Name, err)
		}

		// Build column definition
		colDef := fmt.Sprintf("%s %s", col.Name, pgType)
		if col.Required {
			colDef += " NOT NULL"
		}

		columnDefs = append(columnDefs, colDef)
	}

	// Add standard timestamp columns
	columnDefs = append(columnDefs,
		"created_at TIMESTAMP DEFAULT NOW()",
		"updated_at TIMESTAMP DEFAULT NOW()",
		"deleted_at TIMESTAMP",
	)

	// Generate final SQL
	sql := fmt.Sprintf("CREATE TABLE IF NOT EXISTS %s (%s)", tableName, strings.Join(columnDefs, ", "))

	// Execute
	if err := s.db.Exec(sql).Error; err != nil {
		return fmt.Errorf("failed to create table: %w", err)
	}

	// Create index on deleted_at for soft deletes
	indexSQL := fmt.Sprintf("CREATE INDEX IF NOT EXISTS idx_%s_deleted_at ON %s(deleted_at)", tableName, tableName)
	if err := s.db.Exec(indexSQL).Error; err != nil {
		return fmt.Errorf("failed to create index: %w", err)
	}

	return nil
}

// DropDynamicTable drops a PostgreSQL table
func (s *SchemaService) DropDynamicTable(tableName string) error {
	// Validate table name to prevent SQL injection
	if err := s.ValidateTableName(tableName); err != nil {
		return fmt.Errorf("invalid table name: %w", err)
	}

	sql := fmt.Sprintf("DROP TABLE IF EXISTS %s CASCADE", tableName)
	if err := s.db.Exec(sql).Error; err != nil {
		return fmt.Errorf("failed to drop table: %w", err)
	}

	return nil
}

// TableExists checks if a table exists
func (s *SchemaService) TableExists(tableName string) (bool, error) {
	var count int64
	err := s.db.Raw(`
		SELECT COUNT(*) 
		FROM information_schema.tables 
		WHERE table_schema = 'public' AND table_name = ?
	`, tableName).Scan(&count).Error

	if err != nil {
		return false, err
	}

	return count > 0, nil
}
