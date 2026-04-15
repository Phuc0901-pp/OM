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
