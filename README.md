# IoT Pet Feeder

![IoT Pet Feeder](docs/pet-feeder.png)

> A cloud-connected smart pet feeder with automated scheduling, weight tracking, and remote control via web dashboard. Built on AWS serverless infrastructure with ESP32 hardware.

## Code Quality & Coverage

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/692d6cdfbb6b4b22a2fdb0562485f885)](https://app.codacy.com/gh/arthur-bryan/iot-pet-feeder/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
[![Codacy Badge](https://app.codacy.com/project/badge/Coverage/692d6cdfbb6b4b22a2fdb0562485f885)](https://app.codacy.com/gh/arthur-bryan/iot-pet-feeder/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_coverage)
[![Tests](https://img.shields.io/badge/tests-346%20passed-success)](backend/tests/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Technology Stack

### Backend & Cloud
[![AWS Lambda](https://img.shields.io/badge/AWS-Lambda-FF9900?logo=awslambda&logoColor=white)](https://aws.amazon.com/lambda/)
[![AWS IoT Core](https://img.shields.io/badge/AWS-IoT%20Core-FF9900?logo=amazon-aws&logoColor=white)](https://aws.amazon.com/iot-core/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![DynamoDB](https://img.shields.io/badge/AWS-DynamoDB-4053D6?logo=amazon-dynamodb&logoColor=white)](https://aws.amazon.com/dynamodb/)
[![API Gateway](https://img.shields.io/badge/AWS-API%20Gateway-FF4F8B?logo=amazon-api-gateway&logoColor=white)](https://aws.amazon.com/api-gateway/)
[![Cognito](https://img.shields.io/badge/AWS-Cognito-DD344C?logo=amazon-aws&logoColor=white)](https://aws.amazon.com/cognito/)

### Frontend & Infrastructure
[![AWS Amplify](https://img.shields.io/badge/AWS-Amplify-FF9900?logo=aws-amplify&logoColor=white)](https://aws.amazon.com/amplify/)
[![Terraform](https://img.shields.io/badge/Terraform-7B42BC?logo=terraform&logoColor=white)](https://www.terraform.io/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

### Hardware & IoT
[![ESP32](https://img.shields.io/badge/ESP32-WROOM--32U-E7352C?logo=espressif&logoColor=white)](https://www.espressif.com/en/products/socs/esp32)
[![MQTT](https://img.shields.io/badge/Protocol-MQTT-660066?logo=mqtt&logoColor=white)](https://mqtt.org/)
[![Arduino](https://img.shields.io/badge/Arduino-IDE-00979D?logo=arduino&logoColor=white)](https://www.arduino.cc/)

## System Architecture

![Architecture Diagram](docs/diagrams/iot-pet-feeder.png)

---

## Features

- **Remote Feeding** - Trigger feeds from anywhere via authenticated web dashboard
- **Weight Monitoring** - Track food consumption with load cell
- **Automated Scheduling** - One-time or recurring feeds (daily/weekly/monthly) with timezone support
- **Manual Control** - Physical push button for local operation
- **Email Notifications** - Get notified when feeds occur
- **User Management** - Admin approval system for access control
- **API Documentation** - Interactive docs at `/docs.html` and `/redoc.html`

---

## Hardware Components

| Component | Specification | Quantity |
|-----------|---------------|----------|
| Microcontroller | ESP32-WROOM-32U | 1 |
| Servo Motor | MG90S (5V, 180°) | 1 |
| Load Cell | 1kg with HX711 amplifier | 1 |
| Power Supply | HW-131 5V/2A | 1 |
| Push Button | Momentary switch | 1 |
| LEDs | Red + Green (3mm/5mm) | 2 |
| Resistors | 220Ω | 2 |
| Breadboards | Half-size or full-size | 2 |
| Jumper Wires | Male-to-male, male-to-female | ~20 |

---

## Prerequisites

**Required Tools:**
- Terraform 1.0+
- AWS CLI v2
- Python 3.13+
- jq
- Arduino IDE 2.0+

**AWS Account:**
- Admin-level permissions
- Configured AWS CLI (`aws configure`)

**GitHub:**
- Personal access token with `repo` and `admin:repo_hook` permissions

---

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/arthur-bryan/iot-pet-feeder.git
cd iot-pet-feeder
```

### 2. Configure Environment

```bash
cp .env.example .env
vim .env
```

Required `.env` variables:

```bash
AWS_DEFAULT_REGION=us-east-2
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
GITHUB_TOKEN=<your-token>
```

### 3. Configure Terraform

```bash
cp infra/terraform/environments/dev/terraform.tfvars.example \
   infra/terraform/environments/dev/terraform.tfvars
vim infra/terraform/environments/dev/terraform.tfvars
```

Required `terraform.tfvars`:

```hcl
project_name    = "iot-pet-feeder"
environment     = "dev"
aws_region      = "us-east-2"
python_version  = "python3.13"

github_repo_name = "iot-pet-feeder"
github_owner     = "<your-username>"
github_token     = "<your-token>"

admin_email = "<your-email@example.com>"

custom_domain_name = ""  # Optional
certificate_arn    = ""  # Optional
```

### 4. Deploy Infrastructure

```bash
# Setup Terraform backend
set -a && source .env && set +a
bash infra/scripts/setup_tf_backend.sh

# Deploy AWS infrastructure
cd infra/terraform/environments/dev
set -a && source ../../../../.env && set +a && terraform plan -out=plan
set -a && source ../../../../.env && set +a && export TF_VAR_github_token=$GITHUB_TOKEN && terraform apply plan
```

Save the outputs (API URL, IoT endpoint, etc.).

### 5. Configure SES (Email)

**Option A: Sandbox Mode (Development)**
Manually verify recipient emails:

```bash
aws ses verify-email-identity \
  --region us-east-2 \
  --email-address user@example.com
```

**Option B: Production Mode (Recommended)**
Request production access to send to any email:

```bash
aws sesv2 put-account-details \
  --region us-east-2 \
  --production-access-enabled \
  --mail-type TRANSACTIONAL \
  --website-url "https://dev.dxxxxxxxxx.amplifyapp.com" \
  --use-case-description "IoT Pet Feeder - sends user approvals and feed notifications"
```

### 6. Setup Amplify Frontend

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Find app: `iot-pet-feeder-dev`
3. Connect to GitHub repository
4. Select branch: `dev`
5. Save and deploy

### 7. Configure ESP32

Generate IoT certificates:

```bash
cd /path/to/iot-pet-feeder
set -a && source .env && set +a
bash infra/scripts/generate-esp32-config.sh
```

Edit WiFi credentials in `firmware/esp32-feeder/iot-pet-feeder/secrets.h`:

```cpp
const char* WIFI_SSID = "<your-ssid>";
const char* WIFI_PASSWORD = "<your-password>";
```

Update API endpoint in `firmware/esp32-feeder/iot-pet-feeder/iot-pet-feeder.ino`:

```cpp
const char* API_BASE_URL = "https://<api-id>.execute-api.us-east-2.amazonaws.com/dev/api/v1/config";
```

### 8. Flash ESP32 Firmware

**Arduino IDE:**
1. Open `iot-pet-feeder.ino`
2. Install ESP32 board support (add URL: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`)
3. Install libraries: MQTT, ArduinoJson, HX711, ESP32Servo
4. Select board: **ESP32 Dev Module**
5. Connect ESP32 via USB
6. Upload

### 9. Hardware Assembly

```
ESP32 Pin   ->   Component
---------------------------------
GPIO 25     ->   Servo Signal (orange)
GPIO 13     ->   HX711 DOUT
GPIO 14     ->   HX711 SCK
GPIO 27     ->   Button (one side)
GPIO 32     ->   Green LED + (220Ω to GND)
GPIO 33     ->   Red LED + (220Ω to GND)
5V          ->   Servo VCC + HW-131 output
3.3V        ->   HX711 VCC
GND         ->   All grounds
```

### 10. Access Dashboard

Get frontend URL:

```bash
cd infra/terraform/environments/dev
terraform output amplify_frontend_url
```

Sign up with admin email, check email for password, login.

---

## API Reference

**Interactive Docs:**
- Swagger UI: `https://<api-url>/docs.html`
- ReDoc: `https://<api-url>/redoc.html`

**Key Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/feeds` | POST | Trigger feed |
| `/api/v1/feed-events` | GET | Feed history |
| `/api/v1/schedules` | GET/POST | Manage schedules |
| `/api/v1/status` | GET | Device status |
| `/api/v1/config/{key}` | GET/PUT | Configuration |
| `/api/v1/users` | GET | User management (admin) |

All endpoints require Cognito JWT token in `Authorization: Bearer <token>` header.

---

## Teardown

```bash
cd infra/terraform/environments/dev
set -a && source ../../../../.env && set +a
terraform destroy
```

**Manual cleanup:**

```bash
# S3 backend
aws s3 rm s3://iot-pet-feeder-terraform-state-us-east-2 --recursive
aws s3api delete-bucket --bucket iot-pet-feeder-terraform-state-us-east-2 --region us-east-2

# DynamoDB lock table
aws dynamodb delete-table --table-name iot-pet-feeder-terraform-lock --region us-east-2
```

---

## Development

**Backend:**

```bash
python3 -m venv backend/venv
source backend/venv/bin/activate
pip install -r backend/requirements.txt
pip install -r backend/requirements-dev.txt

# Run tests
cd backend
python -m pytest --cov=app --cov-report=html --cov-fail-under=100
```

**Frontend:**

```bash
cd frontend/web-control-panel
npm install
npm test
```

---

## Troubleshooting

**ESP32 won't connect:**
- Use 2.4GHz WiFi (not 5GHz)
- Check power supply (5V/2A)
- Verify certificates in `secrets.h`
- Check Serial Monitor (115200 baud)

**API errors:**
- Check CloudWatch logs
- Verify Lambda environment variables
- Test with Swagger UI at `/docs.html`

**Email not sending:**
- Verify SES domain/email
- Check sandbox mode restrictions
- Review CloudWatch logs

---

## Cost Estimation

Monthly cost for typical usage (3 feeds/day):

| Service | Cost |
|---------|------|
| Lambda + IoT Core + API Gateway | ~$0.12 |
| DynamoDB | $0.35 |
| Amplify | $0.15 |
| CloudWatch | $0.25 |
| Secrets Manager | $0.80 |
| **Total** | **~$1.70/month** |

With custom domain: add $0.50 for Route53.

AWS Free Tier covers most costs for first 12 months.

---

## License

MIT License - See [LICENSE](LICENSE) file for details.

---

## Acknowledgments

Built with:
- [FastAPI](https://fastapi.tiangolo.com/) - Python web framework
- [Terraform](https://www.terraform.io/) - Infrastructure as Code
- [AWS IoT Core](https://aws.amazon.com/iot-core/) - MQTT broker
- [ESP32](https://www.espressif.com/) - Microcontroller
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [AWS Amplify](https://aws.amazon.com/amplify/) - Frontend hosting
