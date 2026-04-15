#!/bin/bash

# Configuration
MINIO_URL="http://localhost:2603"
MINIO_ACCESS_KEY="minioadmin" # Thay bang MINIO_ROOT_USER trong .env
MINIO_SECRET_KEY="minioadmin" # Thay bang MINIO_ROOT_PASSWORD trong .env
BUCKET_NAME="cmms-bucket"
QUOTA_SIZE="20GB"

echo "Configuring MinIO client (mc)..."
# Configure local mc
mc alias set myminio $MINIO_URL $MINIO_ACCESS_KEY $MINIO_SECRET_KEY

echo "Setting hard quota of $QUOTA_SIZE on bucket '$BUCKET_NAME'..."
# Set bucket quota
# Mode "hard" prevents new uploads once limit is reached
mc quota set myminio/$BUCKET_NAME --size $QUOTA_SIZE

echo "Quota applied successfully. Current status:"
mc quota info myminio/$BUCKET_NAME
