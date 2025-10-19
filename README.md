# IoT Pet Feeder 🐾

[![AWS IoT](https://img.shields.io/badge/AWS-IoT%20Core-orange.svg)](https://aws.amazon.com/iot-core/)
[![ESP32](https://img.shields.io/badge/Device-ESP32-blue.svg)](https://www.espressif.com/en/products/socs/esp32)
[![Python](https://img.shields.io/badge/Backend-Python%203.12-green.svg)](https://www.python.org/)
[![Terraform](https://img.shields.io/badge/IaC-Terraform-purple.svg)](https://www.terraform.io/)

A cloud-connected smart pet feeder with behavioral analytics, weight tracking, and automated scheduling. Built on AWS serverless infrastructure with ESP32 hardware.

---

## Overview

The **IoT Pet Feeder** automates pet feeding while tracking consumption patterns and providing remote control via web dashboard. The system uses an ESP32 microcontroller with load cell for weight monitoring, servo motor for dispensing, and AWS IoT Core for cloud connectivity.

### Key Features

- **Remote Feeding**: Trigger feeds from anywhere via web dashboard
- **Weight Monitoring**: Track food consumption with HX711 load cell
- **Automated Scheduling**: Set recurring feed times with cron expressions
- **Event Analytics**: Classify events as manual feeds, consumption, or refills
- **Email Notifications**: Get notified when pet is fed
- **Real-time Status**: Monitor device connectivity and current food weight
- **Event-Driven Architecture**: Publishes updates only on state changes (90% reduction in MQTT messages)
- **Offline Resilience**: Configuration cached in ESP32 NVS for offline operation

---

## Technology Stack

**Hardware:**
- ESP32-WROOM-32 microcontroller
- HX711 load cell amplifier + 5kg load cell
- SG90 servo motor
- Momentary push button

**Backend:**
- AWS Lambda (Python 3.12 + FastAPI)
- AWS IoT Core (MQTT over TLS)
- DynamoDB (on-demand billing)
- API Gateway (REST API)
- SNS (email notifications)
- EventBridge (scheduled triggers)

**Frontend:**
- Vanilla JavaScript (ES6+)
- Tailwind CSS
- AWS Amplify (hosting + CI/CD)

**Infrastructure:**
- Terraform (IaC)
- Bash scripts (automation)
- Makefile (quick commands)

---

## Quick Start

### Prerequisites

**Required Tools:**
- [Terraform](https://www.terraform.io/downloads) 1.0+
- [AWS CLI](https://aws.amazon.com/cli/) v2+
- Git, make, jq, curl

**AWS Account:**
- Admin-level permissions
- GitHub Personal Access Token

**Hardware:**
- ESP32 board, servo motor, HX711 load cell, push button
- See [Hardware Setup](#hardware-setup) for wiring details

### Deployment

**Option 1: Automated (Recommended)**

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/iot-pet-feeder.git
cd iot-pet-feeder

# Create configuration files
cp .env.example .env
cp infra/terraform/environments/dev/terraform.tfvars.example \
   infra/terraform/environments/dev/terraform.tfvars

# Edit configuration files with your values
vim .env                                           # AWS credentials
vim infra/terraform/environments/dev/terraform.tfvars  # Project settings

# Run complete setup
make setup
```

**Option 2: Step-by-Step**

```bash
# 1. Validate prerequisites
make validate

# 2. Deploy infrastructure
cd infra/terraform/environments/dev
terraform init
terraform plan -out=plan
terraform apply plan

# 3. Post-deployment verification
bash ../../scripts/post-deploy.sh

# 4. Generate ESP32 configuration
bash ../../scripts/generate-esp32-config.sh
```

### ESP32 Configuration

```bash
# Generate secrets.h with IoT certificates
make esp32-config

# Edit WiFi credentials
vim firmware/esp32-feeder/iot-pet-feeder/secrets.h
# Update: WIFI_SSID and WIFI_PASSWORD

# Flash firmware using Arduino IDE or PlatformIO
# Board: ESP32 Dev Module
# Upload Speed: 921600
```

### Deployed Resources

After deployment, the following AWS resources are created:

- **5 Lambda Functions** (API, Feed Logger, Status Updater, Schedule Executor, Notifier)
- **1 Lambda Layer** (Python dependencies)
- **1 API Gateway** (REST API)
- **1 IoT Thing** + Certificate + Policy
- **3 IoT Rules** (feed events, status updates, commands)
- **5 DynamoDB Tables** (feed history, status, schedules, config, pending users)
- **1 Amplify App** (frontend hosting)
- **2 SNS Topics** (notifications)
- **1 EventBridge Rule** (schedule executor)

### Quick Commands

```bash
make setup          # Complete first-time setup
make validate       # Pre-flight checks
make deploy         # Deploy infrastructure updates
make esp32-config   # Generate ESP32 secrets.h
make status         # Show deployment info
make logs           # Tail API Lambda logs
make clean          # Remove build artifacts
make destroy        # Tear down all infrastructure
make help           # Show all commands
```

---

## Architecture

### System Overview

```
┌─────────────────┐         MQTT/TLS          ┌──────────────────┐
│   ESP32 Device  │◄──────────────────────────►│  AWS IoT Core    │
│                 │                             │                  │
│ • Servo Motor   │    petfeeder/commands      │ • MQTT Broker    │
│ • HX711 Scale   │◄───── petfeeder/status     │ • IoT Rules      │
│ • WiFi + NVS    │◄───── petfeeder/config     │ • Device Shadow  │
│ • Button Input  │──────► petfeeder/feed_event│                  │
└─────────────────┘                             └────────┬─────────┘
                                                         │
                                                         │ IoT Rules
                                                         ▼
                                    ┌────────────────────────────────┐
                                    │    Lambda Functions            │
                                    │                                │
                                    │ • API Handler (FastAPI)        │
                                    │ • Feed Event Logger            │
                                    │ • Status Updater               │
                                    │ • Schedule Executor            │
                                    │ • Notifier                     │
                                    └────────┬──────────────┬────────┘
                                             │              │
                                    ┌────────▼──────┐  ┌────▼─────────┐
                                    │   DynamoDB    │  │     SNS      │
                                    │               │  │              │
                                    │ • Feed History│  │ • Feed Alerts│
                                    │ • Status Data │  │ • Admin Msgs │
                                    │ • Schedules   │  └──────────────┘
                                    │ • Config      │
                                    └───────────────┘
                                             ▲
                                             │ HTTPS/REST
                                    ┌────────┴──────────┐
                                    │  API Gateway      │
                                    └────────┬──────────┘
                                             │
                                             ▼
                                    ┌─────────────────────┐
                                    │   Web Frontend      │
                                    │                     │
                                    │ • Vanilla JS        │
                                    │ • Tailwind CSS      │
                                    │ • Amplify Hosting   │
                                    └─────────────────────┘
```

### Data Flow

**Manual Feed:**
1. User clicks "Feed Now" button in web dashboard
2. API Gateway → Lambda → Publishes MQTT command to IoT Core
3. ESP32 receives command → Activates servo → Publishes feed event
4. IoT Rule triggers Feed Logger Lambda → Stores event in DynamoDB
5. DynamoDB Stream triggers Notifier Lambda → Sends email via SNS

**Scheduled Feed:**
1. EventBridge triggers Schedule Executor Lambda every minute
2. Lambda checks for due schedules in DynamoDB
3. If schedule due → Publishes MQTT command
4. Flow continues same as manual feed

**Weight Change:**
1. ESP32 detects weight change (±5g threshold)
2. Publishes feed event with weight data to IoT Core
3. IoT Rule triggers Feed Logger Lambda
4. Event stored in DynamoDB with classification (consumption/refill)

---

## Hardware Setup

### Components

| Component | Specification | Qty |
|-----------|---------------|-----|
| ESP32 Board | ESP32-WROOM-32 | 1 |
| Servo Motor | SG90 (5V, 180°) | 1 |
| Load Cell | 5kg HX711 strain gauge | 1 |
| HX711 Module | 24-bit ADC | 1 |
| Push Button | Momentary switch | 1 |
| Power Supply | 5V 2A | 1 |

### Wiring

```
ESP32 Pin   →   Component
─────────────────────────
GPIO 13     →   Servo (Signal)
GPIO 16     →   HX711 (DOUT)
GPIO 4      →   HX711 (SCK)
GPIO 15     →   Button (one side)
5V          →   Servo (VCC)
3.3V        →   HX711 (VCC)
GND         →   Common Ground
```

---

## API Reference

Base URL: `https://<api-id>.execute-api.<region>.amazonaws.com/dev`

### Feed Control

#### Trigger Manual Feed
```http
POST /api/v1/feed/
Content-Type: application/json

{
  "requested_by": "user@example.com",
  "mode": "manual"
}
```

**Response:**
```json
{
  "feed_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "sent",
  "requested_by": "user@example.com",
  "mode": "manual",
  "timestamp": "2025-10-19T14:30:00.000Z",
  "event_type": "manual_feed"
}
```

#### Get Feed History
```http
GET /api/v1/feed_history/?page=1&limit=10
```

**Response:**
```json
{
  "items": [
    {
      "feed_id": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": "2025-10-19T14:30:00.000Z",
      "trigger_method": "api",
      "status": "completed",
      "event_type": "manual_feed",
      "weight_before_g": 423.5,
      "weight_after_g": 403.2,
      "weight_delta_g": -20.3
    }
  ],
  "total_items": 156,
  "page": 1,
  "limit": 10,
  "total_pages": 16
}
```

### Device Status

#### Get Current Status
```http
GET /api/v1/status/
```

**Response:**
```json
{
  "timestamp": "2025-10-19T14:35:00.000Z",
  "current_weight_g": 403.2,
  "servo_state": "closed",
  "wifi_connected": true,
  "mqtt_connected": true,
  "event_type": "heartbeat"
}
```

#### Request Status Update
```http
POST /api/v1/status/request
```

Forces ESP32 to publish current status immediately.

### Schedules

#### Create Schedule
```http
POST /api/v1/schedules
Content-Type: application/json

{
  "cron_expression": "0 8 * * *",
  "description": "Morning feed at 8 AM",
  "timezone": "America/New_York",
  "enabled": true
}
```

**Response:**
```json
{
  "schedule_id": "123e4567-e89b-12d3-a456-426614174000",
  "cron_expression": "0 8 * * *",
  "description": "Morning feed at 8 AM",
  "timezone": "America/New_York",
  "enabled": true,
  "created_at": "2025-10-19T14:00:00.000Z",
  "updated_at": "2025-10-19T14:00:00.000Z"
}
```

#### List All Schedules
```http
GET /api/v1/schedules
```

#### Get Schedule by ID
```http
GET /api/v1/schedules/{schedule_id}
```

#### Update Schedule
```http
PUT /api/v1/schedules/{schedule_id}
Content-Type: application/json

{
  "cron_expression": "0 9 * * *",
  "description": "Updated to 9 AM",
  "enabled": true
}
```

#### Delete Schedule
```http
DELETE /api/v1/schedules/{schedule_id}
```

#### Toggle Schedule Enable/Disable
```http
PATCH /api/v1/schedules/{schedule_id}/toggle
```

### Configuration

#### Get Configuration Value
```http
GET /api/v1/config/{config_key}
```

Example: `GET /api/v1/config/SERVO_DURATION_MS`

**Response:**
```json
{
  "config_key": "SERVO_DURATION_MS",
  "value": 3000,
  "last_updated": "2025-10-19T10:00:00.000Z"
}
```

#### Update Configuration
```http
PUT /api/v1/config/{config_key}
Content-Type: application/json

{
  "value": 5000
}
```

Broadcasts new configuration to ESP32 via MQTT.

**Available Config Keys:**
- `SERVO_OPEN_HOLD_DURATION_MS` - Servo open duration (1000-10000 milliseconds, 1-10 seconds)
- `WEIGHT_THRESHOLD_G` - Max food weight threshold (50-5000 grams)

### Notifications

#### Subscribe to Email Notifications
```http
POST /api/v1/notifications/subscribe
Content-Type: application/json

{
  "email": "user@example.com"
}
```

#### Unsubscribe
```http
POST /api/v1/notifications/unsubscribe
Content-Type: application/json

{
  "email": "user@example.com"
}
```

#### Get Subscription Status
```http
GET /api/v1/notifications/subscriptions/{email}
```

---

## Configuration

### Environment Variables (.env)

```bash
AWS_DEFAULT_REGION=us-east-2
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
```

### Terraform Variables (terraform.tfvars)

```hcl
# Project Configuration
project_name    = "iot-pet-feeder"
environment     = "dev"
aws_region      = "us-east-2"
python_version  = "python3.12"

# GitHub Configuration (for Amplify)
github_repo_name = "iot-pet-feeder"
github_owner     = "YOUR_GITHUB_USERNAME"
github_token     = "ghp_YOUR_GITHUB_TOKEN"

# Notifications
admin_email = "your-email@example.com"
```

### ESP32 Configuration (secrets.h)

Auto-generated by `make esp32-config`. Only WiFi credentials need manual update:

```cpp
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Auto-generated (do not edit):
// - AWS_IOT_ENDPOINT
// - THING_NAME
// - AWS_CERT_CRT (device certificate)
// - AWS_CERT_PRIVATE (private key)
// - AWS_CERT_CA (root CA)
```

---

## Project Structure

```
iot-pet-feeder/
├── backend/
│   ├── app/
│   │   ├── api/v1/routes/        # API endpoints
│   │   ├── crud/                 # Database operations
│   │   ├── models/               # Pydantic models
│   │   └── services/             # Business logic
│   ├── *_handler.py              # Lambda handlers
│   └── requirements.txt
├── firmware/
│   └── esp32-feeder/
│       └── iot-pet-feeder/
│           ├── iot-pet-feeder.ino
│           └── secrets.h.example
├── frontend/
│   └── web-control-panel/
│       ├── public/
│       │   ├── index.html
│       │   └── js/index.js
│       └── amplify.yml
├── infra/
│   ├── scripts/
│   │   ├── validate.sh
│   │   ├── setup.sh
│   │   ├── post-deploy.sh
│   │   └── generate-esp32-config.sh
│   └── terraform/
│       ├── environments/dev/
│       └── modules/
├── .env.example
├── Makefile
└── README.md
```

---

## Common Issues

### ESP32 won't connect to WiFi
- Verify WiFi credentials in `secrets.h`
- Check 2.4GHz network (ESP32 doesn't support 5GHz)
- Ensure stable power supply (5V 2A minimum)

### API returns 502 errors
- Check Lambda logs: `make logs`
- Verify Lambda layer includes all dependencies
- Run: `make deploy` to sync infrastructure

### Amplify build failed
- Manually trigger rebuild: `make amplify-rebuild`
- Check build logs in AWS Amplify Console
- Verify environment variables are set correctly

### ESP32 won't connect to AWS IoT
- Verify certificates in `secrets.h` are complete
- Check IoT endpoint matches Terraform output
- Validate device policy allows publish/subscribe

---

**Built with ❤️ for pets and IoT enthusiasts**

![ESP32](https://img.shields.io/badge/ESP32-000000?style=for-the-badge&logo=espressif&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Terraform](https://img.shields.io/badge/Terraform-7B42BC?style=for-the-badge&logo=terraform&logoColor=white)
