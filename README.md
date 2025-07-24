# IoT Pet Feeder

[![Deployment Status](https://img.shields.io/badge/Status-In%20Deployment-blue.svg)](https://github.com/your-username/iot-pet-feeder/actions)

An intelligent, cloud-connected pet feeder system enabling remote control, automated scheduling, and real-time status monitoring.

---

## Table of Contents

* [Overview](#overview)
* [Architecture](#architecture)
* [Current Status](#current-status)
* [Features](#features)
* [Technology Stack](#technology-stack)
* [Folder Structure](#folder-structure)
* [Getting Started (Local Development)](#getting-started-local-development)
* [Deployment](#deployment)
* [Contributing](#contributing)
* [License](#license)
* [Contact](#contact)

---

## Overview

The `iot-pet-feeder` project provides a comprehensive solution for automating and managing your pet's feeding schedule from anywhere. Utilizing an ESP32 microcontroller for the physical feeder mechanism and a robust AWS serverless backend, this system ensures your pets are fed on time, every time, with the convenience of remote control and detailed history tracking.

This project aims to demonstrate a full-stack IoT application, from embedded firmware to cloud infrastructure and a user-friendly web interface.

## Architecture

The system is designed with a serverless-first approach on AWS to ensure scalability, reliability, and cost-efficiency.

At a high level, the architecture includes:

* **Device Layer:** An ESP32 microcontroller connected to a servo motor, communicating with the cloud via MQTT.
* **IoT Connectivity:** AWS IoT Core acts as the central hub for secure, bi-directional communication with the ESP32.
* **Backend API:** AWS API Gateway and Lambda functions provide the RESTful interface for the web control panel, handling commands, schedules, and data storage.
* **Data Storage:** Amazon DynamoDB stores feeding history and user-defined schedules.
* **User Management:** Amazon Cognito handles secure user authentication and authorization for the web application.
* **Web Frontend:** A static web application hosted on AWS Amplify Console, providing the user interface for controlling and monitoring the feeder.
* **Notifications:** Amazon SNS for sending alerts (e.g., feeding status, low food warnings).
* **Scheduling:** Amazon EventBridge (not explicitly shown in the diagram, but planned for schedule triggers) for automated feeding events.

A detailed architecture diagram can be found in the `docs/architecture/` directory.

## Current Status

**This project is currently in the deployment phase.**

The core ESP32 firmware is functional and successfully connects to AWS IoT Core. The backend API is under active development, and the web frontend is being built. Infrastructure-as-Code (Terraform) is being implemented to automate the cloud resource provisioning.

I'm working towards a fully operational system.

## Features

* **Remote Feeding:** Trigger immediate food dispensation via the web control panel.
* **Automated Scheduling:** Create and manage recurring feeding schedules for consistent meal times.
* **Feeding History:** View a log of past feeding events, including time and quantity.
* **Real-time Device Status:** Monitor the feeder's current operational state (e.g., "ready," "opening," "closing").
* **User Authentication:** Secure access to the control panel with user accounts.
* **Notifications:** Receive email alerts for key events (e.g., successful feed, device offline).
* **Button Override:** Physical button on the device for manual feeding.

## Technology Stack

* **Firmware:**
    * **Microcontroller:** ESP32
    * **Language:** Arduino C++
    * **Libraries:** `WiFi`, `WiFiClientSecure`, `MQTTClient`, `ESP32Servo`
* **Backend (FastAPI Service):**
    * **Language:** Python
    * **Framework:** FastAPI
    * **AWS SDK:** `boto3`
    * **Deployment:** AWS Lambda, Amazon API Gateway
    * **Database:** Amazon DynamoDB
    * **Messaging:** AWS IoT Core, Amazon SNS
* **Frontend (Web Control Panel):**
    * **Languages:** HTML, CSS, JavaScript
    * **Styling:** Tailwind CSS
    * **Hosting:** AWS Amplify Console
    * **Authentication:** AWS Cognito
* **Infrastructure as Code (IaC):**
    * Terraform
* **Version Control:** Git, GitHub

## Contact

For any questions or feedback, please open an issue on this repository.

