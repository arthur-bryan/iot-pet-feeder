import boto3
import json
from botocore.exceptions import BotoCoreError, ClientError
from typing import Literal
from app.core.config import settings

iot_client = boto3.client("iot-data", region_name=settings.AWS_REGION)


def publish_feed_command(command: str):
    try:
        iot_client.publish(
            topic=f"{settings.IOT_TOPIC_FEED}/{settings.IOT_THING_ID}",
            qos=1,
            payload=command
        )
        return True
    except (BotoCoreError, ClientError) as e:
        return False

