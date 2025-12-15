#!/bin/bash
# Master setup script for IoT Pet Feeder
# Orchestrates the complete deployment process

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$PROJECT_ROOT/infra/scripts"
TERRAFORM_DIR="$PROJECT_ROOT/infra/terraform/environments/dev"

echo "╔════════════════════════════════════════╗"
echo "║  IoT Pet Feeder - Complete Setup  ║"
echo "╔════════════════════════════════════════╗"
echo ""

# Step 1: Pre-flight validation
echo "═══ Step 1/6: Pre-flight Validation ═══"
echo ""

if [ -f "$SCRIPT_DIR/validate.sh" ]; then
    bash "$SCRIPT_DIR/validate.sh"
else
    echo "⚠  Validation script not found, skipping..."
fi

echo ""
read -p "✓ Validation complete. Continue with deployment? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Setup cancelled"
    exit 1
fi

# Step 2: Terraform initialization
echo ""
echo "═══ Step 2/6: Terraform Initialization ═══"
echo ""

cd "$TERRAFORM_DIR"

if [ ! -d ".terraform" ]; then
    echo "Initializing Terraform..."
    terraform init
else
    echo "✓ Terraform already initialized"
fi

# Step 3: Terraform plan
echo ""
echo "═══ Step 3/6: Planning Infrastructure ═══"
echo ""

echo "Creating Terraform execution plan..."
terraform plan -out=setup.tfplan

echo ""
read -p "✓ Plan created. Review above and continue? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Setup cancelled"
    rm -f setup.tfplan
    exit 1
fi

# Step 4: Terraform apply
echo ""
echo "═══ Step 4/6: Deploying Infrastructure ═══"
echo ""

echo "Applying Terraform configuration..."
echo "(This may take 5-10 minutes)"
echo ""

terraform apply setup.tfplan
rm -f setup.tfplan

echo ""
echo "✅ Infrastructure deployed successfully!"

# Step 5: Post-deployment verification
echo ""
echo "═══ Step 5/6: Post-Deployment Verification ═══"
echo ""

cd "$PROJECT_ROOT"

if [ -f "$SCRIPT_DIR/post-deploy.sh" ]; then
    bash "$SCRIPT_DIR/post-deploy.sh"
else
    echo "⚠  Post-deploy script not found, skipping..."
fi

# Step 6: ESP32 configuration generation
echo ""
echo "═══ Step 6/6: ESP32 Configuration ═══"
echo ""

if [ -f "$SCRIPT_DIR/generate-esp32-config.sh" ]; then
    read -p "Generate ESP32 configuration now? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        bash "$SCRIPT_DIR/generate-esp32-config.sh"
    else
        echo "⚠  Skipping ESP32 config generation"
        echo "   Run manually later: infra/scripts/generate-esp32-config.sh"
    fi
else
    echo "⚠  ESP32 config script not found"
fi

# Final summary
echo ""
echo "╔════════════════════════════════════════╗"
echo "║       Setup Complete! 🎉           ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Next Steps:"
echo ""
echo "1. Configure ESP32 firmware:"
echo "   • Edit WiFi credentials in: firmware/esp32-feeder/iot-pet-feeder/secrets.h"
echo "   • Flash firmware to ESP32 using Arduino IDE or PlatformIO"
echo ""
echo "2. Access your IoT Pet Feeder:"

cd "$TERRAFORM_DIR"
AMPLIFY_URL=$(terraform output -raw amplify_frontend_url 2>/dev/null || echo "")
API_URL=$(terraform output -raw api_gateway_invoke_url 2>/dev/null || echo "")

if [ -n "$AMPLIFY_URL" ]; then
    echo "   • Web Dashboard: $AMPLIFY_URL"
fi
if [ -n "$API_URL" ]; then
    echo "   • API Gateway: $API_URL"
fi

echo ""
echo "3. Documentation:"
echo "   • Check README.md for detailed usage instructions"
echo "   • Review DEPLOYMENT_ANALYSIS.md for troubleshooting"
echo ""
echo "╔════════════════════════════════════════╗"
echo "║  Happy Feeding! 🐾                 ║"
echo "╚════════════════════════════════════════╝"
echo ""
