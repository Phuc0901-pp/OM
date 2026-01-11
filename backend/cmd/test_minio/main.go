package main

import (
	"log"
    "fmt"
	"github.com/phuc/cmms-backend/internal/infrastructure/storage"
)

func main() {
    log.Println("Testing MinIO Connection...")
    
	client, err := storage.NewMinioClient()
	if err != nil {
		log.Fatalf("FAILED: %v", err)
	}

	fmt.Printf("SUCCESS: Connected to MinIO! Bucket '%s' exists.\n", client.Bucket)
}
