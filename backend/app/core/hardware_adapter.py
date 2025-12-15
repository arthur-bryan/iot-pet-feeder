"""
Hardware Adapter - Interface for ESP32 hardware interactions via AWS IoT Core
"""
import json
import logging
import os
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class HardwareAdapter(ABC):
    """Abstract base class for hardware interactions"""

    @abstractmethod
    async def trigger_feed(self, requested_by: str, mode: str = "manual") -> dict[str, Any]:
        """Trigger a feed event (real or simulated)"""
        pass

    @abstractmethod
    async def get_device_status(self) -> dict[str, Any] | None:
        """Get current device status (real or simulated)"""
        pass

    @abstractmethod
    async def request_status_update(self) -> bool:
        """Request device to publish status (real or simulated)"""
        pass

    @abstractmethod
    async def update_config(self, config_key: str, value: Any) -> bool:
        """Update device configuration (real or simulated)"""
        pass


class ProductionHardwareAdapter(HardwareAdapter):
    """Real hardware adapter - communicates with ESP32 via IoT Core"""

    def __init__(self):
        self.iot_client = boto3.client('iot-data')
        self.iot_endpoint = os.environ['IOT_ENDPOINT']
        self.iot_topic = os.environ.get('IOT_PUBLISH_TOPIC', 'petfeeder/commands')
        self.thing_id = os.environ['IOT_THING_ID']

    async def trigger_feed(self, requested_by: str, mode: str = "manual") -> dict[str, Any]:
        """Publish MQTT command to real ESP32"""
        command = {
            "command": "FEED_NOW",
            "requested_by": requested_by,
            "mode": mode,
            "timestamp": datetime.utcnow().isoformat()
        }

        self.iot_client.publish(
            topic=self.iot_topic,
            qos=1,
            payload=json.dumps(command)
        )

        return {
            "status": "sent",
            "message": "Feed command sent to device"
        }

    async def get_device_status(self) -> dict[str, Any] | None:
        """Get status from DynamoDB (updated by IoT Rule)"""
        from app.crud.feed import get_latest_device_status
        return await get_latest_device_status()

    async def request_status_update(self) -> bool:
        """Request ESP32 to publish status"""
        from app.core.iot import request_device_status
        return await request_device_status()

    async def update_config(self, config_key: str, value: Any) -> bool:
        """Broadcast config update to ESP32 via MQTT"""
        config_topic = os.environ.get('IOT_CONFIG_TOPIC', 'petfeeder/config')

        message = {
            "config_key": config_key,
            "value": value,
            "timestamp": datetime.utcnow().isoformat()
        }

        self.iot_client.publish(
            topic=config_topic,
            qos=1,
            payload=json.dumps(message)
        )
        return True


def get_hardware_adapter() -> HardwareAdapter:
    """
    Factory function to get the hardware adapter for production ESP32 device
    """
    return ProductionHardwareAdapter()
