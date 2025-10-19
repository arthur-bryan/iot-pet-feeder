#!/bin/bash
# Pre-deployment validation script
# Checks prerequisites before running Terraform

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ERRORS=0

echo "=== IoT Pet Feeder Deployment Validation ==="
echo ""

# Check required tools
echo "[1/5] Checking required tools..."

if ! command -v terraform &> /dev/null; then
    echo "  ✗ Terraform not found. Install from: https://www.terraform.io/downloads"
    ERRORS=$((ERRORS + 1))
else
    TERRAFORM_VERSION=$(terraform version -json | grep -o '"terraform_version":"[^"]*' | cut -d'"' -f4)
    echo "  ✓ Terraform installed (v${TERRAFORM_VERSION})"
fi

if ! command -v aws &> /dev/null; then
    echo "  ✗ AWS CLI not found. Install from: https://aws.amazon.com/cli/"
    ERRORS=$((ERRORS + 1))
else
    AWS_VERSION=$(aws --version | awk '{print $1}' | cut -d'/' -f2)
    echo "  ✓ AWS CLI installed (v${AWS_VERSION})"
fi

if ! command -v jq &> /dev/null; then
    echo "  ✗ jq not found. Install: sudo apt-get install jq (Debian/Ubuntu) or brew install jq (macOS)"
    ERRORS=$((ERRORS + 1))
else
    echo "  ✓ jq installed"
fi

if ! command -v curl &> /dev/null; then
    echo "  ✗ curl not found"
    ERRORS=$((ERRORS + 1))
else
    echo "  ✓ curl installed"
fi

echo ""

# Check AWS credentials
echo "[2/5] Checking AWS credentials..."

if ! aws sts get-caller-identity &> /dev/null; then
    echo "  ✗ AWS credentials not configured or invalid"
    echo "    Run: aws configure"
    echo "    Or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env"
    ERRORS=$((ERRORS + 1))
else
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    AWS_USER=$(aws sts get-caller-identity --query Arn --output text | cut -d'/' -f2)
    echo "  ✓ AWS credentials valid"
    echo "    Account: ${AWS_ACCOUNT}"
    echo "    User: ${AWS_USER}"
fi

echo ""

# Check .env file
echo "[3/5] Checking .env file..."

if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo "  ✗ .env file not found"
    echo "    Create from template: cp .env.example .env"
    echo "    Then edit with your AWS credentials"
    ERRORS=$((ERRORS + 1))
else
    echo "  ✓ .env file exists"

    # Check required variables
    source "$PROJECT_ROOT/.env"

    if [ -z "$AWS_REGION" ]; then
        echo "    ✗ AWS_REGION not set in .env"
        ERRORS=$((ERRORS + 1))
    else
        echo "    ✓ AWS_REGION: ${AWS_REGION}"
    fi

    if [ -z "$AWS_ACCESS_KEY_ID" ] || [ "$AWS_ACCESS_KEY_ID" = "YOUR_AWS_ACCESS_KEY_ID" ]; then
        echo "    ✗ AWS_ACCESS_KEY_ID not configured in .env"
        ERRORS=$((ERRORS + 1))
    else
        echo "    ✓ AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:0:8}..."
    fi

    if [ -z "$AWS_SECRET_ACCESS_KEY" ] || [ "$AWS_SECRET_ACCESS_KEY" = "YOUR_AWS_SECRET_ACCESS_KEY" ]; then
        echo "    ✗ AWS_SECRET_ACCESS_KEY not configured in .env"
        ERRORS=$((ERRORS + 1))
    else
        echo "    ✓ AWS_SECRET_ACCESS_KEY: ********"
    fi
fi

echo ""

# Check terraform.tfvars
echo "[4/5] Checking terraform.tfvars..."

TFVARS_PATH="$PROJECT_ROOT/infra/terraform/environments/dev/terraform.tfvars"

if [ ! -f "$TFVARS_PATH" ]; then
    echo "  ✗ terraform.tfvars not found"
    echo "    Create from template: cp terraform.tfvars.example terraform.tfvars"
    echo "    Then edit with your GitHub and email settings"
    ERRORS=$((ERRORS + 1))
else
    echo "  ✓ terraform.tfvars exists"

    # Check for placeholder values
    if grep -q "YOUR_GITHUB_USERNAME" "$TFVARS_PATH" 2>/dev/null; then
        echo "    ✗ github_owner still has placeholder value"
        ERRORS=$((ERRORS + 1))
    fi

    if grep -q "YOUR_GITHUB_PERSONAL_ACCESS_TOKEN" "$TFVARS_PATH" 2>/dev/null; then
        echo "    ✗ github_token still has placeholder value"
        ERRORS=$((ERRORS + 1))
    fi

    if grep -q "your-email@example.com" "$TFVARS_PATH" 2>/dev/null; then
        echo "    ✗ admin_email still has placeholder value"
        ERRORS=$((ERRORS + 1))
    fi
fi

echo ""

# Check backend state
echo "[5/5] Checking Terraform backend..."

BACKEND_PATH="$PROJECT_ROOT/infra/terraform/environments/dev/backend.tf"

if [ ! -f "$BACKEND_PATH" ]; then
    echo "  ⚠ backend.tf not found - will use local state"
    echo "    For production, run: infra/scripts/setup_tf_backend.sh"
else
    echo "  ✓ backend.tf configured"
fi

echo ""
echo "========================================="

if [ $ERRORS -gt 0 ]; then
    echo "❌ Validation failed with $ERRORS error(s)"
    echo ""
    echo "Fix the errors above and run validation again."
    exit 1
else
    echo "✅ All validation checks passed!"
    echo ""
    echo "You're ready to deploy. Run:"
    echo "  cd infra/terraform/environments/dev"
    echo "  terraform init"
    echo "  terraform plan -out=plan"
    echo "  terraform apply plan"
    echo ""
    echo "Or use the automated script:"
    echo "  make setup"
    exit 0
fi
