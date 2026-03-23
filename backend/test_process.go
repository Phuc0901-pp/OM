//go:build ignore

package main
import (
	"fmt"
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dsn := "postgres://phucraitek0539:090103Phuc@localhost:2602/cmms_db?sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	type Process struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}

	var processes []Process
	if err := db.Table("process").Select("id, name").Scan(&processes).Error; err != nil {
        log.Fatal(err)
    }

    fmt.Printf("Total processes: %d\n", len(processes))
	for _, p := range processes {
		fmt.Printf("- %s: %s\n", p.ID, p.Name)
	}
}
