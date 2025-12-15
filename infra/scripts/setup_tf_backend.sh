#!/bin/bash

# This script automates the initial setup of the Terraform backend (S3 bucket and DynamoDB table).
# It should be run once locally to prepare the environment for Terraform operations.

# --- Configuration ---
PROJECT_NAME="iot-pet-feeder" # Ensure this matches your Terraform variables
AWS_REGION="us-east-2"   # Ensure this matches your Terraform variables
TF_STATE_BUCKET_NAME="${PROJECT_NAME}-terraform-state-${AWS_REGION}"
TF_LOCK_TABLE_NAME="${PROJECT_NAME}-terraform-lock"

# Environment to initialize (e.g., dev, prod) - this should match a subdirectory in infra/terraform/environments
ENVIRONMENT="dev" # Default to 'dev' for local setup

# --- Check for prerequisites ---
check_prerequisites() {
    if ! command -v aws &> /dev/null; then
        echo "AWS CLI is not installed. Please install it to proceed."
        echo "Refer to: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
        exit 1
    fi
    if ! command -v terraform &> /dev/null; then
        echo "Terraform is not installed. Please install it to proceed."
        echo "Refer to: https://developer.hashicorp.com/terraform/downloads"
        exit 1
    fi
}

# --- Main Script Execution ---
check_prerequisites

echo "--- Ensuring Terraform Backend Resources Exist ---"

# 1. Create S3 Bucket for Terraform State
echo "Checking for S3 bucket: ${TF_STATE_BUCKET_NAME}..."
if ! aws s3api head-bucket --bucket "${TF_STATE_BUCKET_NAME}" --region "${AWS_REGION}" 2>/dev/null; then
    echo "Bucket ${TF_STATE_BUCKET_NAME} not found. Creating..."
    if [ "${AWS_REGION}" = "us-east-1" ]; then
        aws s3api create-bucket --bucket "${TF_STATE_BUCKET_NAME}" --region "${AWS_REGION}"
    else
        aws s3api create-bucket --bucket "${TF_STATE_BUCKET_NAME}" --region "${AWS_REGION}" --create-bucket-configuration LocationConstraint="${AWS_REGION}"
    fi
    if [ $? -ne 0 ]; then
        echo "Failed to create S3 bucket. Please check your AWS credentials and region."
        exit 1
    fi
    echo "Bucket ${TF_STATE_BUCKET_NAME} created successfully."
else
    echo "Bucket ${TF_STATE_BUCKET_NAME} already exists."
fi

# Enable S3 bucket versioning (highly recommended for state files)
echo "Enabling versioning on bucket ${TF_STATE_BUCKET_NAME}..."
aws s3api put-bucket-versioning --bucket "${TF_STATE_BUCKET_NAME}" --versioning-configuration Status=Enabled --region "${AWS_REGION}" || true # Ignore error if already enabled

# 2. Create DynamoDB Table for State Locking
echo "Checking for DynamoDB table: ${TF_LOCK_TABLE_NAME}..."
if ! aws dynamodb describe-table --table-name "${TF_LOCK_TABLE_NAME}" --region "${AWS_REGION}" 2>/dev/null; then
    echo "DynamoDB table ${TF_LOCK_TABLE_NAME} not found. Creating..."
    aws dynamodb create-table \
        --table-name "${TF_LOCK_TABLE_NAME}" \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --region "${AWS_REGION}"
    if [ $? -ne 0 ]; then
        echo "Failed to create DynamoDB table. Please check your AWS credentials and region."
        exit 1
    fi
    echo "DynamoDB table ${TF_LOCK_TABLE_NAME} created successfully. Waiting for it to become active..."
    aws dynamodb wait table-exists --table-name "${TF_LOCK_TABLE_NAME}" --region "${AWS_REGION}"
    echo "DynamoDB table ${TF_LOCK_TABLE_NAME} is active."
else
    echo "DynamoDB table ${TF_LOCK_TABLE_NAME} already exists."
fi

echo "--- Initializing Terraform for ${ENVIRONMENT} environment ---"

# Navigate to the environment-specific terraform directory
cd "infra/terraform/environments/${ENVIRONMENT}" || { echo "Error: Environment directory not found."; exit 1; }

# Initialize Terraform with backend configuration
# This will configure Terraform to use the S3 bucket and DynamoDB table for state.
terraform init \
  -backend-config="bucket=${TF_STATE_BUCKET_NAME}" \
  -backend-config="key=${PROJECT_NAME}/${ENVIRONMENT}/terraform.tfstate" \
  -backend-config="region=${AWS_REGION}" \
  -backend-config="dynamodb_table=${TF_LOCK_TABLE_NAME}" \
  -backend-config="encrypt=true"

if [ $? -ne 0 ]; then
    echo "Terraform init failed. Please check the output above for errors."
    exit 1
fi

echo "Terraform backend initialized successfully. You can now run 'terraform plan' or 'terraform apply' from 'infra/terraform/environments/${ENVIRONMENT}'."

# Return to the original directory
cd ../../../.. # Go back to project root
