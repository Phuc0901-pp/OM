package handlers

import (
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SchemaHandler struct {
	DB *gorm.DB
}

func NewSchemaHandler(db *gorm.DB) *SchemaHandler {
	return &SchemaHandler{DB: db}
}

// AddColumnRequest defines the request structure for adding a column
type AddColumnRequest struct {
	ColumnName   string  `json:"column_name" binding:"required"`
	DataType     string  `json:"data_type" binding:"required"`
	Length       *int    `json:"length,omitempty"`
	Nullable     bool    `json:"nullable"`
	DefaultValue *string `json:"default_value,omitempty"`
	ForeignKey   *struct {
		Table  string `json:"table"`
		Column string `json:"column"`
	} `json:"foreign_key,omitempty"`
}

var allowedTables = map[string]bool{
	"users":                   true,
	"projects":                true,
	"assign":                  true,
	"attendances":             true,
	"child_categories":        true,
	"main_categories":         true,
	"project_characteristics": true,
	"project_classification":  true,
	"roles":                   true,
	"task_details":            true,
	"teams":                   true,
}

var allowedDataTypes = map[string]bool{
	"VARCHAR":   true,
	"TEXT":      true,
	"INTEGER":   true,
	"BIGINT":    true,
	"UUID":      true,
	"BOOLEAN":   true,
	"TIMESTAMP": true,
	"DATE":      true,
	"NUMERIC":   true,
}

// validateColumnName checks if column name is safe (alphanumeric + underscore only)
func validateColumnName(name string) bool {
	match, _ := regexp.MatchString(`^[a-z][a-z0-9_]*$`, name)
	return match
}

// GenerateAddColumnSQL generates SQL for adding a column
func (h *SchemaHandler) generateAddColumnSQL(tableName string, req AddColumnRequest) (string, error) {
	// Validate table
	if !allowedTables[tableName] {
		return "", fmt.Errorf("table '%s' is not allowed", tableName)
	}

	// Validate column name
	if !validateColumnName(req.ColumnName) {
		return "", fmt.Errorf("invalid column name: must be lowercase alphanumeric with underscores")
	}

	// Validate data type
	upperDataType := strings.ToUpper(req.DataType)
	if !allowedDataTypes[upperDataType] {
		return "", fmt.Errorf("invalid data type")
	}

	// Build column definition
	var colDef strings.Builder
	colDef.WriteString(req.ColumnName)
	colDef.WriteString(" ")

	// Data type with length
	if upperDataType == "VARCHAR" && req.Length != nil {
		colDef.WriteString(fmt.Sprintf("VARCHAR(%d)", *req.Length))
	} else {
		colDef.WriteString(upperDataType)
	}

	// Nullable
	if !req.Nullable {
		colDef.WriteString(" NOT NULL")
	}

	// Default value
	if req.DefaultValue != nil {
		colDef.WriteString(fmt.Sprintf(" DEFAULT '%s'", *req.DefaultValue))
	}

	// Build ALTER TABLE statement
	sql := fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s", tableName, colDef.String())

	// Foreign key (as separate constraint)
	if req.ForeignKey != nil {
		if !allowedTables[req.ForeignKey.Table] {
			return "", fmt.Errorf("foreign key table '%s' is not allowed", req.ForeignKey.Table)
		}
		if !validateColumnName(req.ForeignKey.Column) {
			return "", fmt.Errorf("invalid foreign key column name")
		}
		fkName := fmt.Sprintf("fk_%s_%s", tableName, req.ColumnName)
		sql += fmt.Sprintf(", ADD CONSTRAINT %s FOREIGN KEY (%s) REFERENCES %s(%s)",
			fkName, req.ColumnName, req.ForeignKey.Table, req.ForeignKey.Column)
	}

	return sql + ";", nil
}

// PreviewAddColumn returns the SQL without executing it
func (h *SchemaHandler) PreviewAddColumn(c *gin.Context) {
	tableName := c.Param("table")
	var req AddColumnRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sql, err := h.generateAddColumnSQL(tableName, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"sql": sql})
}

// AddColumn executes the ALTER TABLE statement
func (h *SchemaHandler) AddColumn(c *gin.Context) {
	tableName := c.Param("table")
	var req AddColumnRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sql, err := h.generateAddColumnSQL(tableName, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Execute ALTER TABLE
	if err := h.DB.Exec(sql).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add column", "details": err.Error()})
		return
	}

	// Log the schema change (optional: save to a migrations table)
	// TODO: Implement migration logging

	c.JSON(http.StatusOK, gin.H{
		"message": "Column added successfully",
		"sql":     sql,
	})
}
