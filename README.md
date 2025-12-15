# IoT Pet Feeder

![IoT Pet Feeder](docs/pet-feeder.jpg)

## System Architecture

![Architecture Diagram](docs/diagrams/iot-pet-feeder.png)

[![AWS IoT](https://img.shields.io/badge/AWS-IoT%20Core-orange.svg)](https://aws.amazon.com/iot-core/)
[![ESP32](https://img.shields.io/badge/Device-ESP32-blue.svg)](https://www.espressif.com/en/products/socs/esp32)
[![Python](https://img.shields.io/badge/Backend-Python%203.13-green.svg)](https://www.python.org/)
[![Terraform](https://img.shields.io/badge/IaC-Terraform-purple.svg)](https://www.terraform.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A production-ready cloud-connected smart pet feeder with weight tracking, event logging, and automated scheduling. Built on AWS serverless infrastructure with ESP32 hardware and authenticated web control panel.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Custom Domain Setup (Optional)](#custom-domain-setup-optional)
- [Teardown and Cleanup](#teardown-and-cleanup)
- [Hardware Setup](#hardware-setup)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Development](#development)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [Cost Estimation](#cost-estimation)
- [License](#license)

---

## Overview

The IoT Pet Feeder automates pet feeding while tracking consumption patterns and providing secure remote control via authenticated web dashboard. The system uses an ESP32 microcontroller with load cell for weight monitoring, servo motor for dispensing, and AWS IoT Core for cloud connectivity.

**Security:** Production deployment uses AWS Cognito authentication with email verification, role-based access control, and secure password delivery via AWS SES. All API endpoints require valid JWT tokens.

---

## Features

### Core Functionality
- **Remote Feeding** - Trigger feeds from anywhere via web dashboard
- **Weight Monitoring** - Track food consumption with 1kg load cell and HX711 amplifier
- **Automated Scheduling** - Set one-time or recurring (daily/monthly) feed times with timezone support
- **Manual Triggering** - Physical push button for local control
- **Visual Feedback** - Red and green LEDs indicate feeder status

### Web Dashboard
- **Interactive Feed History** - View historical events with filterable charts
- **Real-time Status** - Monitor device connectivity, current food weight, and last update time
- **Schedule Management** - Create, edit, and delete feeding schedules with user attribution
- **Email Notifications** - Get notified when pet is fed (via AWS SNS)
- **Settings Control** - Configure servo duration, weight thresholds, and notification preferences
- **User Management** - Admin panel for approving/rejecting user access requests

### Security & Authentication
- **AWS Cognito Integration** - Secure user authentication with email verification
- **Role-Based Access Control** - Admin and regular user roles with group-based permissions
- **Schedule Ownership** - Users can only modify their own schedules (admins can modify all)
- **Email Redaction** - Non-admin users see redacted emails in feed history
- **Secure Password Delivery** - Temporary passwords sent via AWS SES (never exposed in UI)
- **JWT Token Verification** - All API endpoints validate Cognito-issued tokens

### Technical Features
- **Event-Driven Architecture** - Publishes MQTT updates only on state changes (90% message reduction)
- **Offline Resilience** - Configuration cached in ESP32 NVS for offline operation
- **CloudWatch Monitoring** - Automated alarms for Lambda errors, API 5xx errors, and high latency
- **Execution History** - All schedule executions logged to DynamoDB for audit trail
- **API Documentation** - Interactive API docs at `/docs.html` and `/redoc.html`

---

## Technology Stack

**Hardware:**
- ESP32-WROOM-32U microcontroller
- HW-131 power supply (5V/2A)
- HX711 load cell amplifier + 1kg load cell
- SG90 servo motor
- Momentary push button (manual trigger)
- Red LED (error indicator)
- Green LED (status indicator)
- Jumper wires for connections

**Backend:**
- AWS Lambda (Python 3.13 + FastAPI)
- AWS IoT Core (MQTT over TLS 1.2+)
- API Gateway (REST API with Cognito authorizer)
- AWS Cognito (user authentication)
- AWS SES (email notifications and password delivery)
- DynamoDB (NoSQL database with point-in-time recovery)
- EventBridge (scheduled feed triggers)
- SNS (feed notifications)
- CloudWatch (monitoring and alarms)
- Secrets Manager (IoT certificate storage)

**Frontend:**
- Vanilla JavaScript (ES6+ modules)
- Tailwind CSS
- AWS Amplify (hosting + CI/CD)

**Infrastructure:**
- Terraform (Infrastructure as Code)
- GitHub Actions (optional CI/CD)
- Bash scripts (deployment automation)

---

## Prerequisites

### Required Tools

| Tool | Version | Installation |
|------|---------|-------------|
| Terraform | 1.0+ | [terraform.io/downloads](https://www.terraform.io/downloads) |
| AWS CLI | v2+ | [aws.amazon.com/cli](https://aws.amazon.com/cli/) |
| Python | 3.13+ | [python.org](https://www.python.org/) |
| jq | 1.6+ | `sudo apt install jq` or [jqlang.github.io](https://jqlang.github.io/jq/download/) |
| Arduino IDE | 2.0+ | [arduino.cc](https://www.arduino.cc/en/software) |
| Git | 2.0+ | [git-scm.com](https://git-scm.com/) |

### AWS Account Requirements

- AWS account with admin-level permissions
- AWS CLI configured with credentials (`aws configure`)
- Sufficient permissions for: Lambda, IoT Core, DynamoDB, API Gateway, Amplify, SNS, SES, EventBridge, Cognito, S3, CloudWatch, Secrets Manager

### GitHub Requirements

- GitHub account
- GitHub personal access token with `repo` and `admin:repo_hook` permissions
- AWS Amplify GitHub App installed (for frontend CI/CD)

### Domain Requirements (Optional - for custom domain)

- Registered domain name
- Access to DNS records (Route53 or external DNS provider)
- ACM certificate in `us-east-1` (for API Gateway custom domain)

### Email Requirements

- Valid email address for admin account
- Access to email for SES domain verification (if using custom domain)

### Hardware Components

| Component | Specification | Quantity |
|-----------|---------------|----------|
| ESP32 Board | ESP32-WROOM-32U | 1 |
| Power Supply | HW-131 5V/2A | 1 |
| Load Cell | 1kg strain gauge with HX711 amplifier | 1 |
| Servo Motor | SG90 (5V, 180°) | 1 |
| Push Button | Momentary switch | 1 |
| LED (Green) | 3mm or 5mm | 1 |
| LED (Red) | 3mm or 5mm | 1 |
| Resistors | 220Ω (for LEDs) | 2 |
| Jumper Wires | Male-to-male, male-to-female | ~20 |
| Breadboard | Half-size or full-size (optional) | 1 |

---

## Installation

### Quick Start Summary

Complete provisioning flow:

1. Clone repository
2. Create `.env` with AWS credentials
3. Create `terraform.tfvars` with project configuration
4. Run `setup_tf_backend.sh` to create Terraform state backend
5. Run `terraform apply` to deploy AWS infrastructure
6. Verify SES email address (for password delivery)
7. Configure DNS records for SES (DKIM, MX, SPF, DMARC)
8. Create Amplify app and connect to GitHub
9. Configure custom domain (optional)
10. Confirm SNS email subscription (for feed notifications)
11. Run `generate-esp32-config.sh` to download IoT certificates
12. Edit `secrets.h` with WiFi credentials
13. Edit `iot-pet-feeder.ino` with API Gateway URL
14. Flash firmware to ESP32
15. Assemble hardware components
16. Access web dashboard and create admin password
17. Subscribe to CloudWatch alarm notifications (recommended)

### Step 1: Clone Repository

```bash
git clone https://github.com/arthur-bryan/iot-pet-feeder.git
cd iot-pet-feeder
```

### Step 2: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your credentials
vim .env
```

**Required environment variables in `.env`:**

```bash
AWS_DEFAULT_REGION=us-east-2
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=<your-aws-access-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret-key>
GITHUB_TOKEN=<your-github-personal-access-token>
```

**Security Note:** The `.env` file is gitignored and should never be committed. Rotate credentials if accidentally exposed.

### Step 3: Configure Terraform Variables

```bash
# Copy terraform variables template
cp infra/terraform/environments/dev/terraform.tfvars.example \
   infra/terraform/environments/dev/terraform.tfvars

# Edit configuration
vim infra/terraform/environments/dev/terraform.tfvars
```

**Required terraform.tfvars configuration:**

```hcl
# Project Configuration
project_name    = "iot-pet-feeder"
environment     = "dev"
aws_region      = "us-east-2"
python_version  = "python3.13"

# GitHub Configuration (required for Amplify frontend)
github_repo_name = "iot-pet-feeder"
github_owner     = "<your-github-username>"
github_token     = "<your-github-personal-access-token>"

# Admin Configuration
admin_email = "<your-email@example.com>"

# Custom Domain (optional - leave empty if not using)
custom_domain_name = ""           # e.g., "api.yourdomain.com"
certificate_arn    = ""           # ACM certificate ARN in us-east-2
```

### Step 4: Setup Terraform Backend

Before running `terraform init`, create the S3 bucket and DynamoDB table for Terraform state management.

```bash
# From project root directory
cd /path/to/iot-pet-feeder

# Load environment variables
set -a && source .env && set +a

# Create S3 bucket and DynamoDB table for Terraform state
bash infra/scripts/setup_tf_backend.sh
```

This script will:
1. Create S3 bucket: `iot-pet-feeder-terraform-state-<region>`
2. Enable versioning on the bucket
3. Create DynamoDB table: `iot-pet-feeder-terraform-lock`
4. Initialize Terraform with the backend configuration

### Step 5: Deploy Infrastructure

```bash
# Navigate to terraform directory
cd infra/terraform/environments/dev

# Load environment and plan deployment
set -a && source ../../../../.env && set +a && terraform plan -out=plan

# Apply deployment
set -a && source ../../../../.env && set +a && export TF_VAR_github_token=$GITHUB_TOKEN && terraform apply plan
```

**Expected outputs:**

```
api_gateway_invoke_url = "https://xxxxx.execute-api.us-east-2.amazonaws.com/dev"
amplify_frontend_url = "https://dev.dxxxxxxxxx.amplifyapp.com"
iot_data_plane_endpoint = "xxxxx-ats.iot.us-east-2.amazonaws.com"
cognito_user_pool_id = "us-east-2_xxxxxxxxx"
ses_sender_email = "iot-pet-feeder@yourdomain.com"
ses_domain_verification_token = "xxxxxxxxxxxx"
ses_dkim_tokens = ["token1", "token2", "token3"]
```

Save these outputs for the next steps.

### Step 6: Configure SES Email Sending

AWS SES (Simple Email Service) is used to send transactional emails (user approval notifications, feed alerts, etc.).

#### Understanding SES Sandbox vs Production Mode

**SANDBOX MODE (default - current status):**
- Can send FROM verified domains/addresses
- Can only send TO verified email addresses (recipient must verify)
- Limited to 200 emails per day
- Maximum send rate: 1 email per second
- No AWS approval required
- Same cost as production mode

**PRODUCTION MODE (requires AWS approval):**
- Can send FROM verified domains/addresses
- Can send TO any email address (no verification needed)
- Higher limits: 50,000 emails per day
- Higher send rate: 14 emails per second
- Requires AWS approval (24-48 hours)
- Same cost as sandbox mode

**Cost (both modes):**
- First 62,000 emails/month: **FREE** (AWS Free Tier, first 12 months)
- After free tier: **$0.10 per 1,000 emails**
- For 3 feeds/day: **~$0.27/month** (90 emails)
- **No additional charges for production mode**

#### Domain Verification (Already Configured)

Terraform automatically verifies your domain for sending emails:

```bash
# Check domain verification status
aws ses get-identity-verification-attributes \
  --identities yourdomain.com \
  --region us-east-2
```

#### Option A: Stay in Sandbox Mode (Development)

For testing, you can manually verify recipient email addresses:

```bash
# Verify a recipient email address
aws ses verify-email-identity \
  --region us-east-2 \
  --email-address user@example.com
```

The user will receive a verification email and must click the link.

#### Option B: Request Production Access (Recommended)

Production access must be requested via AWS CLI:

```bash
aws sesv2 put-account-details \
  --region us-east-2 \
  --production-access-enabled \
  --mail-type TRANSACTIONAL \
  --website-url "https://dev.dxxxxxxxxx.amplifyapp.com" \
  --use-case-description "IoT Pet Feeder application that sends transactional emails: user approval notifications with temporary passwords, feed notifications, and system alerts. Estimated volume: 10-50 emails per day." \
  --additional-contact-email-addresses "your-email@example.com"
```

**What happens next:**
1. AWS will review your request (usually 24-48 hours)
2. You'll receive an email with the decision
3. Once approved, you can send emails to ANY address

**Check production access status:**
```bash
aws sesv2 get-account --region us-east-2 --query 'ProductionAccessEnabled'
```

### Step 7: Configure DNS for SES (Email Delivery)

To ensure reliable email delivery and avoid spam filters, configure these DNS records:

**Get your DNS values:**
```bash
cd infra/terraform/environments/dev
terraform output ses_domain_verification_token
terraform output ses_dkim_tokens
```

**Add to your DNS provider (Route53 or external):**

1. **Domain Verification TXT Record:**
   ```
   Type: TXT
   Name: _amazonses.yourdomain.com
   Value: <ses_domain_verification_token>
   ```

2. **DKIM CNAME Records (3 records):**
   ```
   Type: CNAME
   Name: <dkim-token-1>._domainkey.yourdomain.com
   Value: <dkim-token-1>.dkim.amazonses.com

   Type: CNAME
   Name: <dkim-token-2>._domainkey.yourdomain.com
   Value: <dkim-token-2>.dkim.amazonses.com

   Type: CNAME
   Name: <dkim-token-3>._domainkey.yourdomain.com
   Value: <dkim-token-3>.dkim.amazonses.com
   ```

3. **SPF Record (recommended):**
   ```
   Type: TXT
   Name: yourdomain.com
   Value: "v=spf1 include:amazonses.com ~all"
   ```

4. **DMARC Record (recommended):**
   ```
   Type: TXT
   Name: _dmarc.yourdomain.com
   Value: "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com"
   ```

**Verify DNS propagation:**
```bash
# Check domain verification
dig +short TXT _amazonses.yourdomain.com

# Check DKIM records
dig +short CNAME <dkim-token-1>._domainkey.yourdomain.com
```

### Step 8: Setup Amplify Frontend

The Terraform deployment creates the Amplify app, but you need to connect it to GitHub manually (one-time setup).

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Find your app: `iot-pet-feeder-dev`
3. Click on the app
4. Click "Connect branch"
5. Select GitHub as source
6. Authorize AWS Amplify (if not already done)
7. Select repository: `arthur-bryan/iot-pet-feeder`
8. Select branch: `dev`
9. Click "Save and deploy"

Amplify will automatically build and deploy on every push to the `dev` branch.

**Access frontend:**
```bash
cd infra/terraform/environments/dev
terraform output amplify_frontend_url
```

### Step 9: Confirm SNS Subscription

After deployment, you will receive an email from AWS SNS to confirm your subscription for feed notifications.

1. Check your inbox for email from `no-reply@sns.amazonaws.com`
2. Click the **"Confirm subscription"** link
3. You will now receive notifications when feeds occur

### Step 10: Configure ESP32

The ESP32 requires IoT certificates and configuration generated from Terraform outputs.

```bash
# From project root directory
cd /path/to/iot-pet-feeder

# Load environment
set -a && source .env && set +a

# Generate secrets.h with IoT certificates
bash infra/scripts/generate-esp32-config.sh
```

This script will:
1. Extract IoT endpoint and Thing name from Terraform outputs
2. Download device certificate and private key from AWS Secrets Manager
3. Download Amazon Root CA certificate
4. Generate `firmware/esp32-feeder/iot-pet-feeder/secrets.h`

**Edit WiFi credentials** in `firmware/esp32-feeder/iot-pet-feeder/secrets.h`:

```cpp
const char* WIFI_SSID = "<your-wifi-ssid>";
const char* WIFI_PASSWORD = "<your-wifi-password>";
```

**Update API endpoint** in `firmware/esp32-feeder/iot-pet-feeder/iot-pet-feeder.ino` (line 13):

```cpp
const char* API_BASE_URL = "https://<your-api-id>.execute-api.us-east-2.amazonaws.com/dev/api/v1/config";
```

To get your API Gateway ID:
```bash
cd infra/terraform/environments/dev
terraform output api_gateway_invoke_url
# Output: https://fk40h8b7gf.execute-api.us-east-2.amazonaws.com/dev
# Use "fk40h8b7gf" as your API ID
```

### Step 11: Flash ESP32 Firmware

**Using Arduino IDE:**

1. Open `firmware/esp32-feeder/iot-pet-feeder/iot-pet-feeder.ino`
2. Install ESP32 board support:
   - Go to **File > Preferences**
   - Add to "Additional Board Manager URLs": `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Go to **Tools > Board > Boards Manager**
   - Search for "esp32" and install "ESP32 by Espressif Systems"
3. Install required libraries via **Sketch > Include Library > Manage Libraries**:
   - MQTT by Joel Gaehwiler
   - ArduinoJson by Benoit Blanchon
   - HX711 Arduino Library by Bogdan Necula
   - ESP32Servo by Kevin Harrington
4. Select board: **Tools > Board > ESP32 Arduino > ESP32 Dev Module**
5. Connect ESP32 via USB
6. Select port: **Tools > Port > /dev/ttyUSB0** (or equivalent)
7. Click **Upload**

### Step 12: Hardware Assembly

Wire components according to the diagram below:

```
ESP32 Pin   ->   Component
---------------------------------
GPIO 25     ->   Servo Signal (orange wire)
GPIO 13     ->   HX711 DOUT (data out)
GPIO 14     ->   HX711 SCK (clock)
GPIO 27     ->   Button (one side)
GPIO 32     ->   Green LED positive (+ 220Ω resistor)
GPIO 33     ->   Red LED positive (+ 220Ω resistor)
5V          ->   Servo VCC (red wire)
              ->   HW-131 Power Supply output
3.3V        ->   HX711 VCC
GND         ->   Servo GND (brown wire)
              ->   HX711 GND
              ->   Button (other side)
              ->   Green LED negative (via resistor)
              ->   Red LED negative (via resistor)
              ->   HW-131 Ground
```

**Power supply setup:**
- Connect HW-131 to mains power (110V/220V)
- HW-131 output (5V/2A) connects to ESP32 5V and GND
- Use barrel jack or JST connector for clean connection

**Load cell calibration:**
1. Open Serial Monitor (115200 baud)
2. Place known weight (e.g., 100g)
3. Adjust `CALIBRATION_FACTOR` in firmware until reading matches

### Step 13: Verify Deployment

1. **Check ESP32 connection:**
   - Open Serial Monitor (115200 baud)
   - Verify WiFi connection
   - Verify AWS IoT Core connection
   - Watch for MQTT messages

2. **Access web dashboard:**
   ```bash
   cd infra/terraform/environments/dev
   terraform output amplify_frontend_url
   ```

3. **Create admin account:**
   - Visit frontend URL
   - Click "Sign Up"
   - Enter your admin email (must match `admin_email` in terraform.tfvars)
   - Check email for temporary password
   - Login and change password

4. **Test feed:**
   - Click "Feed Now" button
   - Green LED should blink
   - Servo should activate
   - Check feed history

### Step 14: Subscribe to CloudWatch Alarms (Recommended)

CloudWatch alarms monitor system health. To receive notifications:

```bash
cd infra/terraform/environments/dev

# Get subscription command
terraform output alarm_subscription_command

# Subscribe with your email
aws sns subscribe \
  --topic-arn $(terraform output -raw alarm_notification_topic_arn) \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --region us-east-2
```

Check email and confirm subscription.

---

## Custom Domain Setup (Optional)

To use a custom domain for your API (e.g., `api.yourdomain.com`):

### 1. Create ACM Certificate

```bash
# Certificate must be in the same region as API Gateway
aws acm request-certificate \
  --domain-name api.yourdomain.com \
  --validation-method DNS \
  --region us-east-2
```

### 2. Validate Certificate

Add the CNAME records provided by ACM to your DNS:

```bash
# Get validation CNAME records
aws acm describe-certificate \
  --certificate-arn <certificate-arn> \
  --region us-east-2
```

### 3. Update Terraform Configuration

Edit `terraform.tfvars`:

```hcl
custom_domain_name = "api.yourdomain.com"
certificate_arn    = "arn:aws:acm:us-east-2:xxxxx:certificate/xxxxx"
```

### 4. Apply Terraform

```bash
terraform apply
```

### 5. Configure DNS

Get the regional domain name from Terraform output:

```bash
terraform output regional_domain_name
terraform output regional_zone_id
```

Create an A record (ALIAS) in Route53 or CNAME in external DNS:

**Route53:**
```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id <your-zone-id> \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.yourdomain.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "<regional_zone_id>",
          "DNSName": "<regional_domain_name>",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

**External DNS:**
```
Type: CNAME
Name: api.yourdomain.com
Value: <regional_domain_name>
```

---

## Teardown and Cleanup

To completely destroy all AWS resources:

```bash
cd infra/terraform/environments/dev

# Load environment
set -a && source ../../../../.env && set +a

# Destroy all resources
terraform destroy
```

**Manual cleanup required:**

After `terraform destroy`, these resources remain:

1. **S3 Terraform State Bucket**:
   ```bash
   aws s3 rm s3://iot-pet-feeder-terraform-state-us-east-2 --recursive
   aws s3api delete-bucket --bucket iot-pet-feeder-terraform-state-us-east-2 --region us-east-2
   ```

2. **DynamoDB Lock Table**:
   ```bash
   aws dynamodb delete-table --table-name iot-pet-feeder-terraform-lock --region us-east-2
   ```

3. **ACM Certificates** (if created for custom domain):
   ```bash
   aws acm delete-certificate --certificate-arn <cert-arn> --region us-east-2
   ```

4. **Local files**:
   - `firmware/esp32-feeder/iot-pet-feeder/secrets.h`
   - `infra/terraform/environments/dev/terraform.tfvars`
   - `.env`

---

## Hardware Setup

### Component Connections

```
ESP32 Pin   ->   Component
---------------------------------
GPIO 25     ->   Servo Motor (signal wire)
GPIO 13     ->   HX711 DOUT (data)
GPIO 14     ->   HX711 SCK (clock)
GPIO 27     ->   Push Button (one terminal)
GPIO 32     ->   Green LED anode (+ 220Ω resistor to GND)
GPIO 33     ->   Red LED anode (+ 220Ω resistor to GND)
5V          ->   Servo Motor VCC
              ->   HW-131 5V output
3.3V        ->   HX711 VCC
GND         ->   All component grounds
              ->   Push Button (other terminal)
              ->   LED cathodes (via resistors)
              ->   HW-131 ground
```

### Load Cell Calibration

Default calibration factor: `-1093.94`

To recalibrate:
1. Open Serial Monitor (115200 baud)
2. Remove all weight from scale
3. Note the raw reading
4. Place known weight (e.g., 100g)
5. Calculate: `new_factor = old_factor * (known_weight / reading)`
6. Update `CALIBRATION_FACTOR` in firmware
7. Re-flash ESP32

---

## API Reference

### Interactive Documentation

- **Swagger UI**: `https://<api-url>/docs.html`
- **ReDoc**: `https://<api-url>/redoc.html`

Both provide interactive API exploration with request/response examples.

### Base URL

```
https://<api-id>.execute-api.<region>.amazonaws.com/dev
```

### Authentication

All endpoints require Cognito JWT token in Authorization header:

```
Authorization: Bearer <id-token>
```

### Feed Control

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/v1/feeds` | POST | Trigger manual feed | Required |
| `/api/v1/feed-events` | GET | Get feed history (paginated) | Required |
| `/api/v1/feed-events` | DELETE | Delete all feed events | Required |

**Trigger Feed:**

```bash
curl -X POST https://<api>/api/v1/feeds \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"requested_by": "user@example.com", "mode": "api"}'
```

### Device Status

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/v1/status` | GET | Get current device status | Required |
| `/api/v1/status/request` | POST | Request real-time status update | Required |

### Schedules

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/v1/schedules` | GET | List all schedules | Required |
| `/api/v1/schedules` | POST | Create schedule | Required |
| `/api/v1/schedules/{id}` | GET | Get schedule details | Required |
| `/api/v1/schedules/{id}` | PUT | Update schedule | Required |
| `/api/v1/schedules/{id}` | DELETE | Delete schedule | Required |

**Create Schedule:**

```bash
curl -X POST https://<api>/api/v1/schedules \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "scheduled_time": "2025-12-15T14:00:00Z",
    "recurrence": "daily",
    "feed_cycles": 1,
    "timezone": "America/New_York"
  }'
```

### Configuration

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/v1/config/{key}` | GET | Get config value | Required |
| `/api/v1/config/{key}` | PUT | Update config value | Required |

**Available Config Keys:**
- `SERVO_OPEN_HOLD_DURATION_MS` (1000-10000 ms)
- `WEIGHT_THRESHOLD_G` (50-5000 g)

### User Management (Admin Only)

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/v1/users` | GET | List all users | Admin |
| `/api/v1/users/pending` | GET | List pending access requests | Admin |
| `/api/v1/users/request-access` | POST | Request account access | None |
| `/api/v1/users/{email}/approve` | POST | Approve user | Admin |
| `/api/v1/users/{email}/reject` | POST | Reject user | Admin |
| `/api/v1/users/{email}` | DELETE | Delete user | Admin |

---

## Project Structure

```
iot-pet-feeder/
├── backend/
│   ├── app/
│   │   ├── api/v1/routes/        # API endpoints
│   │   │   ├── feed.py           # Feed control
│   │   │   ├── schedule.py       # Schedule management
│   │   │   ├── status.py         # Device status
│   │   │   ├── config.py         # Configuration
│   │   │   ├── users.py          # User management
│   │   │   └── notifications.py  # Email notifications
│   │   ├── crud/                 # Database operations
│   │   ├── models/               # Pydantic models
│   │   ├── services/             # Business logic
│   │   └── core/                 # Auth, IoT, hardware adapter
│   ├── tests/                    # Test suite (100% coverage)
│   ├── *_handler.py              # Lambda entry points
│   ├── requirements.txt          # Production dependencies
│   └── requirements-dev.txt      # Development dependencies
├── firmware/
│   └── esp32-feeder/
│       └── iot-pet-feeder/
│           ├── iot-pet-feeder.ino  # Main firmware
│           └── secrets.h.example   # Template for secrets
├── frontend/
│   └── web-control-panel/
│       ├── public/
│       │   ├── index.html        # Main dashboard
│       │   ├── schedules.html    # Schedule management
│       │   ├── settings.html     # Settings & config
│       │   ├── admin.html        # Admin panel
│       │   ├── docs.html         # Swagger UI
│       │   └── redoc.html        # ReDoc API docs
│       ├── tests/                # Frontend tests
│       └── amplify.yml           # Amplify build config
├── infra/
│   ├── scripts/                  # Deployment automation
│   │   ├── setup_tf_backend.sh   # Terraform state setup
│   │   └── generate-esp32-config.sh  # IoT cert download
│   └── terraform/
│       ├── environments/
│       │   └── dev/              # Dev environment config
│       └── modules/              # Reusable Terraform modules
├── .env.example                  # Environment template
├── pyproject.toml                # Python project config
├── LICENSE                       # MIT License
└── README.md
```

---

## Development

### Prerequisites

- **Python 3.13+** (required)
- **python3-venv** package (`sudo apt install python3-venv`)
- **Node.js 18+** (for frontend development)

### Setup Development Environment

```bash
# Clone repository
git clone https://github.com/arthur-bryan/iot-pet-feeder.git
cd iot-pet-feeder

# Backend setup
python3 -m venv backend/venv
source backend/venv/bin/activate
pip install -r backend/requirements.txt
pip install -r backend/requirements-dev.txt

# Frontend setup
cd frontend/web-control-panel
npm install
```

### Code Quality

**Backend:**
- **ruff** - Linting and formatting (PEP 8)
- **mypy** - Type checking
- **pytest** - Testing with 100% coverage

```bash
# Run linter
ruff check backend/

# Run type checker
mypy backend/

# Format code
ruff format backend/
```

**Frontend:**
- **ESLint** - JavaScript linting
- **Vitest** - Unit testing
- **Playwright** - E2E testing

```bash
cd frontend/web-control-panel

# Run linter
npm run lint

# Run tests
npm test

# Run E2E tests
npm run test:e2e
```

---

## Testing

### Backend Tests

```bash
# Activate virtual environment
source backend/venv/bin/activate

# Run all tests
cd backend
python -m pytest -v

# Run with coverage
python -m pytest --cov=app --cov-report=html --cov-fail-under=100

# Run specific test file
python -m pytest tests/test_feed_routes.py -v
```

**Current coverage: 100%** (345 tests)

### Frontend Tests

```bash
cd frontend/web-control-panel

# Unit tests
npm test

# E2E tests
npm run test:e2e

# Coverage report
npm run coverage
```

---

## Troubleshooting

### ESP32 Issues

**WiFi connection fails:**
- Verify 2.4GHz network (ESP32 doesn't support 5GHz)
- Check credentials in `secrets.h`
- Ensure stable 5V/2A power supply (HW-131)
- Check Serial Monitor for error messages

**AWS IoT connection fails:**
- Verify certificates are complete in `secrets.h`
- Check IoT endpoint matches Terraform output
- Ensure Thing name is correct
- Test TLS connection: `openssl s_client -connect <endpoint>:8883`

**HX711 not responding:**
- Check wiring (DOUT→GPIO13, SCK→GPIO14)
- Verify 3.3V power to HX711
- Try different load cell
- Power cycle the ESP32

### AWS Issues

**API returns 502:**
- Check Lambda logs in CloudWatch
- Verify Lambda environment variables
- Check API Gateway integration

**Cognito authentication fails:**
- Verify user exists in User Pool
- Check user is in correct group (admin/users)
- Verify JWT token is valid

**SES emails not sending:**
- Verify domain in SES console
- Check DKIM records are configured
- Verify recipient email (if in sandbox)
- Check CloudWatch logs for Lambda errors

**Terraform apply fails:**
```bash
# Verify credentials
aws sts get-caller-identity

# Re-initialize Terraform
terraform init -reconfigure

# Apply with debug logging
TF_LOG=DEBUG terraform apply
```

**Amplify build fails:**
- Check build logs in Amplify Console
- Verify GitHub connection
- Check `amplify.yml` configuration

### Frontend Issues

**Login fails:**
- Clear browser cache and cookies
- Check network tab for API errors
- Verify Cognito User Pool ID in env-config.js

**Dashboard not loading:**
- Check API Gateway URL is correct
- Verify CORS settings in API Gateway
- Check browser console for errors

---

## Security

### Authentication & Authorization

- **AWS Cognito** - User authentication with email verification
- **JWT Verification** - All API endpoints validate Cognito-issued tokens
- **Role-Based Access Control** - Admin and user groups with different permissions
- **Schedule Ownership** - Users can only modify their own schedules
- **Email Redaction** - Non-admin users see redacted emails in feed history

### Data Protection

- **TLS 1.2+** - All API and MQTT traffic encrypted
- **DynamoDB Encryption** - Data at rest encryption enabled
- **Point-in-Time Recovery** - Automatic backups on all DynamoDB tables
- **Secrets Manager** - IoT certificates stored securely
- **Secure Password Delivery** - Temporary passwords sent via SES (never in API responses)

### Monitoring & Alerting

- **CloudWatch Alarms** - Lambda errors, API 5xx, high latency
- **Execution History** - All schedule executions logged
- **SNS Notifications** - Alerts for system issues

### Best Practices

- **Least Privilege IAM** - Each Lambda has minimal required permissions
- **Environment Isolation** - Separate dev/prd environments
- **No Secrets in Code** - All secrets via environment variables or AWS services
- **Input Validation** - All API inputs validated with Pydantic

---

## Cost Estimation

Approximate monthly cost for typical usage (3 feeds/day):

### Option 1: Without Custom Domain (Basic Setup)

| Service | Usage | Cost |
|---------|-------|------|
| AWS Lambda | ~6K requests | $0.02 |
| AWS IoT Core | ~18K messages | $0.09 |
| API Gateway | ~200 requests | $0.01 |
| DynamoDB | ~1GB storage + 300 writes | $0.35 |
| Amplify Hosting | Static site + build minutes | $0.15 |
| SNS | ~3 emails/month | $0.00 |
| SES | ~3 emails/month | $0.00 |
| CloudWatch | Logs + metrics | $0.25 |
| Secrets Manager | 2 secrets (IoT certificates) | $0.80 |
| **Total** | | **~$1.70/month** |

### Option 2: With Custom Domain (Production Setup)

| Service | Usage | Cost |
|---------|-------|------|
| AWS Lambda | ~6K requests | $0.02 |
| AWS IoT Core | ~18K messages | $0.09 |
| API Gateway | ~200 requests | $0.01 |
| DynamoDB | ~1GB storage + 300 writes | $0.35 |
| Amplify Hosting | Static site + build minutes | $0.15 |
| SNS | ~3 emails/month | $0.00 |
| SES | ~3 emails/month | $0.00 |
| CloudWatch | Logs + metrics | $0.25 |
| Secrets Manager | 2 secrets (IoT certificates) | $0.80 |
| **Route53** | **1 hosted zone** | **$0.50** |
| **ACM Certificate** | **SSL/TLS cert** | **$0.00** |
| **Total** | | **~$2.20/month** |

**Notes:**
- AWS Free Tier covers most costs for the first 12 months
- Secrets Manager: $0.40/secret/month (required for IoT certificate storage)
- Route53: $0.50/hosted zone/month (only if using custom domain)
- ACM certificates are free
- SES: First 62,000 emails/month FREE (AWS Free Tier), then $0.10/1,000 emails
  - Sandbox mode vs Production mode: **same cost**
  - 3 feeds/day = ~90 emails/month = $0.00 (within free tier)
- Costs scale linearly with feed frequency

**Cost optimization tips:**
- CloudWatch log retention: 7 days (configurable - reduce to 3 days to save ~$0.10/month)
- DynamoDB: Pay-per-request pricing (no minimum charge)
- Lambda: 256MB memory (sufficient for current workload)
- Disable SNS/SES notifications if not needed (saves ~$0.01/month)

---

## License

MIT License - See [LICENSE](LICENSE) file for details.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Make changes and add tests
4. Run linter and tests:
   ```bash
   ruff check backend/
   pytest --cov=app --cov-fail-under=100
   ```
5. Commit changes (`git commit -m 'Add new feature'`)
6. Push to branch (`git push origin feature/new-feature`)
7. Open a Pull Request

---

## Acknowledgments

Built with:
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [Terraform](https://www.terraform.io/) - Infrastructure as Code
- [AWS IoT Core](https://aws.amazon.com/iot-core/) - MQTT broker and device management
- [ESP32](https://www.espressif.com/) - Microcontroller platform
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [AWS Amplify](https://aws.amazon.com/amplify/) - Frontend hosting and CI/CD
