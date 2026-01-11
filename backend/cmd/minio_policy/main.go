package main

import (
	"context"
	"log"

	"github.com/phuc/cmms-backend/internal/infrastructure/storage"
)

func main() {
    log.Println("Setting MinIO Bucket Policy to PUBLIC...")
    
	clientWrapper, err := storage.NewMinioClient()
	if err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}
    
    // Standard Read-Only Policy for Public Access
    policy := `{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {"AWS": ["*"]},
                "Action": ["s3:GetObject"],
                "Resource": ["arn:aws:s3:::` + clientWrapper.Bucket + `/*"]
            }
        ]
    }`

	err = clientWrapper.Client.SetBucketPolicy(context.Background(), clientWrapper.Bucket, policy)
	if err != nil {
		log.Fatalf("FAILED to set policy: %v", err)
	}

	log.Printf("SUCCESS: Bucket '%s' is now PUBLIC (ReadOnly). You can view your images now.", clientWrapper.Bucket)
}
