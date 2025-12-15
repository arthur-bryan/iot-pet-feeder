#!/bin/bash
# Post-deployment script
# Triggers Amplify rebuild with correct API Gateway URL and verifies deployment

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TERRAFORM_DIR="$PROJECT_ROOT/infra/terraform/environments/dev"

echo "=== Post-Deployment Verification ==="
echo ""

# Check if terraform state exists
if [ ! -f "$TERRAFORM_DIR/terraform.tfstate" ] && [ ! -f "$TERRAFORM_DIR/.terraform/terraform.tfstate" ]; then
    echo "❌ Terraform state not found. Run terraform apply first."
    exit 1
fi

cd "$TERRAFORM_DIR"

# Extract Terraform outputs
echo "[1/5] Extracting deployment information..."

API_URL=$(terraform output -raw api_gateway_invoke_url 2>/dev/null)
AMPLIFY_APP_ID=$(terraform output -raw amplify_app_id 2>/dev/null)
IOT_ENDPOINT=$(terraform output -raw iot_data_plane_endpoint 2>/dev/null)
THING_NAME=$(terraform output -raw iot_thing_name 2>/dev/null)

if [ -z "$API_URL" ] || [ -z "$AMPLIFY_APP_ID" ]; then
    echo "❌ Could not retrieve Terraform outputs. Ensure terraform apply completed successfully."
    exit 1
fi

echo "  ✓ API Gateway URL: $API_URL"
echo "  ✓ Amplify App ID: $AMPLIFY_APP_ID"
echo "  ✓ IoT Endpoint: $IOT_ENDPOINT"
echo ""

# Check API Gateway accessibility
echo "[2/5] Verifying API Gateway deployment..."

if curl -sf "${API_URL}/health" > /dev/null 2>&1; then
    echo "  ✓ API Gateway is accessible"
else
    echo "  ⚠ API Gateway health check failed (may need warmup)"
fi
echo ""

# Trigger Amplify rebuild
echo "[3/5] Triggering Amplify rebuild with correct API URL..."

# Get default branch
BRANCH=$(aws amplify get-app --app-id "$AMPLIFY_APP_ID" --query 'app.defaultDomain' --output text | cut -d'.' -f1 2>/dev/null || echo "main")

# Start new build
BUILD_ID=$(aws amplify start-job \
    --app-id "$AMPLIFY_APP_ID" \
    --branch-name "$BRANCH" \
    --job-type RELEASE \
    --query 'jobSummary.jobId' \
    --output text 2>/dev/null)

if [ -z "$BUILD_ID" ]; then
    echo "  ⚠ Could not trigger Amplify rebuild. May need to rebuild manually."
    echo "    Run: aws amplify start-job --app-id $AMPLIFY_APP_ID --branch-name $BRANCH --job-type RELEASE"
    echo ""
else
    echo "  ✓ Build started: $BUILD_ID"
    echo ""

    # Wait for build completion
    echo "[4/5] Waiting for Amplify build to complete..."
    echo "  (This may take 3-5 minutes)"
    echo ""

    MAX_WAIT=600  # 10 minutes
    ELAPSED=0
    INTERVAL=15

    while [ $ELAPSED -lt $MAX_WAIT ]; do
        STATUS=$(aws amplify get-job \
            --app-id "$AMPLIFY_APP_ID" \
            --branch-name "$BRANCH" \
            --job-id "$BUILD_ID" \
            --query 'job.summary.status' \
            --output text 2>/dev/null || echo "UNKNOWN")

        if [ "$STATUS" = "SUCCEED" ]; then
            echo "  ✓ Build completed successfully"
            break
        elif [ "$STATUS" = "FAILED" ] || [ "$STATUS" = "CANCELLED" ]; then
            echo "  ✗ Build failed with status: $STATUS"
            echo "    Check Amplify console for details"
            break
        else
            echo "  • Build status: $STATUS (${ELAPSED}s elapsed)"
            sleep $INTERVAL
            ELAPSED=$((ELAPSED + INTERVAL))
        fi
    done

    if [ $ELAPSED -ge $MAX_WAIT ]; then
        echo "  ⚠ Build timeout. Check Amplify console for status."
    fi
    echo ""
fi

# Get Amplify app URL
echo "[5/5] Deployment summary..."
echo ""

AMPLIFY_URL=$(aws amplify get-app \
    --app-id "$AMPLIFY_APP_ID" \
    --query 'app.defaultDomain' \
    --output text 2>/dev/null || echo "")

if [ -n "$AMPLIFY_URL" ]; then
    AMPLIFY_URL="https://$BRANCH.$AMPLIFY_URL"
fi

echo "========================================="
echo "✅ Deployment Complete!"
echo ""
echo "📍 Important URLs:"
echo "  • Web Dashboard: ${AMPLIFY_URL:-Check Amplify console}"
echo "  • API Gateway: $API_URL"
echo ""
echo "🔧 IoT Configuration:"
echo "  • Endpoint: $IOT_ENDPOINT"
echo "  • Thing Name: $THING_NAME"
echo ""
echo "📋 Next Steps:"
echo ""
echo "  1. Configure ESP32 firmware:"
echo "     Run: infra/scripts/generate-esp32-config.sh"
echo "     Then edit WiFi credentials in: firmware/esp32-feeder/iot-pet-feeder/secrets.h"
echo ""
echo "  2. Flash firmware to ESP32:"
echo "     - Open Arduino IDE or PlatformIO"
echo "     - Select ESP32 board and port"
echo "     - Upload sketch from: firmware/esp32-feeder/iot-pet-feeder/"
echo ""
echo "  3. Access web dashboard:"
echo "     - Visit: ${AMPLIFY_URL:-Check Amplify console for URL}"
echo "     - Sign up with Google OAuth"
echo "     - Start feeding your pet remotely!"
echo ""
echo "========================================="
echo ""
