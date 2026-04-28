package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"github.com/signintech/gopdf"
)

// ReportPDFService generates a PDF from a Report + DetailAssign data and uploads to MinIO.
// It mirrors the layout of PublicBulkReportPage on the frontend.
type ReportPDFService struct {
	assignRepo      domain.AssignRepository
	detailRepo      domain.DetailAssignRepository
	reportRepo      domain.ReportRepository
	mediaService    *AllocationMediaService
}

func NewReportPDFService(
	assignRepo domain.AssignRepository,
	detailRepo domain.DetailAssignRepository,
	reportRepo domain.ReportRepository,
	mediaService *AllocationMediaService,
) *ReportPDFService {
	return &ReportPDFService{
		assignRepo:   assignRepo,
		detailRepo:   detailRepo,
		reportRepo:   reportRepo,
		mediaService: mediaService,
	}
}

// GenerateAndUploadAsync runs the full PDF pipeline in a goroutine (fire-and-forget).
// Errors are logged but never returned (caller is not blocked).
func (s *ReportPDFService) GenerateAndUploadAsync(reportID uuid.UUID) {
	go func() {
		if err := s.generateAndUpload(reportID); err != nil {
			fmt.Printf("[ReportPDF] ERROR generating PDF for report %s: %v\n", reportID, err)
		}
	}()
}

// generateAndUpload is the core synchronous pipeline. Called inside a goroutine.
func (s *ReportPDFService) generateAndUpload(reportID uuid.UUID) error {
	// 1. Fetch report metadata
	report, err := s.reportRepo.FindByID(reportID)
	if err != nil {
		return fmt.Errorf("report not found: %w", err)
	}

	// 2. Fetch the parent assign (to get project name, template name, users)
	assign, err := s.assignRepo.FindByID(report.AssignID)
	if err != nil {
		return fmt.Errorf("assign not found: %w", err)
	}

	// 3. Fetch all detail assigns for this report's assign
	details, err := s.detailRepo.FindByAssignID(report.AssignID)
	if err != nil {
		return fmt.Errorf("failed to fetch details: %w", err)
	}

	// 4. Parse item_keys filter from report
	var itemKeys []string
	if report.ItemKeys != nil {
		raw := []byte(report.ItemKeys)
		_ = json.Unmarshal(raw, &itemKeys)
	}
	isAllItems := len(itemKeys) == 0 || (len(itemKeys) == 1 && itemKeys[0] == "all")
	allowedSet := map[string]bool{}
	if !isAllItems {
		for _, k := range itemKeys {
			allowedSet[k] = true
		}
	}

	isReject := report.Type == "reject"

	// 5. Filter details by item_keys and status
	var tasks []taskEntryForPDF

	for _, d := range details {
		if d.Config == nil {
			continue
		}
		// Apply item_keys filter
		if !isAllItems {
			key := ""
			if d.Config.AssetID != uuid.Nil && d.Config.SubWorkID != uuid.Nil {
				key = d.Config.AssetID.String() + "_" + d.Config.SubWorkID.String()
			}
			if !allowedSet[key] {
				continue
			}
		}
		// Apply status filter
		if isReject {
			if d.StatusApprove != -1 && d.StatusReject != 1 {
				continue
			}
		} else {
			if d.StatusApprove != 1 {
				continue
			}
		}

		// Parse image URLs from data field
		var imgURLs []string
		if d.Data != nil {
			raw := []byte(d.Data)
			var arr []string
			if err := json.Unmarshal(raw, &arr); err == nil {
				imgURLs = arr
			}
		}

		assetName := "—"
		if d.Config.Asset != nil {
			if d.Config.Asset.Parent != nil {
				assetName = d.Config.Asset.Parent.Name + " - " + d.Config.Asset.Name
			} else {
				assetName = d.Config.Asset.Name
			}
		}

		subWorkName := "—"
		workName := "—"
		if d.Config.SubWork != nil {
			subWorkName = d.Config.SubWork.Name
			if d.Config.SubWork.Work != nil {
				workName = d.Config.SubWork.Work.Name
			}
		}

		processName := "Khác"
		if d.Process != nil {
			processName = d.Process.Name
		}

		approvedAt := ""
		if isReject {
			approvedAt = parseJSONBLastTimestamp(d.RejectedAt)
		} else {
			approvedAt = parseJSONBLastTimestamp(d.ApprovalAt)
		}

		tasks = append(tasks, taskEntryForPDF{
			assetName:   assetName,
			subWorkName: subWorkName,
			workName:    workName,
			processName: processName,
			noteData:    d.NoteData,
			imageURLs:   imgURLs,
			approvedAt:  approvedAt,
		})
	}

	if len(tasks) == 0 {
		return fmt.Errorf("no matching tasks for PDF generation (report %s)", reportID)
	}

	projectName := "—"
	templateName := ""
	if assign.Project != nil {
		projectName = assign.Project.Name
	}
	if assign.Template != nil {
		templateName = assign.Template.Name
	}

	// 6. Build PDF
	pdfBytes, err := s.buildReportPDF(report, projectName, templateName, tasks, isReject)
	if err != nil {
		return fmt.Errorf("failed to build PDF: %w", err)
	}


	// 7. Upload to MinIO
	safeTitle := sanitizeFilename(report.Title)
	// Định dạng tên file: <Title>_NG28-04-2026-TG15-30.pdf
	filename := fmt.Sprintf("%s_NG%s.pdf", safeTitle, time.Now().Format("02-01-2006-TG15-04"))
	_, err = s.mediaService.UploadReportPDF(projectName, pdfBytes, filename)
	if err != nil {
		return fmt.Errorf("failed to upload PDF to MinIO: %w", err)
	}

	fmt.Printf("[ReportPDF] Successfully generated and uploaded PDF for report %s\n", reportID)
	return nil
}

// ─── PDF Builder ─────────────────────────────────────────────────────────────

type taskEntryForPDF struct {
	assetName   string
	subWorkName string
	workName    string
	processName string
	noteData    string
	imageURLs   []string
	approvedAt  string
}

func (s *ReportPDFService) buildReportPDF(report *domain.Report, projectName, templateName string, tasks []taskEntryForPDF, isReject bool) ([]byte, error) {
	pdf := gopdf.GoPdf{}
	pdf.Start(gopdf.Config{PageSize: *gopdf.PageSizeA4})

	// Load fonts
	if err := pdf.AddTTFFont("rg", "assets/fonts/Roboto-Regular.ttf"); err != nil {
		return nil, fmt.Errorf("font rg: %w", err)
	}
	if err := pdf.AddTTFFont("bd", "assets/fonts/Roboto-Bold.ttf"); err != nil {
		return nil, fmt.Errorf("font bd: %w", err)
	}
	if err := pdf.AddTTFFont("it", "assets/fonts/Roboto-Italic.ttf"); err != nil {
		return nil, fmt.Errorf("font it: %w", err)
	}

	// ── Page constants ──────────────────────────────────────────────────────
	const (
		pW  = 595.28 // A4 width in pts
		pH  = 841.89 // A4 height in pts
		mL  = 36.0   // left margin
		mR  = 36.0   // right margin
		mT  = 36.0   // top margin
		mB  = 36.0   // bottom margin
		cW  = pW - mL - mR // content width
	)

	// ── Color palette ───────────────────────────────────────────────────────
	var (
		cPrimary  = [3]uint8{79, 70, 229}   // indigo-600
		cDanger   = [3]uint8{220, 38, 38}   // rose-600
		cTitle    = [3]uint8{15, 23, 42}    // slate-900
		cSubtitle = [3]uint8{99, 102, 241}  // indigo-400
		cText     = [3]uint8{51, 65, 85}    // slate-700
		cMuted    = [3]uint8{148, 163, 184} // slate-400
		cOrange   = [3]uint8{194, 65, 12}   // orange-700 for work names
		cBg       = [3]uint8{248, 250, 252} // slate-50
		cBorder   = [3]uint8{226, 232, 240} // slate-200
	)
	accentColor := cPrimary
	if isReject {
		accentColor = cDanger
	}

	// Helper: set fill color
	setFill := func(col [3]uint8) {
		pdf.SetFillColor(col[0], col[1], col[2])
	}
	setTxt := func(col [3]uint8) {
		pdf.SetTextColor(col[0], col[1], col[2])
	}
	setStroke := func(col [3]uint8) {
		pdf.SetStrokeColor(col[0], col[1], col[2])
	}

	// Helper: draw filled rect
	fillRect := func(x, y, w, h float64, col [3]uint8) {
		setFill(col)
		pdf.Rectangle(x, y, x+w, y+h, "F", 0, 0)
	}
	// Helper: draw border rect
	borderRect := func(x, y, w, h float64, col [3]uint8) {
		setStroke(col)
		pdf.SetLineWidth(0.5)
		pdf.Rectangle(x, y, x+w, y+h, "D", 0, 0)
	}

	// Helper: write text cell with wrapping, returns new Y
	writeText := func(x, y, maxW, lineH float64, text, font string, size float64, col [3]uint8) float64 {
		_ = pdf.SetFont(font, "", size)
		setTxt(col)
		lines, _ := pdf.SplitText(text, maxW)
		for _, l := range lines {
			pdf.SetX(x)
			pdf.SetY(y)
			_ = pdf.CellWithOption(&gopdf.Rect{W: maxW, H: lineH}, l, gopdf.CellOption{Align: gopdf.Left})
			y += lineH
		}
		return y
	}

	// Helper: check page overflow & add new page
	curY := mT
	newPageIfNeeded := func(neededH float64) {
		if curY+neededH > pH-mB {
			pdf.AddPage()
			curY = mT
		}
	}

	// ── PAGE 1: COVER ───────────────────────────────────────────────────────
	pdf.AddPage()

	// Header bar
	fillRect(0, 0, pW, 8, accentColor)

	// Title
	curY = mT + 20
	_ = pdf.SetFont("bd", "", 22)
	setTxt(cTitle)
	titleText := "BIÊN BẢN NGHIỆM THU CÔNG VIỆC"
	if isReject {
		titleText = "BÁO CÁO YÊU CẦU SỬA CHỮA"
	}
	tw, _ := pdf.MeasureTextWidth(titleText)
	pdf.SetX((pW - tw) / 2)
	pdf.SetY(curY)
	_ = pdf.Cell(nil, titleText)
	curY += 30

	// Project name & template
	_ = pdf.SetFont("bd", "", 14)
	setTxt(accentColor)
	if isReject {
		setTxt(cDanger)
	} else {
		setTxt(cSubtitle)
	}
	tpl := templateName
	if tpl == "" {
		tpl = projectName
	}
	tpw, _ := pdf.MeasureTextWidth(tpl)
	pdf.SetX((pW - tpw) / 2)
	pdf.SetY(curY)
	_ = pdf.Cell(nil, tpl)
	curY += 20

	_ = pdf.SetFont("rg", "", 10)
	setTxt(cMuted)
	infoLine := fmt.Sprintf("Dự án: %s  |  Ngày xuất: %s  |  Tổng hạng mục: %d", projectName, time.Now().Format("02/01/2006"), len(tasks))
	iw, _ := pdf.MeasureTextWidth(infoLine)
	pdf.SetX((pW - iw) / 2)
	pdf.SetY(curY)
	_ = pdf.Cell(nil, infoLine)
	curY += 10

	// Divider
	setStroke(cBorder)
	pdf.SetLineWidth(0.5)
	pdf.Line(mL, curY, pW-mR, curY)
	curY += 16

	// Conclusion block
	if report.Conclusion != "" {
		newPageIfNeeded(60)
		fillRect(mL, curY, cW, 6, accentColor)
		curY += 6
		fillRect(mL, curY, cW, 2, cBg)
		// Label
		curY += 8
		_ = pdf.SetFont("bd", "", 9)
		setTxt(cMuted)
		pdf.SetX(mL + 4)
		pdf.SetY(curY)
		_ = pdf.Cell(nil, "Ý KIẾN / ĐÁNH GIÁ CHUNG CỦA QUẢN LÝ")
		curY += 14
		// Text
		curY = writeText(mL+4, curY, cW-8, 14, report.Conclusion, "rg", 10, cText)
		curY += 14
		borderRect(mL, curY-14, cW, 1, cBorder)
		curY += 8
	}

	// ── TASKS ────────────────────────────────────────────────────────────────
	// Track current work + subwork for grouping headers
	lastWork := ""
	lastSubWork := ""

	// Get MinIO client once
	mc, mcErr := s.mediaService.getMinioClient()

	for i, task := range tasks {
		// Work Name header
		if task.workName != lastWork {
			newPageIfNeeded(26)
			fillRect(mL, curY, cW, 22, [3]uint8{255, 247, 237}) // orange-50
			_ = pdf.SetFont("bd", "", 10)
			setTxt(cOrange)
			pdf.SetX(mL + 8)
			pdf.SetY(curY + 6)
			_ = pdf.Cell(nil, "📋 "+task.workName)
			curY += 22
			lastWork = task.workName
			lastSubWork = "" // Reset subwork on new work
		}

		// SubWork Name header
		if task.subWorkName != lastSubWork {
			newPageIfNeeded(20)
			// Divider line with label
			setStroke(cBorder)
			pdf.SetLineWidth(0.5)
			pdf.Line(mL, curY+10, mL+20, curY+10)
			pdf.Line(mL+20+float64(len(task.subWorkName))*6+10, curY+10, pW-mR, curY+10)
			_ = pdf.SetFont("bd", "", 9)
			setTxt([3]uint8{99, 102, 241}) // indigo-500
			pdf.SetX(mL + 24)
			pdf.SetY(curY + 4)
			_ = pdf.Cell(nil, task.subWorkName)
			curY += 20
			lastSubWork = task.subWorkName
		}

		// ── Asset Card ─────────────────────────────────────────────────────
		newPageIfNeeded(50)
		cardY := curY

		// Card header bg
		headerBgCol := [3]uint8{238, 242, 255} // indigo-50
		if isReject {
			headerBgCol = [3]uint8{255, 241, 242} // rose-50
		}
		fillRect(mL, cardY, cW, 24, headerBgCol)
		borderRect(mL, cardY, cW, 24, cBorder)

		// Asset dot (dùng ô vuông nhỏ thay circle vì gopdf không có Circle)
		setFill(accentColor)
		pdf.Rectangle(mL+9, cardY+9, mL+15, cardY+15, "F", 0, 0)

		// Asset name
		_ = pdf.SetFont("bd", "", 11)
		setTxt(cTitle)
		pdf.SetX(mL + 22)
		pdf.SetY(cardY + 7)
		_ = pdf.CellWithOption(&gopdf.Rect{W: cW - 100, H: 14}, task.assetName, gopdf.CellOption{Align: gopdf.Left})

		// Approved timestamp (right aligned)
		if task.approvedAt != "" {
			_ = pdf.SetFont("rg", "", 8)
			label := "Hoàn tất duyệt"
			if isReject {
				label = "Bị từ chối lúc"
				setTxt(cDanger)
			} else {
				setTxt([3]uint8{5, 150, 105}) // emerald-600
			}
			timeW := 110.0
			pdf.SetX(pW - mR - timeW)
			pdf.SetY(cardY + 4)
			_ = pdf.CellWithOption(&gopdf.Rect{W: timeW, H: 10}, label, gopdf.CellOption{Align: gopdf.Right})
			pdf.SetX(pW - mR - timeW)
			pdf.SetY(cardY + 14)
			_ = pdf.CellWithOption(&gopdf.Rect{W: timeW, H: 10}, task.approvedAt, gopdf.CellOption{Align: gopdf.Right})
		}

		curY = cardY + 24

		// Process row
		_ = pdf.SetFont("rg", "", 8)
		setTxt(cMuted)
		pdf.SetX(mL + 8)
		pdf.SetY(curY + 4)
		_ = pdf.Cell(nil, "Quy trình: "+task.processName)
		curY += 14

		// Note
		if task.noteData != "" {
			newPageIfNeeded(30)
			fillRect(mL+4, curY, cW-8, 18, [3]uint8{255, 251, 235}) // amber-50
			_ = pdf.SetFont("it", "", 9)
			setTxt(cText)
			pdf.SetX(mL + 10)
			pdf.SetY(curY + 5)
			_ = pdf.CellWithOption(&gopdf.Rect{W: cW - 20, H: 14}, "📝 "+task.noteData, gopdf.CellOption{Align: gopdf.Left})
			curY += 22
		}

		// ── Images ───────────────────────────────────────────────────────────
		if len(task.imageURLs) > 0 && mcErr == nil && mc != nil {
			// Layout: up to 3 images per row, each 160x120 pt
			const imgW = 160.0
			const imgH = 120.0
			const imgGap = 6.0
			const imgsPerRow = 3

			row := 0
			col := 0

			for _, rawURL := range task.imageURLs {
				if rawURL == "" {
					continue
				}

				// Extract MinIO object key from URL
				objKey := extractMinioKey(rawURL, mc.Bucket)
				if objKey == "" {
					continue
				}

				// New row needed?
				if col == 0 {
					newPageIfNeeded(imgH + imgGap + 8)
				}

				imgX := mL + float64(col)*(imgW+imgGap)
				imgY := curY

				// Try to fetch image bytes from MinIO
				imgBytes, err := mc.GetObject(objKey)
				if err != nil {
					col++
					if col >= imgsPerRow {
						col = 0
						curY += imgH + imgGap
						row++
					}
					continue
				}

				// Try to determine image format
				imgReader := bytes.NewReader(imgBytes)
				_, imgFormat, err := image.DecodeConfig(imgReader)
				if err != nil {
					col++
					if col >= imgsPerRow {
						col = 0
						curY += imgH + imgGap
						row++
					}
					continue
				}

				// Add image to pdf
				var holder gopdf.ImageHolder
				imgReader2 := bytes.NewReader(imgBytes)
				holder, err = gopdf.ImageHolderByReader(imgReader2)
				_ = imgFormat // format already detected above
				if err != nil || holder == nil {
					col++
					if col >= imgsPerRow {
						col = 0
						curY += imgH + imgGap
						row++
					}
					continue
				}

				_ = pdf.ImageByHolder(holder, imgX, imgY, &gopdf.Rect{W: imgW, H: imgH})
				// Border around image
				borderRect(imgX, imgY, imgW, imgH, cBorder)

				col++
				if col >= imgsPerRow {
					col = 0
					curY += imgH + imgGap
					row++
				}
			}

			// If last row was partial, advance curY
			if col > 0 {
				curY += imgH + imgGap
				_ = row
			}
		}

		curY += 12

		// Separator between tasks (not last)
		if i < len(tasks)-1 {
			newPageIfNeeded(8)
			setStroke(cBg)
			pdf.SetLineWidth(1)
			pdf.Line(mL, curY, pW-mR, curY)
			curY += 8
		}
	}

	// ── SIGNATURE BLOCK ──────────────────────────────────────────────────────
	newPageIfNeeded(100)
	curY += 30
	setStroke(cBorder)
	pdf.SetLineWidth(0.5)
	pdf.Line(mL, curY, pW-mR, curY)
	curY += 20

	halfW := (cW - 20) / 2

	_ = pdf.SetFont("bd", "", 10)
	setTxt(cTitle)
	pdf.SetX(mL)
	pdf.SetY(curY)
	_ = pdf.CellWithOption(&gopdf.Rect{W: halfW, H: 14}, "KỸ SƯ THỰC HIỆN", gopdf.CellOption{Align: gopdf.Center})
	pdf.SetX(mL + halfW + 20)
	pdf.SetY(curY)
	_ = pdf.CellWithOption(&gopdf.Rect{W: halfW, H: 14}, "QUẢN LÝ DỰ ÁN", gopdf.CellOption{Align: gopdf.Center})
	curY += 16

	_ = pdf.SetFont("it", "", 9)
	setTxt(cMuted)
	pdf.SetX(mL)
	pdf.SetY(curY)
	_ = pdf.CellWithOption(&gopdf.Rect{W: halfW, H: 12}, "(Ký, ghi rõ họ tên)", gopdf.CellOption{Align: gopdf.Center})
	pdf.SetX(mL + halfW + 20)
	pdf.SetY(curY)
	_ = pdf.CellWithOption(&gopdf.Rect{W: halfW, H: 12}, "(Ký, ghi rõ họ tên)", gopdf.CellOption{Align: gopdf.Center})

	// Footer bar
	fillRect(0, pH-6, pW, 6, accentColor)

	// Export to bytes
	var buf bytes.Buffer
	if err := pdf.Write(&buf); err != nil {
		return nil, fmt.Errorf("gopdf write error: %w", err)
	}
	return buf.Bytes(), nil
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// parseJSONBLastTimestamp parses JSONB timestamp arrays like ["2024-01-01T10:00:00Z"]
// and returns the last (most recent) entry formatted as Vietnamese time.
func parseJSONBLastTimestamp(data interface{}) string {
	if data == nil {
		return ""
	}

	var raw []byte
	switch v := data.(type) {
	case []byte:
		raw = v
	case string:
		raw = []byte(v)
	default:
		b, err := json.Marshal(v)
		if err != nil {
			return ""
		}
		raw = b
	}

	var arr []string
	if err := json.Unmarshal(raw, &arr); err != nil || len(arr) == 0 {
		return ""
	}
	last := arr[len(arr)-1]
	t, err := time.Parse(time.RFC3339, last)
	if err != nil {
		return last
	}
	// Vietnamese locale: format as DD/MM/YYYY HH:mm
	loc, _ := time.LoadLocation("Asia/Ho_Chi_Minh")
	return t.In(loc).Format("02/01/2006 15:04")
}

// extractMinioKey extracts the MinIO object key from a full URL.
// E.g.: "http://minio:2603/dev/projA/2024/.../img.jpg" → "projA/2024/.../img.jpg"
func extractMinioKey(rawURL, bucket string) string {
	// Strip query params (presigned URLs have them)
	if idx := strings.Index(rawURL, "?"); idx != -1 {
		rawURL = rawURL[:idx]
	}
	marker := "/" + bucket + "/"
	idx := strings.Index(rawURL, marker)
	if idx == -1 {
		return ""
	}
	return rawURL[idx+len(marker):]
}

// sanitizeFilename makes a string safe for use as a filename.
func sanitizeFilename(s string) string {
	replacer := strings.NewReplacer(
		"/", "-", "\\", "-", ":", "-", "*", "-",
		"?", "-", "\"", "", "<", "", ">", "", "|", "-",
		" ", "_",
	)
	return replacer.Replace(s)
}


