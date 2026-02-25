package storage

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"time"

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
	useSSL := os.Getenv("MINIO_USE_SSL") == "true"

	// Initialize minio client object.
	minioClient, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKeyID, secretAccessKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create minio client: %w", err)
	}

	ctx := context.Background()

	// Check if bucket exists; auto-create if not
	exists, err := minioClient.BucketExists(ctx, bucketName)
	if err != nil {
		return nil, fmt.Errorf("failed to check bucket existence: %w", err)
	}

	if !exists {
		// Auto-create the bucket instead of crashing
		err = minioClient.MakeBucket(ctx, bucketName, minio.MakeBucketOptions{})
		if err != nil {
			return nil, fmt.Errorf("bucket '%s' does not exist and failed to create it: %w", bucketName, err)
		}

		// Set public read-only policy so static URLs work on Frontend (no 403)
		policy := fmt.Sprintf(`{
			"Version": "2012-10-17",
			"Statement": [{
				"Effect": "Allow",
				"Principal": {"AWS": ["*"]},
				"Action": ["s3:GetObject"],
				"Resource": ["arn:aws:s3:::%s/*"]
			}]
		}`, bucketName)

		if policyErr := minioClient.SetBucketPolicy(ctx, bucketName, policy); policyErr != nil {
			// Non-fatal: log warning but don't fail startup
			// Images may return 403 until policy is set manually in Console
			fmt.Printf("[MinIO WARNING] Created bucket '%s' but failed to set public policy: %v\n", bucketName, policyErr)
		} else {
			fmt.Printf("[MinIO] Bucket '%s' created with public read policy.\n", bucketName)
		}
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
    scheme := "http"
    if m.Client.IsOnline() && m.Client.EndpointURL().Scheme == "https" { // Naive check, or just check env again if we tracked it
         scheme = "https"
    } else if os.Getenv("MINIO_USE_SSL") == "true" {
        scheme = "https"
    }
    
	url := fmt.Sprintf("%s://%s/%s/%s", scheme, m.Client.EndpointURL().Host, m.Bucket, objectName)
	return url, nil
}

// RemoveObject removes an object from the bucket
func (m *MinioClient) RemoveObject(objectName string) error {
	ctx := context.Background()
	opts := minio.RemoveObjectOptions{
		GovernanceBypass: true,
	}
	return m.Client.RemoveObject(ctx, m.Bucket, objectName, opts)
}

// ListObjects returns a list of public URLs for objects matching a prefix
func (m *MinioClient) ListObjects(prefix string) ([]string, error) {
    ctx := context.Background()
    // List all objects
    opts := minio.ListObjectsOptions{
        Prefix:    prefix,
        Recursive: true,
    }

    var urls []string
    for object := range m.Client.ListObjects(ctx, m.Bucket, opts) {
        if object.Err != nil {
            return nil, object.Err
        }

    // Generate Presigned URL (valid for 24 hours)
        // This ensures the image is accessible even if the bucket is private (403 fix).
        expiry := time.Hour * 24
        presignedURL, err := m.Client.PresignedGetObject(ctx, m.Bucket, object.Key, expiry, nil)
        if err != nil {
            // Log error but maybe continue? Or just fallback to public URL?
            // Let's fallback to public URL logic if signing fails, but typically it shouldn't.
            // For now, return error to be safe or skip.
            continue 
        }

        urls = append(urls, presignedURL.String())
    }
    return urls, nil
}

// ListObjectKeys returns a list of raw object keys matching a prefix
func (m *MinioClient) ListObjectKeys(prefix string) ([]string, error) {
    ctx := context.Background()
    // List all objects
    opts := minio.ListObjectsOptions{
        Prefix:    prefix,
        Recursive: true,
    }

    var keys []string
    for object := range m.Client.ListObjects(ctx, m.Bucket, opts) {
        if object.Err != nil {
            return nil, object.Err
        }
        keys = append(keys, object.Key)
    }
    return keys, nil
}

// GetObject fetches object content from MinIO
func (m *MinioClient) GetObject(objectName string) ([]byte, error) {
    ctx := context.Background()
    object, err := m.Client.GetObject(ctx, m.Bucket, objectName, minio.GetObjectOptions{})
    if err != nil {
        return nil, fmt.Errorf("failed to get object: %w", err)
    }
    defer object.Close()

    // Read all content
    buf := new(bytes.Buffer)
    _, err = buf.ReadFrom(object)
    if err != nil {
        return nil, fmt.Errorf("failed to read object content: %w", err)
    }
    return buf.Bytes(), nil
}
// GetObjectStream fetches object content as a stream (io.ReadCloser)
// Caller is responsible for closing the stream
func (m *MinioClient) GetObjectStream(objectName string) (*minio.Object, error) {
	ctx := context.Background()
	object, err := m.Client.GetObject(ctx, m.Bucket, objectName, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get object stream: %w", err)
	}
	return object, nil
}
