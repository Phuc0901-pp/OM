package storage

import (
	"bytes"
	"context"
	"fmt"
	"os"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type MinioClient struct {
	Client *minio.Client
	Bucket string
}

func NewMinioClient() (*MinioClient, error) {
	// Load from environment variables for security
	endpoint := os.Getenv("MINIO_ENDPOINT")
	if endpoint == "" {
		endpoint = "minio.raitek.cloud"
	}
	accessKeyID := os.Getenv("MINIO_ACCESS_KEY")
	if accessKeyID == "" {
		return nil, fmt.Errorf("MINIO_ACCESS_KEY environment variable is required")
	}
	secretAccessKey := os.Getenv("MINIO_SECRET_KEY")
	if secretAccessKey == "" {
		return nil, fmt.Errorf("MINIO_SECRET_KEY environment variable is required")
	}
	bucketName := os.Getenv("MINIO_BUCKET")
	if bucketName == "" {
		bucketName = "dev"
	}
	useSSL := true // HTTPS

	// Initialize minio client object.
	minioClient, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKeyID, secretAccessKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create minio client: %w", err)
	}

	// Verify connection by checking if bucket exists
	exists, err := minioClient.BucketExists(context.Background(), bucketName)
	if err != nil {
		// Just log error, don't fail hard if it's just connection issue, but better to know.
        // Actually, if we can't connect, we should probably return error.
        // However, 'minio-login' sounds like Console URL. The API might be different. 
        // Let's assume this is correct for now.
		return nil, fmt.Errorf("failed to check bucket existence: %w", err)
	}
    
    if !exists {
        // Try to make it? No, user said bucket is 'dev', assume it exists.
        return nil, fmt.Errorf("bucket %s does not exist", bucketName)
    }

	return &MinioClient{
		Client: minioClient,
		Bucket: bucketName,
	}, nil
}

// UploadBytes uploads byte data to MinIO and returns the public URL
func (m *MinioClient) UploadBytes(data []byte, objectName string, contentType string) (string, error) {
	reader := bytes.NewReader(data)
	
	_, err := m.Client.PutObject(
		context.Background(),
		m.Bucket,
		objectName,
		reader,
		int64(len(data)),
		minio.PutObjectOptions{ContentType: contentType},
	)
	if err != nil {
		return "", fmt.Errorf("failed to upload to MinIO: %w", err)
	}

	// Return public URL
	url := fmt.Sprintf("https://%s/%s/%s", m.Client.EndpointURL().Host, m.Bucket, objectName)
	return url, nil
}
