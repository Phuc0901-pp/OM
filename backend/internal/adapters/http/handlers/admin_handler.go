package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AdminHandler struct {
	DB *gorm.DB
}

func NewAdminHandler(db *gorm.DB) *AdminHandler {
	return &AdminHandler{DB: db}
}

func (h *AdminHandler) isAllowed(tableName string) bool {
	// Static whitelist
	allowedTables := map[string]bool{
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
		"stations":                true,
		"process":                 true, // Often accessed as 'process' or 'processes' depending on creation
		"processes":               true,
		"station_child_configs":   true,
	}
	
	if allowedTables[tableName] {
		return true
	}

	// Check if it's a dynamic table (concept)
	var count int64
	h.DB.Table("concepts").Where("name = ?", tableName).Count(&count)
	return count > 0
}

func (h *AdminHandler) getPrimaryKey(tableName string) string {
	switch tableName {
	case "projects":
		return "project_id"
	case "attendance": // Check if attendance uses id or attendance_id? Usually id based on struct.
		return "id"
	default:
		return "id"
	}
}

// GET /admin/tables - List all tables in database
func (h *AdminHandler) GetAllTables(c *gin.Context) {
	type TableInfo struct {
		TableName string `json:"table_name"`
		RowCount  int64  `json:"row_count"`
	}

	var tables []TableInfo

	// Query information_schema to get all tables
	rows, err := h.DB.Raw(`
		SELECT table_name 
		FROM information_schema.tables 
		WHERE table_schema = 'public' 
		AND table_type = 'BASE TABLE'
		ORDER BY table_name
	`).Rows()

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query tables"})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			continue
		}

		// Get row count for each table
		var count int64
		h.DB.Table(tableName).Count(&count)

		tables = append(tables, TableInfo{
			TableName: tableName,
			RowCount:  count,
		})
	}

	c.JSON(http.StatusOK, tables)
}

// GET /admin/tables/:table
func (h *AdminHandler) GetTableData(c *gin.Context) {
	tableName := c.Param("table")

	if !h.isAllowed(tableName) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or unauthorized table name: " + tableName})
		return
	}

	var results []map[string]interface{}
	
	// Try Ordering by created_at desc if possible
	if err := h.DB.Table(tableName).Order("created_at DESC").Find(&results).Error; err != nil {
		// Fallback to simple Find
		if err := h.DB.Table(tableName).Find(&results).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error: " + err.Error()})
			return
		}
	}
	c.JSON(http.StatusOK, results)
}

// POST /admin/tables/:table
func (h *AdminHandler) CreateRow(c *gin.Context) {
	tableName := c.Param("table")
	if !h.isAllowed(tableName) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid table"})
		return
	}

	var data map[string]interface{}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON data"})
		return
	}

	// Remove ID if present/empty to let DB generate it (optional, GORM usually handles)
	// But let's trust Gorm.

	if err := h.DB.Table(tableName).Create(&data).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create record: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, data)
}

// PUT /admin/tables/:table/:id
func (h *AdminHandler) UpdateRow(c *gin.Context) {
	tableName := c.Param("table")
	id := c.Param("id")
	if !h.isAllowed(tableName) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid table"})
		return
	}

	var data map[string]interface{}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON data"})
		return
	}

	pk := h.getPrimaryKey(tableName)

	// Safety: Don't update ID itself? GORM updates by primary key usually, but here we use Where.
	delete(data, pk) // Prevent changing ID
	if pk != "id" {
		delete(data, "id") // Also delete 'id' just in case
	}

	if err := h.DB.Table(tableName).Where(pk+" = ?", id).Updates(data).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update record: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "updated", "id": id})
}

// DELETE /admin/tables/:table/:id
func (h *AdminHandler) DeleteRow(c *gin.Context) {
	tableName := c.Param("table")
	id := c.Param("id")
	if !h.isAllowed(tableName) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid table"})
		return
	}

	pk := h.getPrimaryKey(tableName)

	// Hard Delete using Unscoped()
	if err := h.DB.Unscoped().Table(tableName).Where(pk+" = ?", id).Delete(nil).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete record: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted", "id": id})
}

// POST /admin/tables/:table/bulk-delete
func (h *AdminHandler) DeleteRows(c *gin.Context) {
	tableName := c.Param("table")
	if !h.isAllowed(tableName) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid table"})
		return
	}

	type BatchRequest struct {
		IDs []interface{} `json:"ids"`
	}
	var req BatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	if len(req.IDs) == 0 {
		c.JSON(http.StatusOK, gin.H{"status": "deleted", "count": 0})
		return
	}

	pk := h.getPrimaryKey(tableName)

	// Hard Delete using Unscoped()
	if err := h.DB.Unscoped().Table(tableName).Where(pk+" IN ?", req.IDs).Delete(nil).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Batch deletion failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted", "count": len(req.IDs)})
}
