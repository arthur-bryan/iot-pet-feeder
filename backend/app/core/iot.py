import json
import asyncio
import boto3
from botocore.exceptions import ClientError
from typing import Literal
from app.core.config import settings
import os

# Initialize boto3 IoT Data Plane client globally
# This client is synchronous, so its calls will be wrapped in run_in_executor.
# It will automatically pick up credentials from Lambda's execution role.
iot_client = boto3.client(
    "iot-data",
    region_name=settings.AWS_REGION,
    endpoint_url=f"https://{settings.IOT_ENDPOINT}"
)


async def publish_feed_command(command: str) -> bool:
    if not settings.IOT_ENDPOINT:
        print("Error: AWS IoT Endpoint is not configured in app.core.config.py.")
        return False

    try:
        loop = asyncio.get_event_loop()
        # Run the synchronous boto3 publish call in a separate thread
        print(command)
        await loop.run_in_executor(
            None,
            lambda: iot_client.publish(
                topic=settings.IOT_TOPIC_FEED,
                qos=0,
                payload=command
            )
        )
        print(f"Successfully published command to topic '{settings.IOT_TOPIC_FEED}': {command}")
        return True
    except ClientError as e:
        print(f"Error publishing MQTT message via boto3: {e}")
        return False
    except Exception as e:
        print(f"An unexpected error occurred during MQTT publish: {e}")
        return False


async def request_device_status() -> bool:
    """
    Publishes a GET_STATUS command to request real-time device status.
    The ESP32 will respond by publishing to petfeeder/status topic.
    """
    if not settings.IOT_ENDPOINT:
        print("Error: AWS IoT Endpoint is not configured in app.core.config.py.")
        return False

    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: iot_client.publish(
                topic=settings.IOT_TOPIC_FEED,
                qos=0,
                payload="GET_STATUS"
            )
        )
        print(f"Successfully published GET_STATUS command to topic '{settings.IOT_TOPIC_FEED}'")
        return True
    except ClientError as e:
        print(f"Error publishing GET_STATUS message via boto3: {e}")
        return False
    except Exception as e:
        print(f"An unexpected error occurred during GET_STATUS publish: {e}")
        return False


async def publish_config_update(config_key: str, value: int) -> bool:
    """
    Publishes configuration updates to the ESP32 via MQTT.
    The device subscribes to petfeeder/config and updates its cached values.

    Args:
        config_key: Configuration key (e.g., "SERVO_OPEN_HOLD_DURATION_MS")
        value: New configuration value

    Returns:
        bool: True if publish succeeded, False otherwise
    """
    if not settings.IOT_ENDPOINT:
        print("Error: AWS IoT Endpoint is not configured.")
        return False

    try:
        # Build JSON payload with the config update
        payload = json.dumps({
            config_key: value
        })

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: iot_client.publish(
                topic=settings.IOT_TOPIC_CONFIG,
                qos=1,  # QoS 1 for reliable delivery
                payload=payload
            )
        )
        print(f"Successfully published config update to '{settings.IOT_TOPIC_CONFIG}': {payload}")
        return True
    except ClientError as e:
        print(f"Error publishing config update via boto3: {e}")
        return False
    except Exception as e:
        print(f"An unexpected error occurred during config publish: {e}")
        return False
