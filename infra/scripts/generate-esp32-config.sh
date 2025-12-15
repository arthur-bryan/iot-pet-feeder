#!/bin/bash
# Generate ESP32 secrets.h file from Terraform outputs
# Extracts IoT certificates from AWS Secrets Manager and creates firmware config

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TERRAFORM_DIR="$PROJECT_ROOT/infra/terraform/environments/dev"
FIRMWARE_DIR="$PROJECT_ROOT/firmware/esp32-feeder/iot-pet-feeder"
SECRETS_FILE="$FIRMWARE_DIR/secrets.h"

echo "=== Generating ESP32 Configuration ==="
echo ""

# Check if terraform state exists
if [ ! -f "$TERRAFORM_DIR/terraform.tfstate" ] && [ ! -f "$TERRAFORM_DIR/.terraform/terraform.tfstate" ]; then
    echo "❌ Terraform state not found. Run terraform apply first."
    exit 1
fi

cd "$TERRAFORM_DIR"

# Extract Terraform outputs
echo "[1/4] Extracting Terraform outputs..."

CERT_SECRET_ARN=$(terraform output -raw iot_certificate_pem_secret_arn 2>/dev/null)
KEY_SECRET_ARN=$(terraform output -raw iot_private_key_pem_secret_arn 2>/dev/null)
IOT_ENDPOINT=$(terraform output -raw iot_data_plane_endpoint 2>/dev/null)
THING_NAME=$(terraform output -raw iot_thing_name 2>/dev/null)

if [ -z "$CERT_SECRET_ARN" ] || [ -z "$KEY_SECRET_ARN" ]; then
    echo "❌ Could not retrieve Terraform outputs. Ensure terraform apply completed successfully."
    exit 1
fi

echo "  ✓ IoT Endpoint: $IOT_ENDPOINT"
echo "  ✓ Thing Name: $THING_NAME"
echo ""

# Download certificates from Secrets Manager
echo "[2/4] Downloading certificates from AWS Secrets Manager..."

CERT_PEM=$(aws secretsmanager get-secret-value \
    --secret-id "$CERT_SECRET_ARN" \
    --query SecretString \
    --output text 2>/dev/null)

if [ -z "$CERT_PEM" ]; then
    echo "❌ Failed to retrieve certificate from Secrets Manager"
    exit 1
fi
echo "  ✓ Device certificate retrieved"

PRIVATE_KEY=$(aws secretsmanager get-secret-value \
    --secret-id "$KEY_SECRET_ARN" \
    --query SecretString \
    --output text 2>/dev/null)

if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ Failed to retrieve private key from Secrets Manager"
    exit 1
fi
echo "  ✓ Private key retrieved"

# Download root CA certificate
echo "  • Downloading Amazon Root CA 1..."
ROOT_CA=$(curl -s https://www.amazontrust.com/repository/AmazonRootCA1.pem)

if [ -z "$ROOT_CA" ]; then
    echo "❌ Failed to download root CA certificate"
    exit 1
fi
echo "  ✓ Root CA certificate downloaded"
echo ""

# Create firmware directory if it doesn't exist
mkdir -p "$FIRMWARE_DIR"

# Generate secrets.h file
echo "[3/4] Generating secrets.h file..."

cat > "$SECRETS_FILE" <<'EOF'
#ifndef SECRETS_H
#define SECRETS_H

// WiFi credentials - UPDATE THESE WITH YOUR WIFI SETTINGS
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// AWS IoT Core configuration (auto-generated)
EOF

# Add IoT endpoint and thing name
cat >> "$SECRETS_FILE" <<EOF
const char* AWS_IOT_ENDPOINT = "$IOT_ENDPOINT";
const char* THING_NAME = "$THING_NAME";

EOF

# Add device certificate
cat >> "$SECRETS_FILE" <<'EOF'
// Device Certificate
const char AWS_CERT_CRT[] = R"EOF(
EOF
echo "$CERT_PEM" >> "$SECRETS_FILE"
cat >> "$SECRETS_FILE" <<'EOF'
)EOF";

EOF

# Add private key
cat >> "$SECRETS_FILE" <<'EOF'
// Private Key
const char AWS_CERT_PRIVATE[] = R"EOF(
EOF
echo "$PRIVATE_KEY" >> "$SECRETS_FILE"
cat >> "$SECRETS_FILE" <<'EOF'
)EOF";

EOF

# Add root CA
cat >> "$SECRETS_FILE" <<'EOF'
// Amazon Root CA 1
const char AWS_CERT_CA[] = R"EOF(
EOF
echo "$ROOT_CA" >> "$SECRETS_FILE"
cat >> "$SECRETS_FILE" <<'EOF'
)EOF";

#endif
EOF

echo "  ✓ secrets.h created at: $SECRETS_FILE"
echo ""

# Show next steps
echo "[4/4] Next steps:"
echo ""
echo "  1. Edit WiFi credentials in secrets.h:"
echo "     vim $SECRETS_FILE"
echo ""
echo "  2. Update your iot-pet-feeder.ino to include secrets.h:"
echo "     #include \"secrets.h\""
echo ""
echo "  3. Flash firmware to ESP32:"
echo "     - Open Arduino IDE or PlatformIO"
echo "     - Select ESP32 board and port"
echo "     - Upload sketch"
echo ""
echo "✅ ESP32 configuration generated successfully!"
echo ""
echo "⚠️  SECURITY NOTE: secrets.h contains sensitive credentials."
echo "    Do NOT commit this file to version control."
