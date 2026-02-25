package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
    "log"
)

type TelegramService struct {
	BotToken string
    ApiURL   string
}

func NewTelegramService() *TelegramService {
	// Retrieve from ENV or hardcode for testing if needed (User will need to set this)
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
    if token == "" {
        // Fallback or warning
        log.Println("[TelegramService] Warning: TELEGRAM_BOT_TOKEN is not set")
    }
	return &TelegramService{
		BotToken: token,
        ApiURL:   "https://api.telegram.org/bot",
	}
}

func (s *TelegramService) SendMessage(chatID string, text string) error {
	if s.BotToken == "" {
		return fmt.Errorf("bot token is missing")
	}
    if chatID == "" {
        return fmt.Errorf("chat ID is missing")
    }

	url := fmt.Sprintf("%s%s/sendMessage", s.ApiURL, s.BotToken)

	payload := map[string]string{
		"chat_id": chatID,
		"text":    text,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to send message, status: %s", resp.Status)
	}

    log.Printf("[TelegramService] Message sent to %s: %s", chatID, text)
	return nil
}
