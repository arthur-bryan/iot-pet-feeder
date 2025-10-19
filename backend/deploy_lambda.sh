#!/bin/bash
# Deploy backend Lambda function to AWS
# ⚠️  WARNING: This script only updates Lambda code, not layers or configuration
# ⚠️  This can cause version drift with Terraform state
# ⚠️  Recommended: Use deploy_via_terraform.sh instead for production deployments

set -e  # Exit on error

echo "⚠️  WARNING: Manual Lambda Deployment"
echo "   This script bypasses Terraform and may cause state drift"
echo "   For production deployments, use: backend/deploy_via_terraform.sh"
echo ""
read -p "Continue with manual deployment anyway? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled. Run backend/deploy_via_terraform.sh instead"
    exit 1
fi

echo ""
echo "🚀 Deploying IoT Pet Feeder API Lambda..."

# Configuration
LAMBDA_FUNCTION_NAME="iot-pet-feeder-api-dev"
AWS_REGION="us-east-2"
BUILD_DIR="lambda_deploy_package"

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf "$BUILD_DIR"
rm -f lambda_package.zip
mkdir -p "$BUILD_DIR"

# Copy application code
echo "📦 Copying application code..."
cp -r app "$BUILD_DIR/"
cp lambda_handler.py "$BUILD_DIR/"
cp feed_event_logger.py "$BUILD_DIR/"
cp status_updater.py "$BUILD_DIR/"
cp pre_sign_up_handler.py "$BUILD_DIR/"

# Create deployment package
echo "🗜️  Creating deployment package..."
cd "$BUILD_DIR"
zip -r ../lambda_package.zip . -q
cd ..

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

# Get Lambda function info
echo "📋 Checking Lambda function..."
if ! aws lambda get-function --function-name "$LAMBDA_FUNCTION_NAME" --region "$AWS_REGION" &> /dev/null; then
    echo "❌ Lambda function '$LAMBDA_FUNCTION_NAME' not found in region '$AWS_REGION'"
    exit 1
fi

# Update Lambda function code
echo "⬆️  Updating Lambda function code..."
aws lambda update-function-code \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --zip-file fileb://lambda_package.zip \
    --region "$AWS_REGION" \
    --output json > /dev/null

echo "✅ Lambda function updated successfully!"

# Wait for update to complete
echo "⏳ Waiting for update to complete..."
aws lambda wait function-updated \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --region "$AWS_REGION"

# Get function info
FUNCTION_INFO=$(aws lambda get-function-configuration \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --region "$AWS_REGION")

LAST_MODIFIED=$(echo "$FUNCTION_INFO" | grep -o '"LastModified": "[^"]*"' | cut -d'"' -f4)
CODE_SIZE=$(echo "$FUNCTION_INFO" | grep -o '"CodeSize": [0-9]*' | awk '{print $2}')

echo ""
echo "📊 Deployment Summary:"
echo "   Function: $LAMBDA_FUNCTION_NAME"
echo "   Region: $AWS_REGION"
echo "   Code Size: $CODE_SIZE bytes"
echo "   Last Modified: $LAST_MODIFIED"
echo ""
echo "🎉 Deployment complete! The API now uses the updated code."
echo ""
echo "💡 Test the changes:"
echo "   - Trigger a feed event from the frontend"
echo "   - ESP32 should log the event with weight data"
echo "   - Backend should return 'sent' status without creating an event"

# Cleanup
rm -rf "$BUILD_DIR"
rm -f lambda_package.zip

exit 0
