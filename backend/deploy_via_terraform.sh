#!/bin/bash
# Deploy Lambda functions using Terraform
# This ensures layer versions stay in sync and prevents drift

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TERRAFORM_DIR="$PROJECT_ROOT/infra/terraform/environments/dev"

echo "🚀 Deploying Lambda functions via Terraform..."
echo ""

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform not installed. Install from: https://www.terraform.io/downloads"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

# Navigate to Terraform directory
cd "$TERRAFORM_DIR"

echo "[1/3] Checking for changes..."
terraform plan -out=deploy.tfplan

echo ""
read -p "Review the plan above. Apply changes? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    rm -f deploy.tfplan
    exit 1
fi

echo ""
echo "[2/3] Applying changes..."
terraform apply deploy.tfplan
rm -f deploy.tfplan

echo ""
echo "[3/3] Deployment summary..."
terraform output

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Note: All infrastructure changes (including Lambda layers) are now in sync"
echo "   Use this script instead of manual AWS CLI updates to prevent drift"
echo ""
