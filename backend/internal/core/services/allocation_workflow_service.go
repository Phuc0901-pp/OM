package services

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	"github.com/phuc/cmms-backend/internal/config"
)

// BroadcastFunc is a function that broadcasts a WebSocket event to all clients.
// Using a func type avoids the import cycle between services ↔ websocket packages.
type BroadcastFunc func(msg []byte)

// AllocationWorkflowService handles the business logic for task status transitions:
// Approve, Reject, Bulk update, and Submit. Also handles Lark sync triggers.
// Extracted from the monolithic allocation_handler.go.
type AllocationWorkflowService struct {
	db               *gorm.DB
	detailAssignRepo domain.DetailAssignRepository
	larkSvc          *LarkService
	broadcast        BroadcastFunc
	cfg              config.Config
}

func NewAllocationWorkflowService(
	db *gorm.DB,
	detailAssignRepo domain.DetailAssignRepository,
	larkSvc *LarkService,
	broadcastFn BroadcastFunc,
	cfg config.Config,
) *AllocationWorkflowService {
	return &AllocationWorkflowService{
		db:               db,
		detailAssignRepo: detailAssignRepo,
		larkSvc:          larkSvc,
		broadcast:        broadcastFn,
		cfg:              cfg,
	}
}

// broadcastEvent pushes a task_updated WebSocket event to all connected clients.
func (s *AllocationWorkflowService) broadcastEvent() {
	if s.broadcast != nil {
		s.broadcast([]byte(`{"event":"task_updated"}`))
	}
}

// ApproveDetail approves a single detail task. Returns the updated detail.
func (s *AllocationWorkflowService) ApproveDetail(
	detailID uuid.UUID,
	noteApproval string,
	actorID string,
	frontendURL string,
) (*domain.DetailAssign, error) {
	detail, err := s.detailAssignRepo.FindByID(detailID)
	if err != nil {
		return nil, fmt.Errorf("detail not found: %w", err)
	}

	detail.StatusApprove = 1
	detail.StatusReject = 0
	detail.NoteApproval = noteApproval

	// Append timestamp
	var timestamps []time.Time
	_ = json.Unmarshal(detail.ApprovalAt, &timestamps)
	timestamps = append(timestamps, time.Now())
	tsJSON, _ := json.Marshal(timestamps)
	detail.ApprovalAt = datatypes.JSON(tsJSON)

	// Track actor
	if actorID != "" {
		var personIDs []string
		_ = json.Unmarshal(detail.IdPersonApprove, &personIDs)
		personIDs = append(personIDs, actorID)
		pJSON, _ := json.Marshal(personIDs)
		detail.IdPersonApprove = datatypes.JSON(pJSON)
	}

	if err := s.detailAssignRepo.Update(detail); err != nil {
		return nil, fmt.Errorf("failed to approve: %w", err)
	}

	s.broadcastEvent()

	// Async: Lark sync
	if s.larkSvc != nil {
		detailCopy := *detail
		go s.postApproveAsync(detailCopy, actorID, frontendURL)
	}

	return detail, nil
}

// postApproveAsync syncs completed task to Lark after approval.
func (s *AllocationWorkflowService) postApproveAsync(detail domain.DetailAssign, actorID string, frontendURL string) {
	var assign domain.Assign
	if err := s.db.First(&assign, "id = ?", detail.AssignID).Error; err != nil {
		return
	}
	var userIDs []string
	_ = json.Unmarshal(assign.UserIDs, &userIDs)

	ctxNames, err := s.detailAssignRepo.GetNamesForMinioPath(detail.ID)
	if err != nil {
		return
	}

	// Lark sync
	if frontendURL != "" && s.larkSvc != nil {
		syncCompletedTaskToLark(s.db, s.larkSvc, s.detailAssignRepo, s.cfg, detail, assign, userIDs, actorID, frontendURL, ctxNames)
	}
}

// RejectDetail rejects a single detail task. Returns the updated detail.
func (s *AllocationWorkflowService) RejectDetail(
	detailID uuid.UUID,
	noteReject string,
	actorID string,
	frontendURL string,
) (*domain.DetailAssign, error) {
	detail, err := s.detailAssignRepo.FindByID(detailID)
	if err != nil {
		return nil, fmt.Errorf("detail not found: %w", err)
	}

	detail.StatusReject = 1
	detail.StatusApprove = 0
	detail.StatusSubmit = 0
	detail.NoteReject = noteReject

	var timestamps []time.Time
	_ = json.Unmarshal(detail.RejectedAt, &timestamps)
	timestamps = append(timestamps, time.Now())
	tsJSON, _ := json.Marshal(timestamps)
	detail.RejectedAt = datatypes.JSON(tsJSON)

	// Track actor
	if actorID != "" {
		var personIDs []string
		_ = json.Unmarshal(detail.IdPersonReject, &personIDs)
		personIDs = append(personIDs, actorID)
		pJSON, _ := json.Marshal(personIDs)
		detail.IdPersonReject = datatypes.JSON(pJSON)
	}

	if err := s.detailAssignRepo.Update(detail); err != nil {
		return nil, fmt.Errorf("failed to reject: %w", err)
	}

	s.broadcastEvent()

	if s.larkSvc != nil {
		detailCopy := *detail
		go s.postRejectAsync(detailCopy, actorID, frontendURL)
	}

	return detail, nil
}

// postRejectAsync syncs rejected task to Lark.
func (s *AllocationWorkflowService) postRejectAsync(detail domain.DetailAssign, actorID string, frontendURL string) {
	var assign domain.Assign
	if err := s.db.First(&assign, "id = ?", detail.AssignID).Error; err != nil {
		return
	}
	var userIDs []string
	_ = json.Unmarshal(assign.UserIDs, &userIDs)

	ctxNames, err := s.detailAssignRepo.GetNamesForMinioPath(detail.ID)
	if err != nil {
		return
	}

	// Lark sync for rejected tasks
	if frontendURL != "" && s.larkSvc != nil {
		syncRejectedTaskToLark(s.db, s.larkSvc, s.cfg, detail, assign, userIDs, actorID, frontendURL, ctxNames)
	}
}

// BulkUpdateResult holds the result of a bulk status update operation.
type BulkUpdateResult struct {
	SuccessCount   int
	TotalRequested int
}

// BulkUpdateStatus applies approve (1), reject (-1), or reset (0) to a list of task IDs.
func (s *AllocationWorkflowService) BulkUpdateStatus(
	ids []string,
	accept int,
	note string,
	actorID string,
	frontendURL string,
) BulkUpdateResult {
	result := BulkUpdateResult{TotalRequested: len(ids)}

	for _, idStr := range ids {
		id, err := uuid.Parse(idStr)
		if err != nil {
			continue
		}
		detail, err := s.detailAssignRepo.FindByID(id)
		if err != nil {
			continue
		}

		switch accept {
		case 1:
			detail.StatusApprove = 1
			detail.StatusReject = 0
			detail.NoteApproval = note

			var timestamps []time.Time
			_ = json.Unmarshal(detail.ApprovalAt, &timestamps)
			timestamps = append(timestamps, time.Now())
			tsJSON, _ := json.Marshal(timestamps)
			detail.ApprovalAt = datatypes.JSON(tsJSON)

			if actorID != "" {
				var personIDs []string
				_ = json.Unmarshal(detail.IdPersonApprove, &personIDs)
				personIDs = append(personIDs, actorID)
				pJSON, _ := json.Marshal(personIDs)
				detail.IdPersonApprove = datatypes.JSON(pJSON)
			}

			// Async Lark sync per task
			if frontendURL != "" && s.larkSvc != nil {
				detailCopy := *detail
				go func(d domain.DetailAssign) {
					var assign domain.Assign
					if err := s.db.First(&assign, "id = ?", d.AssignID).Error; err != nil {
						return
					}
					var userIDs []string
					_ = json.Unmarshal(assign.UserIDs, &userIDs)
					ctxNames, err := s.detailAssignRepo.GetNamesForMinioPath(d.ID)
					if err != nil {
						return
					}
					syncCompletedTaskToLark(s.db, s.larkSvc, s.detailAssignRepo, s.cfg, d, assign, userIDs, actorID, frontendURL, ctxNames)
				}(detailCopy)
			}

		case -1:
			detail.StatusReject = 1
			detail.StatusApprove = 0
			detail.StatusSubmit = 0
			detail.NoteReject = note

			var timestamps []time.Time
			_ = json.Unmarshal(detail.RejectedAt, &timestamps)
			timestamps = append(timestamps, time.Now())
			tsJSON, _ := json.Marshal(timestamps)
			detail.RejectedAt = datatypes.JSON(tsJSON)

			if actorID != "" {
				var personIDs []string
				_ = json.Unmarshal(detail.IdPersonReject, &personIDs)
				personIDs = append(personIDs, actorID)
				pJSON, _ := json.Marshal(personIDs)
				detail.IdPersonReject = datatypes.JSON(pJSON)
			}

			// Async Lark sync per task for rejection
			if frontendURL != "" && s.larkSvc != nil {
				detailCopy := *detail
				go func(d domain.DetailAssign) {
					var assign domain.Assign
					if err := s.db.First(&assign, "id = ?", d.AssignID).Error; err != nil {
						return
					}
					var userIDs []string
					_ = json.Unmarshal(assign.UserIDs, &userIDs)
					ctxNames, err := s.detailAssignRepo.GetNamesForMinioPath(d.ID)
					if err != nil {
						return
					}
					syncRejectedTaskToLark(s.db, s.larkSvc, s.cfg, d, assign, userIDs, actorID, frontendURL, ctxNames)
				}(detailCopy)
			}

		case 0:
			detail.StatusReject = 0
			detail.StatusApprove = 0
			detail.StatusSubmit = 0
		}

		if err := s.detailAssignRepo.Update(detail); err == nil {
			result.SuccessCount++
		}
	}

	if result.SuccessCount > 0 {
		s.broadcastEvent()
	}

	return result
}



// PostSubmitAsync wraps all post-submit side-effects (Lark sync)
// into a single non-blocking goroutine, called from the SubmitDetail API handler.
func (s *AllocationWorkflowService) PostSubmitAsync(detailID uuid.UUID, submitterName string, frontendURL string) {
	go func() {
		// 1. Resolve context names
		ctxNames, err := s.detailAssignRepo.GetNamesForMinioPath(detailID)
		if err != nil {
			return
		}

		// 2. Fetch full detail
		detail, err := s.detailAssignRepo.FindByID(detailID)
		if err != nil {
			return
		}



		// 4. Lark sync — push mini-report row to "RAITEK | NỘP DỮ LIỆU" table
		if frontendURL != "" && s.larkSvc != nil {
			var assign domain.Assign
			if err := s.db.First(&assign, "id = ?", detail.AssignID).Error; err != nil {
				return
			}
			var userIDs []string
			_ = json.Unmarshal(assign.UserIDs, &userIDs)
			syncSubmittedTaskToLark(s.db, s.larkSvc, s.cfg, *detail, assign, userIDs, submitterName, frontendURL, ctxNames)
		}
	}()
}

// syncSubmittedTaskToLark pushes a newly-submitted task record to the
// "RAITEK | NỘP DỮ LIỆU" Bitable table using a public, no-login report link.
func syncSubmittedTaskToLark(
	db *gorm.DB,
	larkSvc *LarkService,
	cfg config.Config,
	detail domain.DetailAssign,
	assign domain.Assign,
	userIDs []string,
	submitterName string,
	frontendURL string,
	ctxNames *domain.MinioPathContext,
) {
	submitAppToken := cfg.Lark.SubmitAppToken
	submitTableID := cfg.Lark.SubmitTableID

	if submitAppToken == "" || submitTableID == "" {
		fmt.Println("[LarkSync/Submit] Skipped: Missing SUBMIT_APP_TOKEN or SUBMIT_TABLE_ID in config")
		return
	}

	// Build public no-login report link: /share/report/{assignID}?sub={subWorkID}&asset={assetID}&type=submit
	reportLink := fmt.Sprintf("%s/share/report/%s", frontendURL, assign.ID.String())
	queryParts := []string{}
	if detail.Config != nil {
		queryParts = append(queryParts, "asset="+detail.Config.AssetID.String())
		queryParts = append(queryParts, "sub="+detail.Config.SubWorkID.String())
	}
	queryParts = append(queryParts, "type=submit")
	if len(queryParts) > 0 {
		reportLink += "?" + strings.Join(queryParts, "&")
	}

	// Parse submitted_at timestamp
	submittedAt := ""
	var subTimes []time.Time
	if err := json.Unmarshal(detail.SubmittedAt, &subTimes); err == nil && len(subTimes) > 0 {
		submittedAt = subTimes[len(subTimes)-1].Format("02/01/2006 15:04:05")
	}

	// Resolve assignees
	var assignees []domain.User
	for _, uidStr := range userIDs {
		uid, err := uuid.Parse(uidStr)
		if err != nil {
			continue
		}
		var u domain.User
		if err := db.First(&u, "id = ?", uid).Error; err == nil {
			assignees = append(assignees, u)
		}
	}

	// Use submitterName as fallback when no assignees resolved from DB
	if len(assignees) == 0 {
		fields := map[string]interface{}{
			"Assign ID":                   assign.ID.String(),
			"Họ và tên nhân sự phụ trách": submitterName,
			"Work":                        ctxNames.WorkName,
			"Sub - work":                  ctxNames.SubWorkName,
			"Asset":                       ctxNames.AssetName,
			"Process":                     ctxNames.ProcessName,
		}
		if reportLink != "" {
			fields["Đường dẫn"] = map[string]string{
				"link": reportLink,
				"text": "Xem Báo Cáo",
			}
		}
		if submittedAt != "" {
			fields["Thời gian Nhân sự nộp"] = submittedAt
		}
		if err := larkSvc.PushReportToBitable(submitAppToken, submitTableID, fields); err != nil {
			fmt.Printf("[LarkSync/Submit] Failed for %s: %v\n", submitterName, err)
		}
		return
	}

	for _, assignee := range assignees {
		fields := map[string]interface{}{
			"Assign ID":                   assign.ID.String(),
			"Họ và tên nhân sự phụ trách": assignee.Name,
			"Work":                        ctxNames.WorkName,
			"Sub - work":                  ctxNames.SubWorkName,
			"Asset":                       ctxNames.AssetName,
			"Process":                     ctxNames.ProcessName,
		}
		if reportLink != "" {
			fields["Đường dẫn"] = map[string]string{
				"link": reportLink,
				"text": "Xem Báo Cáo",
			}
		}
		if submittedAt != "" {
			fields["Thời gian Nhân sự nộp"] = submittedAt
		}
		if err := larkSvc.PushReportToBitable(submitAppToken, submitTableID, fields); err != nil {
			fmt.Printf("[LarkSync/Submit] Failed for %s: %v\n", assignee.Name, err)
		}
	}
}


// syncCompletedTaskToLark is a package-level helper shared by workflow methods.
// It mirrors the unexported function formerly in allocation_handler.go.
func syncCompletedTaskToLark(
	db *gorm.DB,
	larkSvc *LarkService,
	detailAssignRepo domain.DetailAssignRepository,
	cfg config.Config,
	detail domain.DetailAssign,
	assign domain.Assign,
	userIDs []string,
	approverIDStr string,
	frontendURL string,
	ctxNames *domain.MinioPathContext,
) {
	// Get Lark config from DB (using assign.id_project as tenant scope)
	type LarkConfig struct {
		AppToken string `gorm:"column:lark_app_token"`
		TableID  string `gorm:"column:lark_table_id"`
	}
	var projCfg LarkConfig
	if err := db.Raw(`SELECT lark_app_token, lark_table_id FROM projects WHERE id = ? LIMIT 1`, assign.ProjectID).Scan(&projCfg).Error; err != nil || projCfg.AppToken == "" {
		return
	}

	// Resolve approver name
	var approverName string
	if approverIDStr != "" {
		var approver domain.User
		if err := db.First(&approver, "id = ?", approverIDStr).Error; err == nil {
			approverName = approver.Name
		}
	}
	if approverName == "" {
		approverName = "Quản lý"
	}

	// Build report link
	reportLink := fmt.Sprintf("%s/public/report/%s", frontendURL, detail.ID.String())

	// Get assignees
	var assignees []domain.User
	for _, uidStr := range userIDs {
		uid, err := uuid.Parse(uidStr)
		if err != nil {
			continue
		}
		var u domain.User
		if err := db.First(&u, "id = ?", uid).Error; err == nil {
			assignees = append(assignees, u)
		}
	}

	// Parse timestamps
	submittedAt := ""
	var subTimes []time.Time
	if err := json.Unmarshal(detail.SubmittedAt, &subTimes); err == nil && len(subTimes) > 0 {
		submittedAt = subTimes[len(subTimes)-1].Format("02/01/2006 15:04:05")
	}
	approvalAt := ""
	var appTimes []time.Time
	if err := json.Unmarshal(detail.ApprovalAt, &appTimes); err == nil && len(appTimes) > 0 {
		approvalAt = appTimes[len(appTimes)-1].Format("02/01/2006 15:04:05")
	}

	for _, assignee := range assignees {
		fields := map[string]interface{}{
			"Họ và tên nhân sự phụ trách": assignee.Name,
			"Họ và tên Quản lý":           approverName,
			"Work":                        ctxNames.WorkName,
			"Sub - work":                  ctxNames.SubWorkName,
			"Asset":                       ctxNames.AssetName,
			"Đường dẫn": map[string]string{
				"link": reportLink,
				"text": "Xem Báo Cáo",
			},
		}
		if submittedAt != "" {
			fields["Thời gian Nhân sự nộp"] = submittedAt
		}
		if approvalAt != "" {
			fields["Thời gian Quản lý duyệt"] = approvalAt
		}
		if err := larkSvc.PushReportToBitable(projCfg.AppToken, projCfg.TableID, fields); err != nil {
			fmt.Printf("[LarkSync] Failed for %s: %v\n", assignee.Name, err)
		}
	}

	// Also update the NỘP DỮ LIỆU Submit table with manager name + approval time
	updateSubmitRecordInLark(larkSvc, cfg, assign.ID.String(), ctxNames.SubWorkName, ctxNames.AssetName, ctxNames.ProcessName, approverName, approvalAt, true)
}

// syncRejectedTaskToLark pushes a rejected task record to the dedicated Lark Bitable table
// "TỪ CHỐI TASK" (tblkCQwQANfv8E7g). Mirrored from syncCompletedTaskToLark.
func syncRejectedTaskToLark(
	db *gorm.DB,
	larkSvc *LarkService,
	cfg config.Config,
	detail domain.DetailAssign,
	assign domain.Assign,
	userIDs []string,
	rejectorIDStr string,
	frontendURL string,
	ctxNames *domain.MinioPathContext,
) {
	// Use centralized config from Viper/.env
	rejectAppToken := cfg.Lark.RejectAppToken
	rejectTableID := cfg.Lark.RejectTableID

	if rejectAppToken == "" || rejectTableID == "" {
		fmt.Println("[LarkSync/Reject] Skipped: Missing REJECT_APP_TOKEN or REJECT_TABLE_ID in config")
		return
	}

	// Resolve rejector (manager) name
	var rejectorName string
	if rejectorIDStr != "" {
		var rejector domain.User
		if err := db.First(&rejector, "id = ?", rejectorIDStr).Error; err == nil {
			rejectorName = rejector.Name
		}
	}
	if rejectorName == "" {
		rejectorName = "Quản lý"
	}

	// Build public repair-report link (note: same route, different query param)
	queryParams := []string{}
	if detail.Config != nil {
		queryParams = append(queryParams, "asset="+detail.Config.AssetID.String(), "sub="+detail.Config.SubWorkID.String())
	}
	queryParams = append(queryParams, "type=reject")

	reportLink := fmt.Sprintf("%s/share/report/%s", frontendURL, assign.ID.String())
	if len(queryParams) > 0 {
		reportLink += "?" + strings.Join(queryParams, "&")
	}

	// Get assignees
	var assignees []domain.User
	for _, uidStr := range userIDs {
		uid, err := uuid.Parse(uidStr)
		if err != nil {
			continue
		}
		var u domain.User
		if err := db.First(&u, "id = ?", uid).Error; err == nil {
			assignees = append(assignees, u)
		}
	}

	// Parse timestamps
	submittedAt := ""
	var subTimes []time.Time
	if err := json.Unmarshal(detail.SubmittedAt, &subTimes); err == nil && len(subTimes) > 0 {
		submittedAt = subTimes[len(subTimes)-1].Format("02/01/2006 15:04:05")
	}

	rejectedAt := ""
	var rejTimes []time.Time
	if err := json.Unmarshal(detail.RejectedAt, &rejTimes); err == nil && len(rejTimes) > 0 {
		rejectedAt = rejTimes[len(rejTimes)-1].Format("02/01/2006 15:04:05")
	}

	for _, assignee := range assignees {
		fields := map[string]interface{}{
			"Họ và tên nhân sự phụ trách": assignee.Name,
			"Họ và tên Quản lý":           rejectorName,
			"Work":                        ctxNames.WorkName,
			"Sub - work":                  ctxNames.SubWorkName,
			"Asset":                       ctxNames.AssetName,
			"Đường dẫn": map[string]string{
				"link": reportLink,
				"text": "Xem Báo Cáo",
			},
		}
		if submittedAt != "" {
			fields["Thời gian Nhân sự nộp"] = submittedAt
		}
		if rejectedAt != "" {
			fields["Thời gian Quản lý từ chối"] = rejectedAt
		}
		if err := larkSvc.PushReportToBitable(rejectAppToken, rejectTableID, fields); err != nil {
			fmt.Printf("[LarkSync/Reject] Failed for %s: %v\n", assignee.Name, err)
		}
	}

	// Also update the NỘP DỮ LIỆU Submit table with manager name + rejection time
	if rejectorIDStr != "" {
		var rejectorUser domain.User
		mgrName := "Quản lý"
		if err := db.First(&rejectorUser, "id = ?", rejectorIDStr).Error; err == nil {
			mgrName = rejectorUser.Name
		}
		updateSubmitRecordInLark(larkSvc, cfg, assign.ID.String(), ctxNames.SubWorkName, ctxNames.AssetName, ctxNames.ProcessName, mgrName, rejectedAt, false)
	} else {
		updateSubmitRecordInLark(larkSvc, cfg, assign.ID.String(), ctxNames.SubWorkName, ctxNames.AssetName, ctxNames.ProcessName, "Quản lý", rejectedAt, false)
	}
}

// updateSubmitRecordInLark is a thin wrapper that delegates to larkSvc.UpdateSubmitRecord,
// resolving the app token / table ID from the centralized config.
func updateSubmitRecordInLark(
	larkSvc *LarkService,
	cfg config.Config,
	assignID string,
	subWorkName string,
	assetName string,
	processName string,
	managerName string,
	actionAt string,
	isApprove bool,
) {
	submitAppToken := cfg.Lark.SubmitAppToken
	submitTableID := cfg.Lark.SubmitTableID
	if submitAppToken == "" || submitTableID == "" {
		fmt.Println("[LarkSync/UpdateSubmit] Skipped: LARK_SUBMIT_APP_TOKEN or LARK_SUBMIT_TABLE_ID not configured")
		return
	}
	if err := larkSvc.UpdateSubmitRecord(submitAppToken, submitTableID, assignID, subWorkName, assetName, processName, managerName, actionAt, isApprove); err != nil {
		fmt.Printf("[LarkSync/UpdateSubmit] Failed for assign %s: %v\n", assignID, err)
	} else {
		fmt.Printf("[LarkSync/UpdateSubmit] Updated Submit record for assign %s\n", assignID)
	}
}

