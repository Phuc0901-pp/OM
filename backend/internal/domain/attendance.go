package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Attendance represents daily check-in/check-out records for users
type Attendance struct {
	ID             uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	IDUser         uuid.UUID      `gorm:"type:uuid;not null;column:id_user;index" json:"id_user"`
	IDProject      *uuid.UUID     `gorm:"type:uuid;column:id_project;index" json:"id_project"`
	Project        *Project       `gorm:"foreignKey:IDProject;references:ID" json:"project,omitempty"`
	StatusCheckin  int            `gorm:"column:status_checkin;default:0" json:"status_checkin"` // 0: not checked in, 1: checked in
	DateCheckin    *time.Time     `gorm:"column:date_checkin" json:"date_checkin"`
	StatusCheckout int            `gorm:"column:status_checkout;default:0" json:"status_checkout"` // 0: not checked out, 1: checked out
	DateCheckout   *time.Time     `gorm:"column:date_checkout" json:"date_checkout"`
	SiteStatus     int            `gorm:"column:site_status;default:0" json:"site_status"` // 0: not on site, 1: on site
	
	// Check-in photos
	PersonnelPhoto   string `gorm:"column:personnel_photo" json:"personnel_photo"`
	IDCardFront      string `gorm:"column:id_card_front" json:"id_card_front"`
	IDCardBack       string `gorm:"column:id_card_back" json:"id_card_back"`
	SafetyCardFront  string `gorm:"column:safety_card_front" json:"safety_card_front"`
	SafetyCardBack   string `gorm:"column:safety_card_back" json:"safety_card_back"`
	ToolsPhotos      string `gorm:"column:tools_photos;type:text" json:"tools_photos"` // JSON array
	DocumentsPhotos  string `gorm:"column:documents_photos;type:text" json:"documents_photos"` // JSON array
	
	// Addresses
	AddressCheckin  string `gorm:"column:address_checkin" json:"address_checkin"`
	AddressCheckout string `gorm:"column:address_checkout" json:"address_checkout"`
	
	// Checkout approval fields
	CheckoutRequested    bool       `gorm:"column:checkout_requested;default:false" json:"checkout_requested"`
	CheckoutRequestTime  *time.Time `gorm:"column:checkout_request_time" json:"checkout_request_time"`
	CheckoutApproved     bool       `gorm:"column:checkout_approved;default:false" json:"checkout_approved"`
	CheckoutApprovedBy   *uuid.UUID `gorm:"column:checkout_approved_by" json:"checkout_approved_by"`
	CheckoutApprovedTime *time.Time `gorm:"column:checkout_approved_time" json:"checkout_approved_time"`
	CheckoutRejected     bool       `gorm:"column:checkout_rejected;default:false" json:"checkout_rejected"`
	CheckoutRejectReason string     `gorm:"column:checkout_reject_reason" json:"checkout_reject_reason"`
	CheckoutImgURL       string     `gorm:"column:checkout_img_url" json:"checkout_img_url"`
	
	CreatedAt      time.Time      `gorm:"column:created_at;index" json:"created_at"`
	UpdatedAt      time.Time      `gorm:"column:updated_at" json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index;column:deleted_at" json:"-"`

	// Relationships
	User User `gorm:"foreignKey:IDUser;references:ID" json:"user,omitempty"`
}

func (Attendance) TableName() string {
	return "attendances"
}
