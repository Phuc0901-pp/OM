package services

import (
	"fmt"
	"log"
	"net/smtp"
	"os"
)

type EmailService struct {
	auth smtp.Auth
	host string
	port string
	from string
}

func NewEmailService() *EmailService {
	host := os.Getenv("SMTP_HOST")
	port := os.Getenv("SMTP_PORT")
	email := os.Getenv("SMTP_EMAIL")
	password := os.Getenv("SMTP_PASSWORD")

	if host == "" || email == "" || password == "" {
		log.Println("Internal Email Service: Missing SMTP configuration")
		return nil
	}

	auth := smtp.PlainAuth("", email, password, host)
	return &EmailService{
		auth: auth,
		host: host,
		port: port,
		from: email,
	}
}

func (s *EmailService) SendAssignmentNotification(toEmail, userName, projectName string) error {
	if s == nil {
		return fmt.Errorf("email service not configured")
	}

	// Headers
	subject := "Subject: [Raitek O&M] Thông báo phân công dự án mới\n" 
	mime := "MIME-version: 1.0;\nContent-Type: text/plain; charset=\"UTF-8\";\n\n"
	
	body := fmt.Sprintf(`Xin chào %s,

Bạn vừa nhận được một phân công mới cho dự án: %s.
Vui lòng truy cập ứng dụng để xem chi tiết và thực hiện công việc.

Trân trọng,
Đội ngũ Raitek O&M`, userName, projectName)
	
	msg := []byte(subject + mime + body)

	addr := fmt.Sprintf("%s:%s", s.host, s.port)
	if err := smtp.SendMail(addr, s.auth, s.from, []string{toEmail}, msg); err != nil {
		log.Printf("Email error: %v", err)
		return err
	}
	log.Printf("Email sent successfully to %s", toEmail)
	return nil
}
