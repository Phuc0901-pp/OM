package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/phuc/cmms-backend/internal/platform/logger"
	"go.uber.org/zap"
)

type LarkService struct {
	AppID     string
	AppSecret string
}

func NewLarkService(appID, appSecret string) *LarkService {
	return &LarkService{
		AppID:     appID,
		AppSecret: appSecret,
	}
}

// GetTenantAccessToken fetches the tenant_access_token from Lark Open API
func (s *LarkService) GetTenantAccessToken() (string, error) {
	url := "https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal"

	payload := map[string]string{
		"app_id":     s.AppID,
		"app_secret": s.AppSecret,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")

	client := &http.Client{
		Timeout: 10 * time.Second,
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var res struct {
		Code              int    `json:"code"`
		Msg               string `json:"msg"`
		TenantAccessToken string `json:"tenant_access_token"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", err
	}

	if res.Code != 0 {
		return "", fmt.Errorf("lark error %d: %s", res.Code, res.Msg)
	}

	return res.TenantAccessToken, nil
}

// PushReportToBitable appends a report link record to a specific Bitable Table
func (s *LarkService) PushReportToBitable(appToken, tableID string, fields map[string]interface{}) error {
	token, err := s.GetTenantAccessToken()
	if err != nil {
		logger.Error("Failed to get Lark tenant token", zap.Error(err))
		return err
	}

	url := fmt.Sprintf("https://open.larksuite.com/open-apis/bitable/v1/apps/%s/tables/%s/records", appToken, tableID)

	payload := map[string]interface{}{
		"fields": fields,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{
		Timeout: 10 * time.Second,
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var res map[string]interface{}
	if err := json.Unmarshal(respBody, &res); err != nil {
		return err
	}

	if code, ok := res["code"].(float64); ok && code != 0 {
		msg := res["msg"].(string)
		logger.Error("Failed to push to Lark Bitable", zap.Float64("code", code), zap.String("msg", msg))
		return fmt.Errorf("lark bitable error: %s", msg)
	}

	logger.Info("Successfully pushed report to Lark Bitable", zap.String("tableID", tableID))
	return nil
}

// SearchSubmitRecord searches the Bitable table for a record based on Assign ID, Sub-work, Asset and Process.
// This helps uniquely identify the specific sub-task within an assignment.
func (s *LarkService) SearchSubmitRecord(appToken, tableID, assignID, subWorkName, assetName, processName string) (string, error) {
	token, err := s.GetTenantAccessToken()
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("https://open.larksuite.com/open-apis/bitable/v1/apps/%s/tables/%s/records/search", appToken, tableID)

	conditions := []map[string]interface{}{}
	conditions = append(conditions, map[string]interface{}{
		"field_name": "Assign ID",
		"operator":   "is",
		"value":      []string{assignID},
	})
	if subWorkName != "" {
		conditions = append(conditions, map[string]interface{}{
			"field_name": "Sub - work",
			"operator":   "is",
			"value":      []string{subWorkName},
		})
	}
	if assetName != "" {
		conditions = append(conditions, map[string]interface{}{
			"field_name": "Asset",
			"operator":   "is",
			"value":      []string{assetName},
		})
	}
	if processName != "" {
		conditions = append(conditions, map[string]interface{}{
			"field_name": "Process",
			"operator":   "is",
			"value":      []string{processName},
		})
	}

	payload := map[string]interface{}{
		"filter": map[string]interface{}{
			"conjunction": "and",
			"conditions":  conditions,
		},
		"page_size": 5,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var res struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
		Data struct {
			Items []struct {
				RecordID string `json:"record_id"`
			} `json:"items"`
		} `json:"data"`
	}
	if err := json.Unmarshal(respBody, &res); err != nil {
		return "", err
	}
	if res.Code != 0 {
		return "", fmt.Errorf("lark search error %d: %s", res.Code, res.Msg)
	}
	if len(res.Data.Items) == 0 {
		return "", nil
	}
	return res.Data.Items[0].RecordID, nil
}

// UpdateRecordInBitable updates an existing Bitable record by record_id with the given fields.
func (s *LarkService) UpdateRecordInBitable(appToken, tableID, recordID string, fields map[string]interface{}) error {
	token, err := s.GetTenantAccessToken()
	if err != nil {
		logger.Error("Failed to get Lark tenant token for update", zap.Error(err))
		return err
	}

	url := fmt.Sprintf("https://open.larksuite.com/open-apis/bitable/v1/apps/%s/tables/%s/records/%s", appToken, tableID, recordID)

	payload := map[string]interface{}{"fields": fields}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest("PUT", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var res map[string]interface{}
	if err := json.Unmarshal(respBody, &res); err != nil {
		return err
	}
	if code, ok := res["code"].(float64); ok && code != 0 {
		msg, _ := res["msg"].(string)
		logger.Error("Failed to update Lark Bitable record", zap.Float64("code", code), zap.String("msg", msg))
		return fmt.Errorf("lark bitable update error: %s", msg)
	}

	logger.Info("Successfully updated Lark Bitable record", zap.String("recordID", recordID), zap.String("tableID", tableID))
	return nil
}

// UpdateSubmitRecord finds the existing Submit record in the given Bitable table for the given
// assignID (by searching the "Đường dẫn" field), then patches manager name + timestamp columns.
// isApprove=true  → writes to "Thời gian Quản lý duyệt"
// isApprove=false → writes to "Thời gian Quản lý từ chối"
func (s *LarkService) UpdateSubmitRecord(appToken, tableID, assignID, subWorkName, assetName, processName, managerName, actionAt string, isApprove bool) error {
	if appToken == "" || tableID == "" {
		return fmt.Errorf("UpdateSubmitRecord: appToken or tableID is empty")
	}

	recordID, err := s.SearchSubmitRecord(appToken, tableID, assignID, subWorkName, assetName, processName)
	if err != nil {
		return fmt.Errorf("UpdateSubmitRecord search: %w", err)
	}
	if recordID == "" {
		logger.Info("UpdateSubmitRecord: no matching Submit record found, skipping", zap.String("assignID", assignID))
		return nil
	}

	fields := map[string]interface{}{
		"Họ và tên Quản lý": managerName,
	}
	if isApprove {
		if actionAt != "" {
			fields["Thời gian Quản lý duyệt"] = actionAt
		}
	} else {
		if actionAt != "" {
			fields["Thời gian Quản lý từ chối"] = actionAt
		}
	}

	return s.UpdateRecordInBitable(appToken, tableID, recordID, fields)
}
