package handlers

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"github.com/phuc/cmms-backend/internal/utils"
	"github.com/signintech/gopdf"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type ProjectHandlerV2 struct {
	db          *gorm.DB
	projectRepo domain.ProjectRepository
	ownerRepo   domain.OwnerRepository
}

func NewProjectHandlerV2(db *gorm.DB, projectRepo domain.ProjectRepository, ownerRepo domain.OwnerRepository) *ProjectHandlerV2 {
	return &ProjectHandlerV2{db: db, projectRepo: projectRepo, ownerRepo: ownerRepo}
}

// GET /projects
func (h *ProjectHandlerV2) ListProjects(c *gin.Context) {
	projects, err := h.projectRepo.FindAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch projects"})
		return
	}
	c.JSON(http.StatusOK, projects)
}

// GET /projects/:id
func (h *ProjectHandlerV2) GetProject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	project, err := h.projectRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}
	c.JSON(http.StatusOK, project)
}

// ExportPayload is the optional request body for the POST /projects/:id/export endpoint.
type ExportPayload struct {
	// key = "WorkName|SubWorkName", value = comment text
	SubWorkComments map[string]string `json:"sub_work_comments"`
	Conclusion      string            `json:"conclusion"`
}

// PreviewTemplate holds status info for a template assigned to an asset.
type PreviewTemplate struct {
	TemplateName string `json:"template_name"`
	Status       string `json:"status"`
	SubmitDate   string `json:"submit_date"`
	ApproveDate  string `json:"approve_date"`
	ImageURL     string `json:"image_url"` // link → redirect-folder for this template's photos
}

// PreviewAsset is a single asset row used in the export preview API.
type PreviewAsset struct {
	ParentName     string            `json:"parent_name"`
	AssetName      string            `json:"asset_name"`
	Processes      []string          `json:"processes"`
	Templates      []PreviewTemplate `json:"templates"`
	ImageCount     int               `json:"image_count"`
	ImageFolderURL string            `json:"image_folder_url"` // link → all images for this asset
}

// PreviewSubWork is a sub-work node in the export preview API.
type PreviewSubWork struct {
	SubWorkName string         `json:"sub_work_name"`
	Assets      []PreviewAsset `json:"assets"`
}

// PreviewWork is a top-level work node in the export preview API.
type PreviewWork struct {
	WorkName string           `json:"work_name"`
	SubWorks []PreviewSubWork `json:"sub_works"`
}

// GetProjectExportPreview returns the full Work→SubWork→Asset+Process tree for a project.
// Used by the frontend Modal to show context before the user enters comments.
// GET /projects/:id/export-preview
func (h *ProjectHandlerV2) GetProjectExportPreview(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}

	// Determine base URL for building redirect links (same as ExportProject)
	scheme := "http"
	if c.Request.TLS != nil || c.Request.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	baseURL := fmt.Sprintf("%s://%s", scheme, c.Request.Host)

	var project domain.Project
	if err := h.db.First(&project, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	var configs []domain.Config
	if err := h.db.Preload("Asset.Parent").Preload("SubWork.Work").
		Joins("JOIN assets ON assets.id = configs.id_asset").
		Where("assets.id_project = ? AND configs.deleted_at IS NULL", id).
		Find(&configs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load configs"})
		return
	}

	var processes []domain.Process
	h.db.Find(&processes)
	procMap := make(map[string]string)
	for _, p := range processes {
		procMap[p.ID.String()] = p.Name
	}

	var templates []domain.Template
	h.db.Where("id_project = ? AND deleted_at IS NULL", id).Find(&templates)
	type TplInfo struct {
		ID   string
		Name string
	}
	cfgToTpl := make(map[string][]TplInfo)
	for _, tpl := range templates {
		var cids []string
		if json.Unmarshal(tpl.ConfigIDs, &cids) == nil {
			for _, cid := range cids {
				cfgToTpl[cid] = append(cfgToTpl[cid], TplInfo{ID: tpl.ID.String(), Name: tpl.Name})
			}
		}
	}

	var rawStatuses []struct {
		ConfigID      string `gorm:"column:config_id"`
		TemplateID    string `gorm:"column:template_id"`
		StatusWork    int
		StatusSubmit  int
		StatusReject  int
		StatusApprove int
		SubmittedAt   string `gorm:"column:submitted_at"`
		ApprovalAt    string `gorm:"column:approval_at"`
	}

	h.db.Table("detail_assigns").
		Select("CAST(detail_assigns.id_config AS VARCHAR) as config_id, CAST(assigns.id_template AS VARCHAR) as template_id, detail_assigns.status_work, detail_assigns.status_submit, detail_assigns.status_reject, detail_assigns.status_approve, CAST(detail_assigns.submitted_at AS VARCHAR) as submitted_at, CAST(detail_assigns.approval_at AS VARCHAR) as approval_at").
		Joins("JOIN configs ON configs.id = detail_assigns.id_config").
		Joins("JOIN assets ON assets.id = configs.id_asset").
		Joins("JOIN assigns ON assigns.id = detail_assigns.id_assign").
		Where("assets.id_project = ? AND detail_assigns.deleted_at IS NULL", id).
		Order("detail_assigns.created_at DESC").
		Scan(&rawStatuses)

	getLastDate := func(jsonStr string) string {
		if jsonStr == "" || jsonStr == "null" {
			return ""
		}
		var arr []string
		if err := json.Unmarshal([]byte(jsonStr), &arr); err == nil && len(arr) > 0 {
			t, err := time.Parse(time.RFC3339, arr[len(arr)-1])
			if err == nil {
				return t.Format("02/01 15:04")
			}
			return arr[len(arr)-1]
		}
		return ""
	}

	type TplStatusData struct {
		Status      string
		SubmitDate  string
		ApproveDate string
	}
	cfgTplStatusMap := make(map[string]TplStatusData)

	for _, rs := range rawStatuses {
		key := rs.ConfigID + "_" + rs.TemplateID
		if _, exists := cfgTplStatusMap[key]; exists {
			continue
		}

		statusText := "Chưa làm"
		if rs.StatusApprove == 1 {
			if rs.StatusReject == 1 {
				statusText = "Điều chỉnh xong"
			} else {
				statusText = "Đã xong"
			}
		} else if rs.StatusReject == 1 && rs.StatusSubmit == 1 {
			statusText = "Nộp lại"
		} else if rs.StatusReject == 1 {
			statusText = "Từ chối"
		} else if rs.StatusSubmit == 1 {
			statusText = "Chờ duyệt"
		} else if rs.StatusWork == 1 {
			statusText = "Đang làm"
		}

		cfgTplStatusMap[key] = TplStatusData{
			Status:      statusText,
			SubmitDate:  getLastDate(rs.SubmittedAt),
			ApproveDate: getLastDate(rs.ApprovalAt),
		}
	}

	type swKey struct{ w, sw string }
	var workOrder []string
	workSeen := make(map[string]bool)
	swOrder := make(map[string][]string)    // work → ordered subwork names
	swSeen := make(map[swKey]bool)           // dedup subworks
	swAssets := make(map[swKey][]PreviewAsset)

	for _, cfg := range configs {
		wName, swName := "Khác", "Không xác định"
		var procs []string
		if cfg.SubWork != nil {
			swName = cfg.SubWork.Name
			if cfg.SubWork.Work != nil {
				wName = cfg.SubWork.Work.Name
			}
			var pIDs []string
			if json.Unmarshal(cfg.SubWork.ProcessIDs, &pIDs) == nil {
				for _, pid := range pIDs {
					if n, ok := procMap[pid]; ok {
						procs = append(procs, n)
					}
				}
			}
		}
		if !workSeen[wName] {
			workSeen[wName] = true
			workOrder = append(workOrder, wName)
		}
		sk := swKey{wName, swName}
		if !swSeen[sk] {
			swSeen[sk] = true
			swOrder[wName] = append(swOrder[wName], swName)
		}
		parentName, assetName := "Thiết bị độc lập", "Hệ thống"
		if cfg.Asset != nil {
			assetName = cfg.Asset.Name
			if cfg.Asset.Parent != nil {
				parentName = cfg.Asset.Parent.Name
			}
		}

		var tplRows []PreviewTemplate
		if tpls, exists := cfgToTpl[cfg.ID.String()]; exists && len(tpls) > 0 {
			for _, tpl := range tpls {
				key := cfg.ID.String() + "_" + tpl.ID
				stData := TplStatusData{Status: "Chưa làm"}
				if st, ok := cfgTplStatusMap[key]; ok {
					stData = st
				}
				// Build image redirect URL exactly as in ExportProject PDF
				projSlug := utils.SlugifyName(project.Name)
				tplSlug := utils.SlugifyName(tpl.Name)
				workSlug := utils.SlugifyName(wName)
				subWorkSlug := utils.SlugifyName(swName)
				assetSlug := utils.SlugifyName(assetName)
				filters := fmt.Sprintf("%s,%s,%s,%s", tplSlug, workSlug, subWorkSlug, assetSlug)
				b64Title := base64.URLEncoding.EncodeToString([]byte(tpl.Name))
				imgURL := fmt.Sprintf("%s/api/redirect-folder?prefix=%s&filters=%s&title_b64=%s",
					baseURL, url.QueryEscape(projSlug), url.QueryEscape(filters), b64Title)
				tplRows = append(tplRows, PreviewTemplate{
					TemplateName: tpl.Name,
					Status:       stData.Status,
					SubmitDate:   stData.SubmitDate,
					ApproveDate:  stData.ApproveDate,
					ImageURL:     imgURL,
				})
			}
		}

		// Asset-level folder URL (all images for this asset across all templates)
		projSlug := utils.SlugifyName(project.Name)
		workSlug := utils.SlugifyName(wName)
		swSlug := utils.SlugifyName(swName)
		assetSlug := utils.SlugifyName(assetName)
		folderFilters := fmt.Sprintf("%s,%s,%s", workSlug, swSlug, assetSlug)
		b64Title := base64.URLEncoding.EncodeToString([]byte(assetName))
		folderURL := fmt.Sprintf("%s/api/redirect-folder?prefix=%s&filters=%s&title_b64=%s",
			baseURL, url.QueryEscape(projSlug), url.QueryEscape(folderFilters), b64Title)

		swAssets[sk] = append(swAssets[sk], PreviewAsset{
			ParentName:     parentName,
			AssetName:      assetName,
			Processes:      procs,
			Templates:      tplRows,
			ImageCount:     cfg.ImageCount,
			ImageFolderURL: folderURL,
		})
	}

	var result []PreviewWork
	for _, wName := range workOrder {
		pw := PreviewWork{WorkName: wName}
		for _, swName := range swOrder[wName] {
			sk := swKey{wName, swName}
			pw.SubWorks = append(pw.SubWorks, PreviewSubWork{
				SubWorkName: swName,
				Assets:      swAssets[sk],
			})
		}
		result = append(result, pw)
	}
	c.JSON(http.StatusOK, result)
}

// POST /projects/:id/export
func (h *ProjectHandlerV2) ExportProject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}

	// Parse optional body (sub_work_comments + conclusion)
	var payload ExportPayload
	_ = c.ShouldBindJSON(&payload) // Ignore error — body is optional
	if payload.SubWorkComments == nil {
		payload.SubWorkComments = map[string]string{}
	}

	var project domain.Project
	if err := h.db.First(&project, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	// Determine base URL dynamically
	scheme := "http"
	if c.Request.TLS != nil || c.Request.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	baseURL := fmt.Sprintf("%s://%s", scheme, c.Request.Host)

	var configs []domain.Config
	if err := h.db.Preload("Asset.Parent").Preload("SubWork.Work").
		Joins("JOIN assets ON assets.id = configs.id_asset").
		Where("assets.id_project = ? AND configs.deleted_at IS NULL", id).
		Find(&configs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load configs"})
		return
	}

	var processes []domain.Process
	h.db.Find(&processes)
	processMap := make(map[string]string)
	for _, p := range processes {
		processMap[p.ID.String()] = p.Name
	}

	var templates []domain.Template
	h.db.Where("id_project = ? AND deleted_at IS NULL", id).Find(&templates)
	type TplInfo struct {
		ID   string
		Name string
	}
	cfgToTpl := make(map[string][]TplInfo)
	for _, tpl := range templates {
		var cids []string
		if json.Unmarshal(tpl.ConfigIDs, &cids) == nil {
			for _, cid := range cids {
				cfgToTpl[cid] = append(cfgToTpl[cid], TplInfo{ID: tpl.ID.String(), Name: tpl.Name})
			}
		}
	}

	var rawStatuses []struct {
		ConfigID      string `gorm:"column:config_id"`
		TemplateID    string `gorm:"column:template_id"`
		StatusWork    int
		StatusSubmit  int
		StatusReject  int
		StatusApprove int
		SubmittedAt   string `gorm:"column:submitted_at"`
		ApprovalAt    string `gorm:"column:approval_at"`
		NoteData      string `gorm:"column:note_data"`
		NoteApproval  string `gorm:"column:note_approval"`
		NoteReject    string `gorm:"column:note_reject"`
	}

	h.db.Table("detail_assigns").
		Select("CAST(detail_assigns.id_config AS VARCHAR) as config_id, CAST(assigns.id_template AS VARCHAR) as template_id, detail_assigns.status_work, detail_assigns.status_submit, detail_assigns.status_reject, detail_assigns.status_approve, CAST(detail_assigns.submitted_at AS VARCHAR) as submitted_at, CAST(detail_assigns.approval_at AS VARCHAR) as approval_at, detail_assigns.note_data, detail_assigns.note_approval, detail_assigns.note_reject").
		Joins("JOIN configs ON configs.id = detail_assigns.id_config").
		Joins("JOIN assets ON assets.id = configs.id_asset").
		Joins("JOIN assigns ON assigns.id = detail_assigns.id_assign").
		Where("assets.id_project = ? AND detail_assigns.deleted_at IS NULL", id).
		Order("detail_assigns.created_at DESC").
		Scan(&rawStatuses)

	getLastDate := func(jsonStr string) string {
		if jsonStr == "" || jsonStr == "null" {
			return ""
		}
		var arr []string
		if err := json.Unmarshal([]byte(jsonStr), &arr); err == nil && len(arr) > 0 {
			t, err := time.Parse(time.RFC3339, arr[len(arr)-1])
			if err == nil {
				return t.Format("02/01 15:04")
			}
			return arr[len(arr)-1]
		}
		return ""
	}

	type TplStatusData struct {
		Status  string
		TimeStr string
		Note    string
	}
	cfgTplStatusMap := make(map[string]TplStatusData)

	for _, rs := range rawStatuses {
		key := rs.ConfigID + "_" + rs.TemplateID
		if _, exists := cfgTplStatusMap[key]; exists {
			continue // Only keep the status of the most recent detail_assign for this config+template
		}

		statusText := "Chưa làm"
		if rs.StatusApprove == 1 {
			if rs.StatusReject == 1 {
				statusText = "Điều chỉnh xong"
			} else {
				statusText = "Đã xong"
			}
		} else if rs.StatusReject == 1 && rs.StatusSubmit == 1 {
			statusText = "Nộp lại"
		} else if rs.StatusReject == 1 {
			statusText = "Từ chối"
		} else if rs.StatusSubmit == 1 {
			statusText = "Chờ duyệt"
		} else if rs.StatusWork == 1 {
			statusText = "Đang làm"
		}

		note := rs.NoteData
		if rs.NoteApproval != "" {
			if note != "" {
				note += "\n"
			}
			note += "[QL Duyệt]: " + rs.NoteApproval
		}
		if rs.NoteReject != "" {
			if note != "" {
				note += "\n"
			}
			note += "[QL Từ chối]: " + rs.NoteReject
		}

		nop := getLastDate(rs.SubmittedAt)
		duyet := getLastDate(rs.ApprovalAt)
		timeStr := ""
		if nop != "" {
			timeStr += "N: " + nop
		}
		if duyet != "" {
			if timeStr != "" {
				timeStr += "\n"
			}
			timeStr += "D: " + duyet
		}

		cfgTplStatusMap[key] = TplStatusData{
			Status:  statusText,
			TimeStr: timeStr,
			Note:    note,
		}
	}

	// ── Tree build ─────────
	type TemplateRow struct {
		Status   string
		TimeStr  string
		TplName  string
		Note     string
		MinioCtx domain.MinioPathContext
	}
	type AssetRow struct {
		ParentName string
		ChildName  string
		ImageCount int
		GuideText  string
		Templates  []TemplateRow
		MinioCtx   domain.MinioPathContext
	}
	type SubWorkNode struct {
		Name         string
		ProcessNames []string
		Assets       []AssetRow
	}
	type WorkNode struct {
		Name     string
		SubWorks []*SubWorkNode
		swIdx    map[string]*SubWorkNode
	}

	var workOrder []string
	workMap := make(map[string]*WorkNode)

	for _, cfg := range configs {
		wName, swName := "Khác", "Không xác định"
		var procs []string
		if cfg.SubWork != nil {
			swName = cfg.SubWork.Name
			if cfg.SubWork.Work != nil {
				wName = cfg.SubWork.Work.Name
			}
			var pIDs []string
			if json.Unmarshal(cfg.SubWork.ProcessIDs, &pIDs) == nil {
				for _, pid := range pIDs {
					if n, ok := processMap[pid]; ok {
						procs = append(procs, n)
					}
				}
			}
		}
		if _, ok := workMap[wName]; !ok {
			workOrder = append(workOrder, wName)
			workMap[wName] = &WorkNode{Name: wName, swIdx: make(map[string]*SubWorkNode)}
		}
		wn := workMap[wName]
		if _, ok := wn.swIdx[swName]; !ok {
			sw := &SubWorkNode{Name: swName, ProcessNames: procs}
			wn.SubWorks = append(wn.SubWorks, sw)
			wn.swIdx[swName] = sw
		}
		swn := wn.swIdx[swName]
		parentName, childName := "Thiết bị độc lập", "Hệ thống"
		if cfg.Asset != nil {
			childName = cfg.Asset.Name
			if cfg.Asset.Parent != nil {
				parentName = cfg.Asset.Parent.Name
			}
		}

		ctxPath := domain.MinioPathContext{
			ProjectName:     project.Name,
			WorkName:        wName,
			SubWorkName:     swName,
			ParentAssetName: parentName,
			AssetName:       childName,
		}

		var tplRows []TemplateRow
		if tpls, exists := cfgToTpl[cfg.ID.String()]; exists && len(tpls) > 0 {
			for _, tpl := range tpls {
				key := cfg.ID.String() + "_" + tpl.ID
				stData := TplStatusData{Status: "Chưa làm"}
				if st, ok := cfgTplStatusMap[key]; ok {
					stData = st
				}

				tplRows = append(tplRows, TemplateRow{
					Status:   stData.Status,
					TimeStr:  stData.TimeStr,
					TplName:  tpl.Name,
					Note:     stData.Note,
					MinioCtx: ctxPath,
				})
			}
		} else {
			tplRows = append(tplRows, TemplateRow{
				Status:   "Chưa làm",
				TplName:  "",
				MinioCtx: ctxPath,
			})
		}

		swn.Assets = append(swn.Assets, AssetRow{
			ParentName: parentName,
			ChildName:  childName,
			ImageCount: cfg.ImageCount,
			GuideText:  cfg.GuideText,
			Templates:  tplRows,
			MinioCtx:   ctxPath,
		})
	}

	// ── Layout constants ──────────────────────────────────────────────────────
	const (
		pW      = 595.28
		pH      = 841.89
		mL      = 40.0
		mR      = 40.0
		mT      = 40.0
		cW      = pW - mL - mR
		rH      = 24.0
		headerH = 75.0
	)
	colW := [5]float64{120, 32, 90, 65, cW - 120 - 32 - 90 - 65}

	type rgb = [3]uint8
	cHBg := rgb{22, 52, 88}
	cHTxt := rgb{255, 255, 255}
	cAcc := rgb{22, 130, 190}
	cWBg := rgb{44, 110, 175}
	cWTxt := rgb{255, 255, 255}
	cSBg := rgb{236, 243, 251}
	cSTxt := rgb{30, 58, 95}
	cTHd := rgb{70, 130, 180}
	cTHT := rgb{255, 255, 255}
	cBd := rgb{180, 200, 220}
	cPRow := rgb{240, 245, 252}
	cCRow := rgb{255, 255, 255}
	cTxt := rgb{35, 35, 35}
	cMut := rgb{100, 110, 125}

	// ── Init PDF ──────────────────────────────────────────────────────────────
	pdf := gopdf.GoPdf{}
	pdf.Start(gopdf.Config{PageSize: *gopdf.PageSizeA4})
	pdf.AddTTFFont("rg", "assets/fonts/Roboto-Regular.ttf")
	pdf.AddTTFFont("bd", "assets/fonts/Roboto-Bold.ttf")
	pdf.AddTTFFont("it", "assets/fonts/Roboto-Italic.ttf")
	pdf.AddPage()

	fillRect := func(x, y, w, h float64, col rgb) {
		pdf.SetFillColor(col[0], col[1], col[2])
		pdf.Rectangle(x, y, x+w, y+h, "F", 0, 0)
	}
	bdrRect := func(x, y, w, h float64) {
		pdf.SetStrokeColor(cBd[0], cBd[1], cBd[2])
		pdf.SetLineWidth(0.25)
		pdf.Rectangle(x, y, x+w, y+h, "D", 0, 0)
	}
	measureLines := func(font string, size int, text string, w float64) int {
		pdf.SetFont(font, "", size)
		lines, _ := pdf.SplitText(text, w-8)
		if len(lines) < 1 {
			return 1
		}
		return len(lines)
	}
	multiCell := func(font string, size int, x, y, w, rh float64, col rgb, txt string) {
		pdf.SetFont(font, "", size)
		lines, _ := pdf.SplitText(txt, w-8)
		if len(lines) == 0 {
			lines = []string{txt}
		}
		pdf.SetTextColor(col[0], col[1], col[2])

		lineH := float64(size) + 2.0
		textH := float64(len(lines)) * lineH
		yOff := (rh - textH) / 2.0
		if yOff < 3 {
			yOff = 3
		}

		for i, l := range lines {
			pdf.SetX(x + 4)
			lineY := y + yOff + float64(i)*lineH
			pdf.SetY(lineY)
			pdf.CellWithOption(&gopdf.Rect{W: w - 8, H: lineH}, l, gopdf.CellOption{Align: gopdf.Left})
		}
	}

	multiCellWithLink := func(font string, size int, x, y, w, rh float64, col rgb, texts []string, minioCtx domain.MinioPathContext) {
		if len(texts) == 0 {
			return
		}
		pdf.SetFont(font, "", size)
		pdf.SetTextColor(col[0], col[1], col[2])
		lineH := float64(size) + 2.0
		textH := float64(len(texts)) * lineH
		yOff := (rh - textH) / 2.0
		if yOff < 3 {
			yOff = 3
		}
		for i, l := range texts {
			pdf.SetX(x + 4)
			lineY := y + yOff + float64(i)*lineH
			pdf.SetY(lineY)
			pdf.CellWithOption(&gopdf.Rect{W: w - 8, H: lineH}, l, gopdf.CellOption{Align: gopdf.Left})

			// Build URL based on Project name and specific row context
			projSlug := utils.SlugifyName(minioCtx.ProjectName)
			tplSlug := utils.SlugifyName(l)
			workSlug := utils.SlugifyName(minioCtx.WorkName)
			subWorkSlug := utils.SlugifyName(minioCtx.SubWorkName)
			assetSlug := utils.SlugifyName(minioCtx.ParentAssetName)
			if minioCtx.AssetName != "" {
				assetSlug = utils.SlugifyName(minioCtx.AssetName)
			}

			// Comma separated filters to guarantee exact match
			filters := fmt.Sprintf("%s,%s,%s,%s", tplSlug, workSlug, subWorkSlug, assetSlug)

			b64Title := base64.URLEncoding.EncodeToString([]byte(l))
			redirectURL := fmt.Sprintf("%s/api/redirect-folder?prefix=%s&filters=%s&title_b64=%s",
				baseURL, url.QueryEscape(projSlug), url.QueryEscape(filters), b64Title)

			pdf.AddExternalLink(redirectURL, x+4, lineY, w-8, lineH)
		}
	}
	multiCellArray := func(font string, size int, x, y, w, rh float64, texts []string, cols []rgb) {
		if len(texts) == 0 {
			return
		}
		pdf.SetFont(font, "", size)
		lineH := float64(size) + 2.0
		textH := float64(len(texts)) * lineH
		yOff := (rh - textH) / 2.0
		if yOff < 3 {
			yOff = 3
		}
		for i, l := range texts {
			pdf.SetTextColor(cols[i][0], cols[i][1], cols[i][2])
			pdf.SetX(x + 4)
			lineY := y + yOff + float64(i)*lineH
			pdf.SetY(lineY)
			pdf.CellWithOption(&gopdf.Rect{W: w - 8, H: lineH}, l, gopdf.CellOption{Align: gopdf.Left})
		}
	}

	chkPage := func(curY *float64, need float64) {
		if *curY+need > pH-mT {
			pdf.AddPage()
			*curY = mT
		}
	}

	// ── Header ────────────────────────────────────────────────────────────────
	fillRect(0, 0, pW, headerH, cHBg)
	fillRect(0, 0, 5, headerH, cWBg)
	pdf.SetFont("bd", "", 24)
	pdf.SetTextColor(cHTxt[0], cHTxt[1], cHTxt[2])
	pdf.SetX(mL + 10)
	pdf.SetY(20)
	pdf.Cell(nil, "TÓM TẮT CẤU HÌNH DỰ ÁN")
	pdf.SetFont("rg", "", 14)
	pdf.SetTextColor(cAcc[0], cAcc[1], cAcc[2])
	pdf.SetX(mL + 10)
	pdf.SetY(48)
	pdf.CellWithOption(&gopdf.Rect{W: 300, H: 20}, project.Name, gopdf.CellOption{Align: gopdf.Left})
	pdf.SetFont("rg", "", 10)
	pdf.SetTextColor(cHTxt[0], cHTxt[1], cHTxt[2])
	pdf.SetX(pW - mR - 120)
	pdf.SetY(52)
	pdf.CellWithOption(&gopdf.Rect{W: 120, H: 20},
		"Ngày xuất: "+time.Now().Format("02/01/2006  15:04"),
		gopdf.CellOption{Align: gopdf.Left})
	pdf.SetStrokeColor(cAcc[0], cAcc[1], cAcc[2])
	pdf.SetLineWidth(0.8)
	pdf.Line(0, headerH, pW, headerH)

	curY := headerH + 4

	// ── Body ──────────────────────────────────────────────────────────────────
	for workIdx, wName := range workOrder {
		wn := workMap[wName]
		chkPage(&curY, 30)
		wBH := 24.0
		fillRect(mL, curY, cW, wBH, cWBg)
		multiCell("bd", 13, mL+2, curY-1, cW-2, wBH, cWTxt,
			fmt.Sprintf("%d.  %s", workIdx+1, strings.ToUpper(wName)))
		curY += wBH + 4

		for swIdx, swn := range wn.SubWorks {
			chkPage(&curY, 30)
			swBH := 22.0
			fillRect(mL, curY, cW, swBH, cSBg)
			bdrRect(mL, curY, cW, swBH)
			multiCell("bd", 11, mL+4, curY-1, cW-4, swBH, cSTxt,
				fmt.Sprintf("%d.%d.  %s", workIdx+1, swIdx+1, swn.Name))
			curY += swBH + 4

			if len(swn.ProcessNames) > 0 {
				chkPage(&curY, 20)
				pdf.SetFont("it", "", 10)
				pdf.SetTextColor(cMut[0], cMut[1], cMut[2])
				pdf.SetX(mL + 10)
				pdf.SetY(curY + 2)
				pdf.CellWithOption(&gopdf.Rect{W: cW - 10, H: 20},
					"Quy trình: "+strings.Join(swn.ProcessNames, "  ➔  "),
					gopdf.CellOption{Align: gopdf.Left})
				curY += 20
			}

			// Table header
			chkPage(&curY, rH+1)
			thH := rH + 1
			fillRect(mL, curY, cW, thH, cTHd)
			xOff := mL
			for ci, lbl := range []string{"  THIẾT BỊ", "  ẢNH", "  HƯỚNG DẪN", "  TRẠNG THÁI", "  BIỂU MẪU (TEMPLATE)"} {
				bdrRect(xOff, curY, colW[ci], thH)
				multiCell("bd", 8, xOff, curY, colW[ci], thH, cTHT, lbl)
				xOff += colW[ci]
			}
			curY += thH

			// Group by parent
			type pg struct {
				name string
				rows []AssetRow
			}
			var pgOrder []string
			pgMap2 := make(map[string]*pg)
			for _, a := range swn.Assets {
				if _, ok := pgMap2[a.ParentName]; !ok {
					pgOrder = append(pgOrder, a.ParentName)
					pgMap2[a.ParentName] = &pg{name: a.ParentName}
				}
				pgMap2[a.ParentName].rows = append(pgMap2[a.ParentName].rows, a)
			}

			for _, pName := range pgOrder {
				g := pgMap2[pName]
				chkPage(&curY, rH)
				fillRect(mL, curY, cW, rH, cPRow)
				xOff = mL
				for _, cw := range colW {
					bdrRect(xOff, curY, cw, rH)
					xOff += cw
				}
				multiCell("bd", 10, mL+2, curY, colW[0]-2, rH, cTxt, "■  "+pName)
				curY += rH

				// Child rows
				for _, row := range g.rows {
					maxL := 1
					l1 := measureLines("rg", 9, "↳ "+row.ChildName, colW[0])
					if l1 > maxL {
						maxL = l1
					}
					l2 := measureLines("it", 8, row.GuideText, colW[2])
					if l2 > maxL {
						maxL = l2
					}
					l3 := len(row.Templates)
					if l3 > 0 && l3 > maxL {
						maxL = l3
					}

					actualRowH := float64(maxL)*11.0 + 8.0
					if actualRowH < rH {
						actualRowH = rH
					}

					chkPage(&curY, actualRowH)
					fillRect(mL, curY, cW, actualRowH, cCRow)

					xOff = mL
					for _, cw := range colW {
						bdrRect(xOff, curY, cw, actualRowH)
						xOff += cw
					}

					multiCell("rg", 9, mL, curY, colW[0], actualRowH, cTxt, "↳ "+row.ChildName)
					multiCell("bd", 9, mL+colW[0], curY, colW[1], actualRowH, cAcc, fmt.Sprintf("%d", row.ImageCount))
					multiCell("it", 8, mL+colW[0]+colW[1], curY, colW[2], actualRowH, cMut, row.GuideText)

					var statuses []string
					var stColors []rgb
					var tplNames []string

					if len(row.Templates) > 0 {
						for _, tpl := range row.Templates {
							stCol := cMut
							switch tpl.Status {
							case "Đã xong":
								stCol = rgb{34, 139, 34} // Green
							case "Điều chỉnh xong":
								stCol = rgb{147, 51, 234} // Purple
							case "Chờ duyệt":
								stCol = rgb{217, 119, 6} // Amber
							case "Nộp lại":
								stCol = rgb{6, 182, 212} // Cyan
							case "Từ chối":
								stCol = rgb{220, 38, 38} // Red
							case "Đang làm":
								stCol = rgb{37, 99, 235} // Blue
							case "Chưa làm":
								stCol = rgb{156, 163, 175} // Gray
							}
							statuses = append(statuses, tpl.Status)
							stColors = append(stColors, stCol)
							tplNames = append(tplNames, tpl.TplName)
						}
						multiCellArray("bd", 8, mL+colW[0]+colW[1]+colW[2], curY, colW[3], actualRowH, statuses, stColors)
						multiCellWithLink("rg", 8, mL+colW[0]+colW[1]+colW[2]+colW[3], curY, colW[4], actualRowH, cAcc, tplNames, row.MinioCtx)
					} else {
						multiCell("bd", 8, mL+colW[0]+colW[1]+colW[2], curY, colW[3], actualRowH, cMut, "Chưa làm")
					}

					curY += actualRowH
				}
			}
			curY += 4

			// ── SubWork-level comment block ───────────────────────────────
			swCommentKey := wName + "|" + swn.Name
			swCommentText := payload.SubWorkComments[swCommentKey]
			swCommentH := 50.0
			if swCommentText != "" {
				nLines := measureLines("rg", 9, swCommentText, cW-20)
				swCommentH = float64(nLines)*11.0 + 24.0
				if swCommentH < 44.0 {
					swCommentH = 44.0
				}
			}
			chkPage(&curY, swCommentH+6)
			commentBg := rgb{254, 252, 232}
			commentBdr := rgb{202, 138, 4}
			fillRect(mL+8, curY, cW-8, swCommentH, commentBg)
			pdf.SetStrokeColor(commentBdr[0], commentBdr[1], commentBdr[2])
			pdf.SetLineWidth(0.4)
			pdf.Rectangle(mL+8, curY, mL+cW, curY+swCommentH, "D", 0, 0)
			fillRect(mL+8, curY, 4, swCommentH, commentBdr)
			pdf.SetFont("bd", "", 8)
			pdf.SetTextColor(120, 80, 0)
			pdf.SetX(mL + 16)
			pdf.SetY(curY + 5)
			pdf.CellWithOption(&gopdf.Rect{W: cW - 24, H: 11},
				"Nhận xét / Ghi chú cho "+swn.Name+":",
				gopdf.CellOption{Align: gopdf.Left})
			if swCommentText == "" {
				for li := 0; li < 2; li++ {
					pdf.SetStrokeColor(180, 160, 80)
					pdf.SetLineWidth(0.25)
					lineY := curY + 20.0 + float64(li)*15.0
					pdf.Line(mL+14, lineY, mL+cW-6, lineY)
				}
			} else {
				multiCell("rg", 9, mL+14, curY+16, cW-22, swCommentH-20, rgb{80, 60, 10}, swCommentText)
			}
			curY += swCommentH + 6
		}
		curY += 5
	}

	// ── Conclusion block ──────────────────────────────────────────────────────
	conclusionText := payload.Conclusion
	concBlockH := 90.0
	if conclusionText != "" {
		nLines := measureLines("rg", 10, conclusionText, cW-20)
		concBlockH = float64(nLines)*12.0 + 50.0
		if concBlockH < 90.0 {
			concBlockH = 90.0
		}
	}
	chkPage(&curY, concBlockH+20)
	curY += 10

	// Conclusion header bar
	concHdr := rgb{22, 52, 88}
	fillRect(mL, curY, cW, 26, concHdr)
	fillRect(mL, curY, 5, 26, cAcc)
	pdf.SetFont("bd", "", 12)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetX(mL + 12)
	pdf.SetY(curY + 7)
	pdf.CellWithOption(&gopdf.Rect{W: cW - 12, H: 14}, "KẾT LUẬN CHUNG", gopdf.CellOption{Align: gopdf.Left})
	curY += 26

	// Conclusion body
	concBody := rgb{240, 245, 255}
	fillRect(mL, curY, cW, concBlockH, concBody)
	pdf.SetStrokeColor(cBd[0], cBd[1], cBd[2])
	pdf.SetLineWidth(0.5)
	pdf.Rectangle(mL, curY, mL+cW, curY+concBlockH, "D", 0, 0)
	fillRect(mL, curY, 4, concBlockH, cAcc)

	if conclusionText == "" {
		// Placeholder lines
		for li := 0; li < 4; li++ {
			pdf.SetStrokeColor(180, 195, 215)
			pdf.SetLineWidth(0.3)
			lineY := curY + 12.0 + float64(li)*18.0
			pdf.Line(mL+10, lineY, mL+cW-10, lineY)
		}
	} else {
		multiCell("rg", 10, mL+10, curY+8, cW-20, concBlockH-16, cTxt, conclusionText)
	}
	curY += concBlockH + 20

	// ── Signature Row ─────────────────────────────────────────────────────────
	chkPage(&curY, 80)
	sigBoxW := cW / 3.0
	sigLabels := []string{"Người lập biểu", "Quản lý dự án", "Đại diện chủ đầu tư"}
	for si, lbl := range sigLabels {
		xs := mL + float64(si)*sigBoxW
		fillRect(xs, curY, sigBoxW, 70, rgb{250, 252, 255})
		pdf.SetStrokeColor(cBd[0], cBd[1], cBd[2])
		pdf.SetLineWidth(0.3)
		pdf.Rectangle(xs, curY, xs+sigBoxW, curY+70, "D", 0, 0)
		pdf.SetFont("bd", "", 9)
		pdf.SetTextColor(cTxt[0], cTxt[1], cTxt[2])
		pdf.SetX(xs + 4)
		pdf.SetY(curY + 5)
		pdf.CellWithOption(&gopdf.Rect{W: sigBoxW - 8, H: 12}, lbl, gopdf.CellOption{Align: gopdf.Center})
		pdf.SetFont("it", "", 8)
		pdf.SetTextColor(cMut[0], cMut[1], cMut[2])
		pdf.SetX(xs + 4)
		pdf.SetY(curY + 17)
		pdf.CellWithOption(&gopdf.Rect{W: sigBoxW - 8, H: 10}, "(Ký và ghi rõ họ tên)", gopdf.CellOption{Align: gopdf.Center})
		// Signature line
		pdf.SetStrokeColor(160, 180, 200)
		pdf.SetLineWidth(0.5)
		pdf.Line(xs+10, curY+55, xs+sigBoxW-10, curY+55)
	}

	// ── Footer ────────────────────────────────────────────────────────────────
	pdf.SetStrokeColor(cBd[0], cBd[1], cBd[2])
	pdf.SetLineWidth(0.8)
	pdf.Line(mL, pH-25, pW-mR, pH-25)
	pdf.SetFont("it", "", 9)
	pdf.SetTextColor(cMut[0], cMut[1], cMut[2])
	pdf.SetX(mL)
	pdf.SetY(pH - 20)
	pdf.CellWithOption(&gopdf.Rect{W: cW, H: 20},
		"Tài liệu nội bộ — Raitek Engineering. Được tạo tự động bởi Hệ thống O&M.",
		gopdf.CellOption{Align: gopdf.Left})

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", `attachment; filename="Export_Project_`+project.Name+`.pdf"`)
	b, err := pdf.GetBytesPdfReturnErr()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}
	_, _ = c.Writer.Write(b)
}

// POST /projects
func (h *ProjectHandlerV2) CreateProject(c *gin.Context) {
	var project domain.Project
	if err := c.ShouldBindJSON(&project); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	project.ID = uuid.New()
	if err := h.projectRepo.Create(&project); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create project"})
		return
	}
	c.JSON(http.StatusCreated, project)
}

// PUT /projects/:id
func (h *ProjectHandlerV2) UpdateProject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	project, err := h.projectRepo.FindByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}
	if err := c.ShouldBindJSON(project); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	project.ID = id
	if err := h.projectRepo.Update(project); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project"})
		return
	}
	c.JSON(http.StatusOK, project)
}

// DELETE /projects/:id
func (h *ProjectHandlerV2) DeleteProject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	if err := h.projectRepo.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete project"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Project deleted"})
}

// ---- Project Trash APIs ----

// GET /projects/history
func (h *ProjectHandlerV2) ListDeletedProjects(c *gin.Context) {
	projects, err := h.projectRepo.FindAllDeleted()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch deleted projects"})
		return
	}
	c.JSON(http.StatusOK, projects)
}

// POST /projects/:id/restore
func (h *ProjectHandlerV2) RestoreProject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	if err := h.projectRepo.Restore(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restore project"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Project restored"})
}

// DELETE /projects/:id/permanent
func (h *ProjectHandlerV2) PermanentDeleteProject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	if err := h.projectRepo.PermanentDelete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to permanently delete project"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Project permanently deleted"})
}

// POST /projects/bulk-restore
func (h *ProjectHandlerV2) BulkRestoreProjects(c *gin.Context) {
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var uuids []uuid.UUID
	for _, s := range body.IDs {
		id, err := uuid.Parse(s)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID: " + s})
			return
		}
		uuids = append(uuids, id)
	}
	if err := h.projectRepo.BulkRestore(uuids); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to bulk restore projects"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Projects restored", "count": len(uuids)})
}

// DELETE /projects/bulk-permanent
func (h *ProjectHandlerV2) BulkPermanentDeleteProjects(c *gin.Context) {
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var uuids []uuid.UUID
	for _, s := range body.IDs {
		id, err := uuid.Parse(s)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID: " + s})
			return
		}
		uuids = append(uuids, id)
	}
	if err := h.projectRepo.BulkPermanentDelete(uuids); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to bulk delete projects"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Projects permanently deleted", "count": len(uuids)})
}

// ---- Owner CRUD ----

// GET /owners
func (h *ProjectHandlerV2) ListOwners(c *gin.Context) {
	owners, err := h.ownerRepo.FindAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch owners"})
		return
	}
	c.JSON(http.StatusOK, owners)
}

// POST /owners
func (h *ProjectHandlerV2) CreateOwner(c *gin.Context) {
	var owner domain.Owner
	if err := c.ShouldBindJSON(&owner); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	owner.ID = uuid.New()
	if err := h.ownerRepo.Create(&owner); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create owner"})
		return
	}
	c.JSON(http.StatusCreated, owner)
}

// DELETE /owners/:id
func (h *ProjectHandlerV2) DeleteOwner(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid owner ID"})
		return
	}
	if err := h.ownerRepo.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete owner"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Owner deleted"})
}

// POST /projects/:id/clone
// Deep-copies a project including all Assets (recursive tree), Configs, and Templates
// inside a single database transaction.
func (h *ProjectHandlerV2) CloneProject(c *gin.Context) {
	oldID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}

	// --- Load original project ---
	var original domain.Project
	if err := h.db.First(&original, "id = ?", oldID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	// --- Begin transaction ---
	tx := h.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 1. Clone Project row
	newProject := domain.Project{
		ID:       uuid.New(),
		Name:     original.Name + " - Copy",
		Location: original.Location,
		OwnerID:  original.OwnerID,
	}
	if err := tx.Create(&newProject).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clone project: " + err.Error()})
		return
	}

	// 2. Load all Assets of the original project
	var allOldAssets []domain.Asset
	if err := tx.Where("id_project = ? AND deleted_at IS NULL", oldID).Find(&allOldAssets).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load assets: " + err.Error()})
		return
	}

	// Map OldAssetID -> NewAssetID (populated during recursive clone)
	assetIDMap := make(map[uuid.UUID]uuid.UUID)
	// Map OldConfigID -> NewConfigID (populated during config copy)
	configIDMap := make(map[uuid.UUID]uuid.UUID)

	// Recursive function to clone an asset and its children
	var cloneAsset func(oldAsset domain.Asset, newParentID *uuid.UUID) error
	cloneAsset = func(oldAsset domain.Asset, newParentID *uuid.UUID) error {
		newAsset := domain.Asset{
			ID:        uuid.New(),
			Name:      oldAsset.Name,
			ProjectID: newProject.ID,
			ParentID:  newParentID,
		}
		if err := tx.Create(&newAsset).Error; err != nil {
			return err
		}
		assetIDMap[oldAsset.ID] = newAsset.ID

		// Clone Configs belonging to this asset
		var oldConfigs []domain.Config
		if err := tx.Where("id_asset = ? AND deleted_at IS NULL", oldAsset.ID).Find(&oldConfigs).Error; err != nil {
			return err
		}
		for _, oldCfg := range oldConfigs {
			newCfg := domain.Config{
				ID:                  uuid.New(),
				AssetID:             newAsset.ID,
				SubWorkID:           oldCfg.SubWorkID,
				StatusSetImageCount: oldCfg.StatusSetImageCount,
				ImageCount:          oldCfg.ImageCount,
				GuideText:           oldCfg.GuideText,
				GuideImages:         oldCfg.GuideImages,
			}
			if err := tx.Create(&newCfg).Error; err != nil {
				return err
			}
			configIDMap[oldCfg.ID] = newCfg.ID
		}

		// Recurse: find children of oldAsset
		for _, child := range allOldAssets {
			if child.ParentID != nil && *child.ParentID == oldAsset.ID {
				if err := cloneAsset(child, &newAsset.ID); err != nil {
					return err
				}
			}
		}
		return nil
	}

	// Start with root assets (no parent)
	for _, a := range allOldAssets {
		if a.ParentID == nil {
			if err := cloneAsset(a, nil); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clone assets: " + err.Error()})
				return
			}
		}
	}

	// 3. Clone Templates with remapped ConfigID arrays
	var oldTemplates []domain.Template
	if err := tx.Where("id_project = ? AND deleted_at IS NULL", oldID).Find(&oldTemplates).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load templates: " + err.Error()})
		return
	}

	for _, oldTpl := range oldTemplates {
		// Parse the old config ID array
		var oldConfigIDs []string
		if err := json.Unmarshal([]byte(oldTpl.ConfigIDs), &oldConfigIDs); err != nil {
			oldConfigIDs = []string{}
		}

		// Remap each old config ID to the new one
		newConfigIDs := make([]string, 0, len(oldConfigIDs))
		for _, cidStr := range oldConfigIDs {
			oldCID, parseErr := uuid.Parse(cidStr)
			if parseErr != nil {
				continue
			}
			if newCID, ok := configIDMap[oldCID]; ok {
				newConfigIDs = append(newConfigIDs, newCID.String())
			}
		}

		remappedJSON, _ := json.Marshal(newConfigIDs)

		newTpl := domain.Template{
			ID:             uuid.New(),
			Name:           oldTpl.Name,
			ProjectID:      newProject.ID,
			ModelProjectID: oldTpl.ModelProjectID,
			ConfigIDs:      datatypes.JSON(remappedJSON),
			// PersonCreatedID intentionally left blank for the cloned template
		}
		if err := tx.Create(&newTpl).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clone templates: " + err.Error()})
			return
		}
	}

	// --- Commit ---
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Transaction commit failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"project_id":   newProject.ID,
		"project_name": newProject.Name,
		"message":      "Nhân bản dự án thành công",
	})
}

// GET /redirect-folder
func (h *ProjectHandlerV2) RedirectFolder(c *gin.Context) {
	prefix := c.Query("prefix")
	filters := c.Query("filters")
	title := c.Query("title")
	titleB64 := c.Query("title_b64")
	if titleB64 != "" {
		if decoded, err := base64.URLEncoding.DecodeString(titleB64); err == nil {
			title = string(decoded)
		}
	}
	if title == "" {
		title = "Thư viện ảnh"
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>%s - Raitek O&M</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #334155; }
        .header { text-align: center; margin-bottom: 24px; padding: 20px; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        h1 { margin: 0 0 8px 0; color: #0f172a; font-size: 1.5rem; }
        p { margin: 0; color: #64748b; }
        h3 { margin-top: 24px; margin-bottom: 12px; color: #475569; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; text-transform: uppercase; font-size: 1rem; letter-spacing: 0.5px; }
        .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .gallery-item { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: transform 0.2s; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; position: relative; cursor: pointer; }
        .gallery-item:hover { transform: scale(1.02); box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .gallery-item img { width: 100%%; height: 100%%; object-fit: cover; }
        .loading { text-align: center; padding: 40px; color: #64748b; font-size: 1.1rem; }
        .error { color: #ef4444; text-align: center; padding: 20px; background: #fef2f2; border-radius: 8px; }
        .modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%%; height: 100%%; background-color: rgba(0,0,0,0.9); }
        .modal-content { margin: auto; display: block; max-width: 90%%; max-height: 90vh; position: absolute; top: 50%%; left: 50%%; transform: translate(-50%%, -50%%); }
        .close { position: absolute; top: 15px; right: 35px; color: #f1f1f1; font-size: 40px; font-weight: bold; cursor: pointer; }
    </style>
</head>
<body>
    <div class="header">
        <h1>%s</h1>
        <p>Danh sách hình ảnh tải lên của thiết bị này</p>
    </div>
    
    <div id="loader" class="loading">Đang lấy dữ liệu ảnh từ Cloud...</div>
    <div id="gallery-container"></div>
    
    <div id="imageModal" class="modal">
        <span class="close" onclick="closeModal()">&times;</span>
        <img class="modal-content" id="modalImg">
    </div>

    <script>
        const prefix = "%s";
        const filters = "%s";
        
        async function fetchImages() {
            try {
                if (!prefix) throw new Error("Không có thông tin đường dẫn thư mục.");
                
                const url = '/api/public/media/library?prefix=' + encodeURIComponent(prefix) + '&filters=' + encodeURIComponent(filters);
                const res = await fetch(url);
                if (!res.ok) throw new Error('Lỗi khi truy xuất dữ liệu từ Cloud (Mã: ' + res.status + ')');
                
                const data = await res.json();
                const urls = data.data || [];
                
                const container = document.getElementById('gallery-container');
                document.getElementById('loader').style.display = 'none';
                
                if (urls.length === 0) {
                    container.innerHTML = '<div class="loading">Không có ảnh nào được lưu trữ cho hạng mục này.</div>';
                    return;
                }
                
                const imageKeys = urls.filter(u => u.match(/\.(jpg|jpeg|png|webp|gif)$/i));
                
                if (imageKeys.length === 0) {
                    container.innerHTML = '<div class="loading">Không tìm thấy định dạng ảnh hợp lệ trong thư mục này.</div>';
                    return;
                }

                // Group images by Process (parent folder name in MinIO)
                const groupedImages = {};
                imageKeys.forEach(key => {
                    const parts = key.split('/');
                    const processName = parts.length >= 2 ? decodeURIComponent(parts[parts.length - 2]) : 'Chung';
                    if (!groupedImages[processName]) groupedImages[processName] = [];
                    groupedImages[processName].push(key);
                });
                
                let html = '';
                Object.keys(groupedImages).sort().forEach(proc => {
                    // Format process name nicely: "1-ve-sinh" -> "1 - Ve sinh"
                    const niceProc = proc.replace(/([0-9]+)-/g, '$1 - ').replace(/-/g, ' ');
                    html += '<h3>Quy trình: ' + niceProc + '</h3>';
                    html += '<div class="gallery">';
                    html += groupedImages[proc].map(key => {
                        const proxyUrl = '/api/media/proxy?key=' + encodeURIComponent(key);
                        return '<div class="gallery-item" onclick="openModal(\'' + proxyUrl + '\')">' +
                               '<img src="' + proxyUrl + '" loading="lazy" alt="Ảnh tải lên">' +
                               '</div>';
                    }).join('');
                    html += '</div>';
                });

                container.innerHTML = html;
                
            } catch (err) {
                document.getElementById('loader').style.display = 'none';
                document.getElementById('gallery-container').innerHTML = '<div class="error">Đã xảy ra lỗi: ' + err.message + '</div>';
            }
        }
        
        function openModal(src) {
            document.getElementById('imageModal').style.display = "block";
            document.getElementById('modalImg').src = src;
        }
        
        function closeModal() {
            document.getElementById('imageModal').style.display = "none";
        }
        
        document.addEventListener('keydown', function(event) {
            if (event.key === "Escape") closeModal();
        });

        window.onload = fetchImages;
    </script>
</body>
</html>`, title, title, prefix, filters)

	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(html))
}
