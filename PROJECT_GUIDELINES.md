     # Project Guidelines: Smart Pet Feeder - Cloud & Embedded System

## 1. Architectural Mandate & Key Tenets

The primary goal of this project is to implement a resilient, low-latency, and cost-optimized smart pet feeder. All components must prioritize **consumption-based cost efficiency (AWS)** and **connection reliability (ESP32)** for a single-unit deployment.

**Key Tenets:**

| Layer | Primary Focus | Cost/Performance Optimization |
| :--- | :--- | :--- |
| **Embedded (ESP32)** | Connection Reliability & Responsiveness. | Optimized MQTT Keep-Alive, non-blocking main loop, aggressive idle power management. **Device Shadow utilization is mandatory.** |
| **Infrastructure (Terraform)** | Least-privilege IAM, idempotency, modularity. | **DynamoDB On-Demand capacity** for cost; leverage native IoT Core features (Device Shadow, Rules). |
| **Backend (Python/Lambda)** | Cold-start latency, memory/CPU allocation efficiency. | Minimal external dependencies; fast initialization routines, minimal execution time. |

## 2. System Component Roles and Directory Structure

The project is divided into four distinct components, each with its own repository/directory for clear separation of concerns.

| Component | Path                          | Technology Stack | Purpose |
| :--- |:------------------------------| :--- | :--- |
| **Infrastructure** | `/infra/terraform`            | Terraform (HCL) | Provisioning of AWS resources (IoT Core, Lambda, API Gateway, DynamoDB). |
| **Backend Logic** | `/backend/`                   | Python (3.12+), AWS SDK | API handlers, **managing the Device Shadow**, and feeder scheduling logic. |
| **Embedded Firmware** | `/firmware`                   | C++/Arduino (`.ino`) | Low-level control of motors/sensors, continuous Wi-Fi/MQTT management, **shadow reporting/listening.** |
| **Frontend UI** | `/frontend/web-control-panel` | HTML, CSS (Tailwind via CDN), JavaScript (Vanilla) | User interface for monitoring and manual feed requests via API Gateway. |

## 3. Layer-Specific Best Practices and Optimization

### 3.1. Embedded Firmware (`.ino` / ESP32) - Responsiveness & Reliability

* **Continuous Connection:** Maintain a stable, continuous MQTT connection using an optimized **Keep-Alive interval** (e.g., 60-120 seconds) to minimize overhead while ensuring connection status.
* **Device Shadow Protocol:** The ESP32 must implement the AWS IoT Device Shadow protocol.
    * **Reporting (`update`):** Publish status changes (`weight`, `consumption`, `refill`) to the shadow's `reported` state immediately upon event detection.
    * **Listening (`delta`):**