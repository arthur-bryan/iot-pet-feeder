"""Configuration API routes."""

import decimal
import logging
from typing import Any

from fastapi import APIRouter, Body, HTTPException

from app.core.iot import publish_config_update
from app.crud.config import fetch_config_setting, update_config_setting
from app.models.config import ConfigItem, ConfigUpdate

logger = logging.getLogger(__name__)
router = APIRouter()

# Default fallback values (must match ESP32 constants)
DEFAULT_HOLD_DURATION_MS = 3000
DEFAULT_WEIGHT_THRESHOLD_G = 450

# Validation bounds for configuration values
SERVO_DURATION_MIN_MS = 1000
SERVO_DURATION_MAX_MS = 5000
WEIGHT_THRESHOLD_MIN_G = 100
WEIGHT_THRESHOLD_MAX_G = 1000


@router.get(
    "/config/{key}",
    response_model=ConfigItem,
    summary="Get configuration setting",
    description="""
    Retrieves a device configuration value by key.

    **Supported keys**:
    - `SERVO_OPEN_HOLD_DURATION_MS`: Feeding duration (1000-5000ms, default 3000ms)
    - `WEIGHT_THRESHOLD_G`: Low food alert threshold (100-1000g, default 450g)
    - `EMAIL_NOTIFICATIONS`: Email notification preferences (JSON)

    **Defaults**: Returns default value if key not found in database

    **Use case**: Get current device settings before modification
    """,
    responses={
        200: {
            "description": "Configuration value retrieved",
            "content": {
                "application/json": {
                    "example": {
                        "config_key": "SERVO_OPEN_HOLD_DURATION_MS",
                        "value": 3000
                    }
                }
            }
        },
        404: {
            "description": "Configuration key not found and has no default",
            "content": {
                "application/json": {
                    "example": {"detail": "Configuration key 'INVALID_KEY' not found and has no default value."}
                }
            }
        }
    }
)
async def get_config_setting(key: str) -> dict[str, str | Any]:
    config_key = key.upper()

    # Use the imported CRUD function
    item = await fetch_config_setting(config_key)

    if item:
        # Convert DynamoDB's Decimal type back to a standard integer for the client
        if isinstance(item.get('value'), decimal.Decimal):
            item['value'] = int(item['value'])

        return item

    # --- FALLBACK LOGIC ---
    if config_key == "SERVO_OPEN_HOLD_DURATION_MS":
        # Return the default value if the key is not found in DB
        return {
            "config_key": config_key,
            "value": DEFAULT_HOLD_DURATION_MS
        }

    if config_key == "WEIGHT_THRESHOLD_G":
        # Return the default value if the key is not found in DB
        return {
            "config_key": config_key,
            "value": DEFAULT_WEIGHT_THRESHOLD_G
        }

    if config_key == "EMAIL_NOTIFICATIONS":
        # Return default email notification config (disabled, no email, all types enabled by default except pet_ate)
        return {
            "config_key": config_key,
            "value": '{"email":"","enabled":false,"subscription_arn":"","preferences":{"pet_ate":false,"feedings":true,"failures":true}}'
        }

    raise HTTPException(status_code=404, detail=f"Configuration key '{key}' not found and has no default value.")


@router.put(
    "/config/{key}",
    response_model=ConfigItem,
    summary="Update configuration setting",
    description="""
    Updates a device configuration value and publishes change to ESP32 via MQTT.

    **Supported keys and validation**:
    - `SERVO_OPEN_HOLD_DURATION_MS`: Integer 1000-5000 (milliseconds)
    - `WEIGHT_THRESHOLD_G`: Integer 100-1000 (grams)
    - `EMAIL_NOTIFICATIONS`: JSON string with email config

    **Real-time sync**: Changes are published to MQTT topic `petfeeder/config` for ESP32 to consume

    **Persistence**: Values stored in DynamoDB for durability

    **Effect**: Device behavior changes immediately after MQTT delivery (~1-2 seconds)
    """,
    responses={
        200: {
            "description": "Configuration updated successfully",
            "content": {
                "application/json": {
                    "example": {
                        "config_key": "SERVO_OPEN_HOLD_DURATION_MS",
                        "value": 4000
                    }
                }
            }
        },
        400: {
            "description": "Validation error (value out of range or invalid type)",
            "content": {
                "application/json": {
                    "examples": {
                        "duration_out_of_range": {
                            "summary": "Duration out of valid range",
                            "value": {"detail": "Duration must be between 1000 ms and 5000 ms."}
                        },
                        "invalid_type": {
                            "summary": "Invalid value type",
                            "value": {"detail": "Value must be a valid integer."}
                        }
                    }
                }
            }
        },
        500: {
            "description": "Server error (DynamoDB write failure, MQTT publish failure)",
            "content": {
                "application/json": {
                    "example": {"detail": "Failed to update configuration"}
                }
            }
        }
    }
)
async def set_config_setting(key: str, update_data: ConfigUpdate = Body(...)):
    config_key = key.upper()

    if config_key == "SERVO_OPEN_HOLD_DURATION_MS":
        try:
            value_int = int(update_data.value)
            if not SERVO_DURATION_MIN_MS <= value_int <= SERVO_DURATION_MAX_MS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Duration must be between {SERVO_DURATION_MIN_MS} ms and {SERVO_DURATION_MAX_MS} ms."
                )

            updated_item = await update_config_setting(config_key, value_int)
            mqtt_success = await publish_config_update(config_key, value_int)
            if mqtt_success:
                logger.info("Config update published via MQTT: %s=%s", config_key, value_int)
            else:
                logger.warning("Failed to publish config update to MQTT")

            return updated_item

        except ValueError:
            raise HTTPException(status_code=400, detail="Value must be a valid integer.") from None

    if config_key == "WEIGHT_THRESHOLD_G":
        try:
            value_int = int(update_data.value)
            if not WEIGHT_THRESHOLD_MIN_G <= value_int <= WEIGHT_THRESHOLD_MAX_G:
                raise HTTPException(
                    status_code=400,
                    detail=f"Weight threshold must be between {WEIGHT_THRESHOLD_MIN_G}g and {WEIGHT_THRESHOLD_MAX_G}g."
                )

            updated_item = await update_config_setting(config_key, value_int)
            mqtt_success = await publish_config_update(config_key, value_int)
            if mqtt_success:
                logger.info("Config update published via MQTT: %s=%s", config_key, value_int)
            else:
                logger.warning("Failed to publish config update to MQTT")

            return updated_item

        except ValueError:
            raise HTTPException(status_code=400, detail="Value must be a valid integer.") from None

    # Email notifications setting (stored as JSON string)
    if config_key == "EMAIL_NOTIFICATIONS":
        # The value should be a JSON string containing email config
        # No special validation needed - just store it
        updated_item = await update_config_setting(config_key, update_data.value)
        return updated_item

    # Generic update for other keys
    updated_item = await update_config_setting(config_key, update_data.value)
    return updated_item
