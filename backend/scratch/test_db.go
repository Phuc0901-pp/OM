//go:build ignore

package main
import (
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dsn := "host=localhost user=postgres password=root dbname=cmms_prod port=5432 sslmode=disable TimeZone=Asia/Ho_Chi_Minh"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Printf("Tried cmms_prod: %v\n", err)
	}

	if err != nil {
		dsn = "host=localhost user=postgres password=postgres dbname=cmms_dev port=5432 sslmode=disable TimeZone=Asia/Ho_Chi_Minh"
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err != nil {
			log.Fatal(err)
		}
	}

	managerID, _ := uuid.Parse("75b74395-1571-45ec-bc75-4f494fa1e591")
	fmt.Println("Manager ID:", managerID)

	var user domain.User
	db.Where("id = ?", managerID).First(&user)
	fmt.Println("Manager:", user.Name, user.Email, user.RoleID)

	var subUserIDs []uuid.UUID
	db.Model(&domain.User{}).Where("id_leader = ?", managerID).Pluck("id", &subUserIDs)
	fmt.Println("Sub users:", subUserIDs)

	var assigns []domain.Assign
	if len(subUserIDs) > 0 {
		db.Where("id_user IN ?", subUserIDs).Find(&assigns)
	}
	fmt.Println("Team assigns count:", len(assigns))

	// Note: Assign model no longer has a direct id_user column (now JSONB)
	// Use raw JSON query or leave as placeholder
	var selfAssigns []domain.Assign
	db.Where("id_user::jsonb @> to_jsonb(?::uuid)", managerID).Find(&selfAssigns)
	fmt.Println("Manager own assigns count:", len(selfAssigns))
}
