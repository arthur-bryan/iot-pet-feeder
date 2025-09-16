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
