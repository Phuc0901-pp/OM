package main

import (
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"github.com/phuc/cmms-backend/internal/domain"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"os"
	"gorm.io/datatypes"
)

func main() {
    pass := os.Getenv("DB_PASSWORD")
	if pass == "" {
        pass = "password" // Default pass
    }
	dsn := "host=localhost user=postgres password=root dbname=om port=5432 sslmode=disable TimeZone=Asia/Ho_Chi_Minh"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		panic("failed to connect database")
	}

	detail := &domain.DetailAssign{}
    idToTest := "d447e3ac-3b90-4dce-8cb3-bf34d85e81fd"
	res := db.First(detail, "id = ?", idToTest)
    if res.Error != nil {
        fmt.Println("Error finding detail:", res.Error)
        return
    }

	fmt.Printf("Before Delete Data: %v\n", string(detail.Data))

	var currentData []string
	if len(detail.Data) > 0 && string(detail.Data) != "null" {
		json.Unmarshal(detail.Data, &currentData)
	}

    if len(currentData) == 0 {
		fmt.Println("Array is empty")
        return
	}

    targetUrl := currentData[0]
	fmt.Printf("Deleting targetUrl: %s\n", targetUrl)

	var newData []string
	deletedObjName := ""
	for _, imgUrl := range currentData {
		if imgUrl == targetUrl {
			deletedObjName = imgUrl
		} else {
			newData = append(newData, imgUrl)
		}
	}

    if deletedObjName == "" {
        fmt.Println("Not found")
        return
    }

	dataJSON, _ := json.Marshal(newData)
	detail.Data = datatypes.JSON(dataJSON)
    fmt.Printf("Updating DB with Data: %v\n", string(detail.Data))

	err = db.Save(detail).Error
    if err != nil {
        fmt.Println("Error saving:", err)
    } else {
        fmt.Println("Saved successfully.")
    }

    var check domain.DetailAssign
    db.First(&check, "id = ?", idToTest)
    fmt.Printf("After DB Save Data: %v\n", string(check.Data))
}
