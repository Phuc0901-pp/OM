package main

import (
	"encoding/json"
	"fmt"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dsn := "postgres://phucraitek0539:090103Phuc@192.168.31.254:2602/solar_om?sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		panic("failed to connect database")
	}

	detail := &domain.DetailAssign{}
    idToTest := "d447e3ac-3b90-4dce-8cb3-bf34d85e81fd" // exact ID from the user log
	res := db.First(detail, "id = ?", idToTest)
    if res.Error != nil {
        fmt.Println("Error finding detail:", res.Error)
        return
    }

	fmt.Printf("Current DB Data:\n%v\n\n", string(detail.Data))

	var currentData []string
	if len(detail.Data) > 0 && string(detail.Data) != "null" {
		json.Unmarshal(detail.Data, &currentData)
	}

    fmt.Printf("Array length: %d\n", len(currentData))
    for i, url := range currentData {
        fmt.Printf("Item %d: %s\n", i, url)
    }
}
