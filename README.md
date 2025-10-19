# IoT Pet Feeder 🐾


[![AWS IoT](https://img.shields.io/badge/AWS-IoT%20Core-orange.svg)](https://aws.amazon.com/iot-core/)
[![ESP32](https://img.shields.io/badge/Device-ESP32-blue.svg)](https://www.espressif.com/en/products/socs/esp32)
[![Python](https://img.shields.io/badge/Backend-Python%203.12-green.svg)](https://www.python.org/)
[![Terraform](https://img.shields.io/badge/IaC-Terraform-purple.svg)](https://www.terraform.io/)

An intelligent, cloud-connected pet feeder with advanced behavioral analytics, event-driven architecture, and real-time weight monitoring. Built on AWS serverless infrastructure with ESP32 hardware.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Hardware Setup](#hardware-setup)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [API Reference](#api-reference)
- [Analytics & Monitoring](#analytics--monitoring)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

---

## Overview

The **IoT Pet Feeder** is a production-ready, full-stack IoT application that automates pet feeding with intelligent behavioral tracking. The system combines embedded firmware, serverless cloud architecture, and real-time analytics to provide:

- **Smart Weight Monitoring**: Tracks food consumption patterns with HX711 load cell
- **Behavioral Analytics**: Distinguishes between manual feeds, pet consumption, and refills
- **Event-Driven Architecture**: Publishes status updates only on actual state changes (90% reduction in MQTT messages)
- **Adaptive Configuration**: MQTT-based config updates with NVS caching for offline resilience
- **Real-time Control**: Web dashboard with adaptive polling (1-3s intervals)

This project demonstrates enterprise-grade IoT practices including Infrastructure as Code, secure MQTT over TLS, and comprehensive observability.

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
                                    │ • Pre-signup Handler (Cognito) │
                                    └────────┬──────────────┬────────┘
                                             │              │
                                    ┌────────▼──────┐  ┌────▼─────────┐
                                    │   DynamoDB    │  │   Cognito    │
                                    │               │  │              │
                                    │ • Feed History│  │ • User Pools │
                                    │ • Status Data │  │ • Auth       │
                                    │ • Config      │  └──────────────┘
                                    └───────────────┘
                                             ▲
                                             │ HTTPS/REST
                                    ┌────────┴──────────┐
                                    │  API Gateway      │
                                    │  (REST API)       │
                                    └────────┬──────────┘
                                             │
                                             ▼
                                    ┌─────────────────────┐
                                    │   Web Frontend      │
                                    │                     │
                                    │ • React/Vanilla JS  │
                                    │ • Tailwind CSS      │
                                    │ • Amplify Hosting   │
                                    └─────────────────────┘
```

### Event-Driven Data Flow

```
ESP32 Firmware                  AWS Cloud                    DynamoDB
──────────────                  ─────────                    ────────

Weight Change (±5g)
     │
     ├─► Check threshold
     │   (prevent spam)
     │
     ├─► Determine event:
     │   • Consumption (-Xg)
     │   • Refill (+Xg)
     │
     └──► MQTT publish ──────► IoT Rule ─────► Lambda ──────► Store event
          petfeeder/feed_event   (trigger)     (logger)        {
                                                                 event_type,
                                                                 weight_before_g,
                                                                 weight_after_g,
                                                                 weight_delta_g
                                                               }

Config Update
     │
     └──► API Call ──────────► Lambda ────────► MQTT publish
          (user/schedule)       (handler)        petfeeder/config
                                                      │
                                                      └────► ESP32 receives
                                                             └─► Save to NVS
                                                                 (persist across reboots)
```

---

## Key Features

### Device Intelligence

- **Adaptive Weight Monitoring**
  - HX711 24-bit ADC load cell with median filtering (5 samples)
  - Configurable detection threshold (default ±5g)
  - Rate limiting (max 1 event per 5 seconds) to prevent spam
  - Automatic event classification: consumption vs. refill

- **Event-Driven Status Publishing**
  - Publishes only on actual state changes (network, servo, weight)
  - 10-minute heartbeat for health monitoring
  - 90% reduction in MQTT messages vs. periodic polling

- **Smart Configuration Management**
  - MQTT push-based updates (no HTTP polling)
  - NVS (Non-Volatile Storage) caching for offline resilience
  - Hot-reload without firmware restart

- **Robust Hardware Control**
  - Servo motor with configurable open/hold duration
  - Physical button override with debouncing
  - Graceful WiFi/MQTT reconnection with exponential backoff

### Backend Services

- **Behavioral Analytics Engine**
  - Event classification: `manual_feed`, `consumption`, `refill`, `scheduled_feed`
  - Weight tracking with before/after/delta measurements
  - Queryable feed history with pagination
  - Migration support for legacy data

- **Configuration API**
  - Dynamic servo duration adjustment
  - Weight threshold configuration
  - MQTT broadcast on config changes

- **Serverless Architecture**
  - FastAPI on AWS Lambda with Python 3.9
  - DynamoDB for NoSQL storage with Decimal type handling
  - IoT Rules for event routing
  - Cognito pre-signup handler for user validation

### Frontend Experience

- **Adaptive Polling Strategy**
  - Normal mode: 3-second status updates
  - Aggressive mode: 1-second updates after user actions (15s duration)
  - Auto-pause when browser tab hidden (Page Visibility API)

- **Rich Data Visualization**
  - Event type icons and color coding
  - Weight change indicators (⬆️ refill / ⬇️ consumption)
  - Before → After weight display
  - Real-time status badges

- **Responsive Design**
  - Tailwind CSS for modern UI
  - Mobile-friendly layout
  - Toast notifications for user feedback

---

## Technology Stack

### Firmware Layer

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Microcontroller** | ESP32 (Espressif) | WiFi + Bluetooth SoC with dual-core processor |
| **Language** | Arduino C++ | Firmware development |
| **Networking** | WiFiClientSecure | TLS 1.2 encrypted connections |
| **MQTT Client** | MQTT by Joel Gaehwiler | AWS IoT Core communication |
| **Storage** | Preferences (NVS) | Non-volatile config persistence |
| **Servo Control** | ESP32Servo | PWM-based motor control |
| **Scale Interface** | HX711 (custom) | 24-bit ADC for load cell |

### Backend Layer

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | FastAPI 0.95+ | High-performance async REST API |
| **Runtime** | Python 3.9 | AWS Lambda runtime |
| **AWS SDK** | Boto3 | AWS service integration |
| **Database** | DynamoDB | NoSQL document store |
| **IoT Messaging** | AWS IoT Core | MQTT broker with device shadows |
| **API Gateway** | AWS API Gateway | RESTful HTTP interface |
| **Authentication** | AWS Cognito | User pools & authorization |
| **Compute** | AWS Lambda | Serverless function execution |

### Frontend Layer

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Core** | Vanilla JavaScript (ES6+) | DOM manipulation & API calls |
| **Styling** | Tailwind CSS 3.x | Utility-first CSS framework |
| **HTTP Client** | Fetch API | RESTful API communication |
| **Hosting** | AWS Amplify | CI/CD + static site hosting |

### Infrastructure Layer

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **IaC** | Terraform 1.x | Declarative infrastructure provisioning |
| **State Backend** | S3 + DynamoDB | Terraform state lock & storage |
| **Secrets** | AWS Secrets Manager | Certificate & credential management |
| **Deployment** | GitHub Actions (planned) | CI/CD pipeline |

---

## Project Structure

```
iot-pet-feeder/
│
├── firmware/
│   └── esp32-feeder/
│       └── iot-pet-feeder/
│           └── iot-pet-feeder.ino      # Main ESP32 firmware (943 lines)
│
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI application entry
│   │   ├── api/v1/routes/
│   │   │   ├── feed.py                 # Feed control endpoints
│   │   │   ├── status.py               # Device status endpoints
│   │   │   └── config.py               # Configuration endpoints
│   │   ├── crud/
│   │   │   ├── feed.py                 # DynamoDB feed operations
│   │   │   └── config.py               # DynamoDB config operations
│   │   ├── models/
│   │   │   ├── feed.py                 # Pydantic feed models
│   │   │   ├── schedule.py             # Pydantic schedule models
│   │   │   └── config.py               # Pydantic config models
│   │   ├── services/
│   │   │   └── feed_service.py         # Business logic layer
│   │   ├── core/
│   │   │   ├── config.py               # Application settings
│   │   │   └── iot.py                  # AWS IoT Core client
│   │   └── db/
│   │       └── client.py               # DynamoDB client
│   ├── feed_event_logger.py            # Lambda: Process MQTT feed events
│   ├── status_updater.py               # Lambda: Update device status
│   ├── pre_sign_up_handler.py          # Lambda: Cognito user validation
│   ├── migrate_feed_history.py         # Migration: Add event_type field
│   └── requirements.txt
│
├── frontend/
│   └── web-control-panel/
│       ├── public/
│       │   ├── index.html              # Main application page
│       │   └── js/
│       │       └── index.js            # Frontend application logic
│       └── amplify.yml                 # Amplify build configuration
│
├── infra/
│   ├── terraform/
│   │   ├── environments/dev/
│   │   │   ├── main.tf                 # Environment-specific config
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   └── modules/
│   │       ├── lambda/                 # Lambda function module
│   │       ├── lambda_layer/           # Python dependencies layer
│   │       ├── api_gateway/            # API Gateway module
│   │       ├── iot_device/             # IoT thing + certificate
│   │       ├── iot_rule/               # IoT rules for routing
│   │       ├── amplify_app/            # Frontend hosting
│   │       └── cognito_user_pool/      # User authentication
│   └── scripts/
│       └── setup_tf_backend.sh         # Initialize Terraform backend
│
└── README.md                            # This file
```

---

## Hardware Setup

### Required Components

| Component | Specification | Quantity |
|-----------|---------------|----------|
| ESP32 Development Board | ESP32-WROOM-32 or compatible | 1 |
| Servo Motor | SG90 or MG995 (5V, 180°) | 1 |
| Load Cell | 5kg HX711 strain gauge | 1 |
| HX711 ADC Module | 24-bit ADC breakout board | 1 |
| Push Button | Momentary tactile switch | 1 |
| Power Supply | 5V 2A USB or barrel jack | 1 |
| Jumper Wires | Male-to-female | ~15 |

### Pin Configuration

```cpp
// Servo Motor
#define SERVO_PIN 13

// HX711 Load Cell
#define HX711_DOUT_PIN 16
#define HX711_SCK_PIN 4

// Manual Feed Button
#define BUTTON_PIN 15

// Power & Ground
// Connect 5V and GND to ESP32 VIN and GND
```

### Wiring Diagram

```
┌─────────────────────────────────────────────────┐
│              ESP32-WROOM-32                     │
│                                                 │
│  GPIO 13 ────────────────► Servo (Signal)      │
│  5V ──────────────────────► Servo (VCC)        │
│  GND ─────────────────────► Servo (GND)        │
│                                                 │
│  GPIO 16 ────────────────► HX711 (DOUT)        │
│  GPIO 4 ─────────────────► HX711 (SCK)         │
│  3.3V ────────────────────► HX711 (VCC)        │
│  GND ─────────────────────► HX711 (GND)        │
│                                                 │
│  GPIO 15 ────────────────► Button (one side)   │
│  GND ─────────────────────► Button (other side)│
│                                                 │
└─────────────────────────────────────────────────┘

HX711 Connections:
  E+ (Red) ───────► Load Cell Red Wire
  E- (Black) ─────► Load Cell Black Wire
  A+ (White) ─────► Load Cell White Wire
  A- (Green) ─────► Load Cell Green Wire
```

### Assembly Notes

1. **Servo Mounting**: Secure servo motor to dispenser mechanism with 3D-printed bracket or hot glue
2. **Load Cell Placement**: Mount under food bowl platform, ensure flat surface
3. **Wire Management**: Use heat shrink tubing and cable ties to prevent vibration issues
4. **Power Supply**: Ensure stable 5V supply; servos can draw 500mA+ under load
5. **Button Debouncing**: Firmware includes 50ms debounce; add 10kΩ pull-up resistor if needed

---

## Quick Start

### Prerequisites

- **Hardware**: Assembled ESP32 feeder with components from [Hardware Setup](#hardware-setup)
- **AWS Account**: With permissions for IoT Core, Lambda, DynamoDB, API Gateway, Cognito
- **Development Tools**:
  - Arduino IDE 1.8.x or Platform.IO
  - Python 3.9+
  - Terraform 1.x
  - Node.js 16+ (for frontend tooling)

### 1. Firmware Setup

```bash
# Install Arduino IDE libraries
# - WiFiClientSecure (built-in)
# - MQTT by Joel Gaehwiler
# - ESP32Servo
# - Preferences (built-in)

# Open firmware/esp32-feeder/iot-pet-feeder/iot-pet-feeder.ino

# Configure WiFi credentials (lines 20-21)
const char* WIFI_SSID = "YourNetworkName";
const char* WIFI_PASSWORD = "YourNetworkPassword";

# Configure AWS IoT endpoint (line 24)
const char* AWS_IOT_ENDPOINT = "xxxxxx-ats.iot.us-east-2.amazonaws.com";

# Add AWS certificates (lines 30-80)
# - Root CA (Amazon Root CA 1)
# - Device Certificate (from AWS IoT Core)
# - Device Private Key (from AWS IoT Core)

# Upload to ESP32
# Board: ESP32 Dev Module
# Upload Speed: 921600
# Flash Frequency: 80MHz
```

### 2. Backend Deployment

```bash
# Navigate to infrastructure
cd infra/terraform/environments/dev

# Initialize Terraform backend
../../scripts/setup_tf_backend.sh

# Configure variables
cp terraform.tfvars.example terraform.tfvars
# Edit: AWS region, project name, environment

# Deploy infrastructure
terraform init
terraform plan
terraform apply

# Note outputs for frontend configuration
terraform output api_endpoint
terraform output cognito_user_pool_id
terraform output cognito_client_id
```

### 3. Frontend Deployment

```bash
cd frontend/web-control-panel

# Update public/js/index.js with Terraform outputs
const API_BASE_URL = '<terraform_output_api_endpoint>';
const COGNITO_USER_POOL_ID = '<terraform_output_cognito_user_pool_id>';
const COGNITO_CLIENT_ID = '<terraform_output_cognito_client_id>';

# Deploy to Amplify (automatic via amplify.yml on git push)
# Or manually:
zip -r build.zip public/
# Upload to Amplify Console
```

### 4. First Feed Test

```bash
# Create Cognito user
aws cognito-idp sign-up \
  --client-id <COGNITO_CLIENT_ID> \
  --username admin@example.com \
  --password YourSecurePassword123!

# Confirm user (admin action)
aws cognito-idp admin-confirm-sign-up \
  --user-pool-id <COGNITO_USER_POOL_ID> \
  --username admin@example.com

# Open web dashboard
# https://<amplify-app-id>.amplifyapp.com

# Click "Feed Now" button
# Verify ESP32 activates servo and logs event
```

---

## Configuration

### ESP32 Firmware Configuration

#### WiFi Settings
Located at `firmware/esp32-feeder/iot-pet-feeder/iot-pet-feeder.ino:20-21`

```cpp
const char* WIFI_SSID = "YourNetwork";
const char* WIFI_PASSWORD = "YourPassword";
```

#### AWS IoT Settings
Lines 24-80 in firmware:

```cpp
const char* AWS_IOT_ENDPOINT = "xxxxxx-ats.iot.us-east-2.amazonaws.com";
const int AWS_IOT_PORT = 8883;

// MQTT Topics
const char* MQTT_COMMAND_TOPIC = "petfeeder/commands";
const char* MQTT_STATUS_TOPIC = "petfeeder/status";
const char* MQTT_FEED_EVENT_TOPIC = "petfeeder/feed_event";
const char* MQTT_CONFIG_TOPIC = "petfeeder/config";
```

#### Hardware Pin Configuration
Lines 82-87:

```cpp
#define SERVO_PIN 13
#define HX711_DOUT_PIN 16
#define HX711_SCK_PIN 4
#define BUTTON_PIN 15
```

#### Tunable Parameters
Lines 89-100:

```cpp
// Servo timing (configurable via API)
unsigned long SERVO_OPEN_HOLD_DURATION_MS = 3000;  // 3 seconds

// Weight thresholds (configurable via API)
float WEIGHT_THRESHOLD_G = 450.0;  // Max food weight before deny
const float WEIGHT_CHANGE_THRESHOLD_G = 5.0;  // Minimum change to trigger event

// Timing intervals
const unsigned long STATUS_PUBLISH_INTERVAL_MS = 600000;  // 10-minute heartbeat
const unsigned long WEIGHT_PUBLISH_COOLDOWN_MS = 5000;    // 5s rate limit

// HX711 calibration
const long HX711_CALIBRATION_FACTOR = -7050;  // Adjust per load cell
```

### Backend Configuration

#### Environment Variables
Set in Terraform (`infra/terraform/modules/lambda/main.tf`) or AWS Console:

```bash
# DynamoDB Tables
DYNAMO_FEED_HISTORY_TABLE=iot-pet-feeder-feed-history-dev
DYNAMO_STATUS_TABLE=iot-pet-feeder-status-dev
DYNAMO_CONFIG_TABLE=iot-pet-feeder-config-dev

# AWS IoT Core
IOT_ENDPOINT=xxxxxx-ats.iot.us-east-2.amazonaws.com
IOT_TOPIC_STATUS=petfeeder/status
IOT_TOPIC_COMMAND=petfeeder/commands
IOT_TOPIC_CONFIG=petfeeder/config

# AWS Region
AWS_REGION=us-east-2
```

#### Runtime Configuration (DynamoDB Config Table)
Modify via API or AWS Console:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `SERVO_DURATION_MS` | Integer | 3000 | Servo open duration (milliseconds) |
| `WEIGHT_THRESHOLD_G` | Float | 450.0 | Max food weight before denying feed |

### Frontend Configuration

#### API Endpoint
`frontend/web-control-panel/public/js/index.js:3`

```javascript
const API_BASE_URL = 'https://xxxxxx.execute-api.us-east-2.amazonaws.com/prod';
```

#### Polling Intervals
Lines 550-570:

```javascript
const NORMAL_POLLING_INTERVAL_MS = 3000;      // 3 seconds
const AGGRESSIVE_POLLING_INTERVAL_MS = 1000;  // 1 second
const AGGRESSIVE_POLLING_DURATION_S = 15;     // 15 seconds after action
```

---

## Deployment

### Infrastructure Deployment (Terraform)

#### Step 1: Setup Terraform Backend

```bash
cd infra/scripts
./setup_tf_backend.sh

# This creates:
# - S3 bucket: iot-pet-feeder-terraform-state-<random>
# - DynamoDB table: iot-pet-feeder-terraform-lock
```

#### Step 2: Configure Environment

```bash
cd ../terraform/environments/dev

# Create terraform.tfvars
cat <<EOF > terraform.tfvars
aws_region = "us-east-2"
project_name = "iot-pet-feeder"
environment = "dev"
cognito_admin_email = "admin@example.com"
EOF
```

#### Step 3: Deploy

```bash
terraform init -backend-config="bucket=<S3_BUCKET_NAME>"
terraform plan -out=plan
terraform apply plan

# Save outputs
terraform output -json > outputs.json
```

#### Resources Created

- **IoT Core**: Thing, certificate, policy, rules (3 rules for feed events, status, commands)
- **Lambda**: 4 functions (API, feed logger, status updater, Cognito pre-signup)
- **Lambda Layer**: Python dependencies (boto3, FastAPI, Mangum)
- **API Gateway**: REST API with 12 endpoints across 3 routes
- **DynamoDB**: 3 tables (feed history, status, config) with PAY_PER_REQUEST billing
- **Cognito**: User pool with email verification
- **Amplify**: Frontend hosting with custom domain support
- **IAM**: Least-privilege roles for all services

### Frontend Deployment (AWS Amplify)

#### Option A: Git-Based CI/CD (Recommended)

```bash
# Push to GitHub
git add .
git commit -m "Deploy frontend"
git push origin main

# Amplify auto-deploys via amplify.yml
```

#### Option B: Manual Deployment

```bash
cd frontend/web-control-panel
zip -r build.zip public/

# Upload to Amplify Console:
# 1. AWS Console → Amplify → Apps → iot-pet-feeder-web
# 2. Manual deploy → Upload build.zip
```

### Backend Deployment (Lambda)

Terraform handles Lambda deployment automatically. For manual updates:

```bash
cd backend

# Package dependencies
pip install -r requirements.txt -t ./package
cd package
zip -r ../lambda_package.zip .
cd ..

# Add application code
zip -g lambda_package.zip app/ -r
zip -g lambda_package.zip feed_event_logger.py status_updater.py pre_sign_up_handler.py

# Update Lambda
aws lambda update-function-code \
  --function-name iot-pet-feeder-api-dev \
  --zip-file fileb://lambda_package.zip
```

---

## API Reference

Base URL: `https://<api-id>.execute-api.<region>.amazonaws.com/prod`

### Authentication

All endpoints require AWS Cognito authentication via Bearer token:

```bash
Authorization: Bearer <ID_TOKEN>
```

### Endpoints

#### Feed Control

**POST /api/v1/feed**

Trigger immediate feed event.

Request:
```json
{
  "requested_by": "user@example.com",
  "mode": "manual"
}
```

Response (200 OK):
```json
{
  "feed_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "sent",
  "requested_by": "user@example.com",
  "mode": "manual",
  "timestamp": "2025-10-17T14:30:00.000Z",
  "event_type": "manual_feed"
}
```

Response (403 Forbidden - Weight Exceeded):
```json
{
  "feed_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "denied_weight_exceeded",
  "requested_by": "user@example.com",
  "mode": "manual",
  "timestamp": "2025-10-17T14:30:00.000Z",
  "event_type": "manual_feed"
}
```

**GET /api/v1/feed/history**

Retrieve paginated feed history.

Query Parameters:
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 10): Items per page

Response (200 OK):
```json
{
  "items": [
    {
      "feed_id": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": "2025-10-17T14:30:00.000Z",
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

#### Device Status

**GET /api/v1/status**

Get current device status.

Response (200 OK):
```json
{
  "timestamp": "2025-10-17T14:35:00.000Z",
  "current_weight_g": 403.2,
  "servo_state": "closed",
  "wifi_connected": true,
  "mqtt_connected": true,
  "event_type": "heartbeat"
}
```

#### Configuration

**GET /api/v1/config/{config_key}**

Retrieve specific configuration value.

Path Parameters:
- `config_key` (string): `SERVO_DURATION_MS` or `WEIGHT_THRESHOLD_G`

Response (200 OK):
```json
{
  "config_key": "SERVO_DURATION_MS",
  "value": 3000,
  "last_updated": "2025-10-17T10:00:00.000Z"
}
```

**PUT /api/v1/config/{config_key}**

Update configuration (broadcasts to ESP32 via MQTT).

Path Parameters:
- `config_key` (string): `SERVO_DURATION_MS` or `WEIGHT_THRESHOLD_G`

Request:
```json
{
  "value": 5000
}
```

Response (200 OK):
```json
{
  "config_key": "SERVO_DURATION_MS",
  "value": 5000,
  "last_updated": "2025-10-17T14:40:00.000Z",
  "mqtt_published": true
}
```

---

## Analytics & Monitoring

### Behavioral Insights

The system automatically classifies and tracks events:

#### Event Types

| Event Type | Description | Weight Change | Example Use Case |
|------------|-------------|---------------|------------------|
| `manual_feed` | User-triggered via API/button | N/A | Track user feeding patterns |
| `consumption` | Pet ate food (weight decreased) | Negative | Measure meal sizes and frequency |
| `refill` | Food container refilled | Positive | Track refill intervals |
| `scheduled_feed` | Automated schedule trigger | N/A | Verify scheduled feeds |

#### Sample Analytics Queries

**Average meal size (last 7 days)**:
```python
import boto3
from datetime import datetime, timedelta

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('iot-pet-feeder-feed-history-dev')

# Scan for consumption events
response = table.scan(
    FilterExpression='event_type = :type AND #ts > :week_ago',
    ExpressionAttributeNames={'#ts': 'timestamp'},
    ExpressionAttributeValues={
        ':type': 'consumption',
        ':week_ago': (datetime.utcnow() - timedelta(days=7)).isoformat()
    }
)

meals = [abs(item['weight_delta_g']) for item in response['Items']]
avg_meal = sum(meals) / len(meals)
print(f"Average meal size: {avg_meal:.1f}g")
```

**Feeding frequency analysis**:
```sql
-- Athena query (if DynamoDB export enabled)
SELECT
  DATE_TRUNC('day', timestamp) as feed_date,
  COUNT(*) as total_feeds,
  SUM(CASE WHEN event_type = 'manual_feed' THEN 1 ELSE 0 END) as manual_feeds,
  SUM(CASE WHEN event_type = 'consumption' THEN 1 ELSE 0 END) as pet_meals
FROM feed_history
WHERE timestamp >= CURRENT_DATE - INTERVAL '30' DAY
GROUP BY DATE_TRUNC('day', timestamp)
ORDER BY feed_date DESC;
```

### CloudWatch Monitoring

Automatic metrics logged by Lambda functions:

- **Lambda Invocations**: Request count per endpoint
- **Lambda Duration**: Execution time percentiles (p50, p95, p99)
- **Lambda Errors**: Exception count with error types
- **DynamoDB Metrics**: Read/write capacity, throttles
- **IoT Core Metrics**: MQTT messages published/received

**Set up CloudWatch Alarms**:

```bash
# High error rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name iot-pet-feeder-high-errors \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-2:123456789012:alerts
```

---

## Security

### ESP32 Device Security

- **TLS 1.2 Encryption**: All MQTT communication encrypted with AWS IoT Root CA
- **Certificate-Based Auth**: X.509 client certificates for device authentication
- **Topic Policy**: IoT policy restricts publish/subscribe to device-specific topics
- **Credential Storage**: Private keys stored in firmware (consider ESP32 secure boot in production)

### Backend Security

- **API Authentication**: All endpoints require valid Cognito JWT tokens
- **IAM Least Privilege**: Lambda functions have minimal required permissions
- **VPC Isolation**: DynamoDB accessed via VPC endpoints (if configured)
- **Secrets Management**: Certificates stored in AWS Secrets Manager
- **CORS Policy**: API Gateway restricts origins to Amplify domain

### Best Practices

1. **Rotate Certificates**: Regenerate IoT device certificates every 90 days
2. **Enable CloudTrail**: Log all API calls for audit trail
3. **MFA for Users**: Enforce multi-factor authentication in Cognito
4. **Encrypt at Rest**: Enable DynamoDB encryption with AWS KMS
5. **Rate Limiting**: API Gateway throttling (10,000 req/s burst, 5,000 steady-state)

---

## Troubleshooting

### ESP32 Issues

#### Scale Reading Timeouts
**Symptom**: `⚠ Sample 1/5 timeout (continuing...)` in serial monitor

**Causes**:
1. Loose HX711 wiring (most common)
2. Insufficient power supply
3. Servo vibration disrupting connections

**Solutions**:
```cpp
// 1. Check physical connections
// - Re-seat all HX711 wires
// - Verify 3.3V power stable
// - Add 100µF capacitor between VCC/GND

// 2. Increase timeout
#define HX711_TIMEOUT_MS 2000  // Increase from 1000ms

// 3. Add delay after servo movement
servoMotor.write(SERVO_CLOSE_ANGLE);
delay(500);  // Let vibrations settle
```

#### MQTT Connection Failures
**Symptom**: `❌ AWS IoT connection failed`

**Solutions**:
```bash
# 1. Verify certificate validity
openssl x509 -in device_cert.pem -noout -dates

# 2. Check IoT endpoint
nslookup xxxxxx-ats.iot.us-east-2.amazonaws.com

# 3. Validate IoT policy allows publish/subscribe
aws iot get-policy --policy-name iot-pet-feeder-device-policy-dev
```

#### Weight Calibration
**Symptom**: Incorrect weight readings

**Procedure**:
```cpp
// 1. Tare with empty bowl
// 2. Place known weight (e.g., 500g)
// 3. Adjust calibration factor
const long HX711_CALIBRATION_FACTOR = -7050;  // Adjust until reading matches

// 4. Re-upload firmware and verify
```

### Backend Issues

#### Lambda Timeout
**Symptom**: API Gateway 504 errors

**Solutions**:
```bash
# Increase Lambda timeout in Terraform
resource "aws_lambda_function" "api" {
  timeout = 30  # Increase from 15 seconds
}

# Check CloudWatch logs
aws logs tail /aws/lambda/iot-pet-feeder-api-dev --follow
```

#### DynamoDB Throttling
**Symptom**: `ProvisionedThroughputExceededException`

**Solutions**:
```hcl
# Switch to on-demand billing (already configured)
resource "aws_dynamodb_table" "feed_history" {
  billing_mode = "PAY_PER_REQUEST"  # No throttling
}
```

### Frontend Issues

#### CORS Errors
**Symptom**: `Access-Control-Allow-Origin` errors in browser console

**Solutions**:
```python
# backend/app/main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://<amplify-domain>.amplifyapp.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### Stale Data Display
**Symptom**: Feed history not updating

**Solutions**:
```javascript
// Clear browser cache
localStorage.clear();
sessionStorage.clear();

// Enable aggressive polling temporarily
startAggressivePolling(60);  // 60 seconds at 1s intervals

// Check API response in Network tab
```

---

## Roadmap

### Phase 1: Core Enhancements (Q1 2025)

- [x] Event-driven status publishing
- [x] MQTT-based configuration
- [x] Behavioral analytics with weight tracking
- [ ] **Scheduled feeds**: EventBridge-triggered automated feeding
- [ ] **Multi-device support**: Manage multiple feeders from one account
- [ ] **Mobile app**: React Native iOS/Android client

### Phase 2: Advanced Features (Q2 2025)

- [ ] **Computer vision**: Camera module to detect pet presence (ESP32-CAM)
- [ ] **Portion control**: Precise gram-based dispensing
- [ ] **Voice integration**: Alexa/Google Home skills
- [ ] **Historical charts**: D3.js visualizations for consumption trends
- [ ] **Low food alerts**: SNS notifications when weight < threshold
- [ ] **OTA updates**: Over-the-air firmware updates via AWS IoT Jobs

### Phase 3: Machine Learning (Q3 2025)

- [ ] **Consumption prediction**: ML model to forecast feeding times (SageMaker)
- [ ] **Anomaly detection**: Alert on unusual eating patterns (indicating illness)
- [ ] **Optimal scheduling**: Recommend feed times based on pet behavior
- [ ] **Multi-pet recognition**: Computer vision to identify individual pets

### Phase 4: Ecosystem (Q4 2025)

- [ ] **Pet health dashboard**: Integrate with vet records and fitness trackers
- [ ] **Community features**: Share feeding schedules with other pet owners
- [ ] **Marketplace**: 3D-printable dispenser designs and hardware kits
- [ ] **API for partners**: Third-party integrations (PetCo, Chewy, etc.)

---

## Contributing

Contributions are welcome! This project follows standard open-source practices.

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/awesome-new-feature`
3. **Commit** changes: `git commit -m 'Add awesome new feature'`
4. **Push** to branch: `git push origin feature/awesome-new-feature`
5. **Submit** pull request with detailed description

### Code Standards

- **Firmware**: Follow Arduino style guide, comment complex logic
- **Backend**: PEP 8 for Python, type hints required, docstrings for all functions
- **Frontend**: ESLint with Airbnb config, JSDoc for public functions
- **Infrastructure**: Terraform fmt for formatting, validate with `terraform validate`

### Testing

```bash
# Backend unit tests (pytest)
cd backend
pytest tests/ --cov=app

# Frontend integration tests (Playwright)
cd frontend/web-control-panel
npm test

# Firmware (manual testing required)
# - Test all MQTT topics
# - Verify weight tracking accuracy
# - Check event classification logic
```

### Documentation

- Update README.md for new features
- Add docstrings/comments for complex code
- Include architecture diagrams for major changes (use diagrams.net or Mermaid)

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## Contact

**Project Maintainer**: Bryan
**Repository**: [github.com/bryan/iot-pet-feeder](https://github.com/bryan/iot-pet-feeder)
**Issues**: [github.com/bryan/iot-pet-feeder/issues](https://github.com/bryan/iot-pet-feeder/issues)

For questions, feature requests, or bug reports, please open a GitHub issue.

---

<div align="center">

**Built with ❤️ for pets and IoT enthusiasts**

![ESP32](https://img.shields.io/badge/ESP32-000000?style=for-the-badge&logo=espressif&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Terraform](https://img.shields.io/badge/Terraform-7B42BC?style=for-the-badge&logo=terraform&logoColor=white)

</div>
