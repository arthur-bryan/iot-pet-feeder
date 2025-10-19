# app/api/v1/config.py (NEW FILE)

from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, Union
import decimal  # For handling DynamoDB Decimal types

# 1. Import the CRUD functions
from app.crud.config import fetch_config_setting, update_config_setting

# 2. Import the Pydantic models (from the file we planned)
from app.models.config import ConfigUpdate, ConfigItem

# 3. Import settings for default value fallback
from app.core.config import settings

# 4. Import IoT publish function for MQTT updates
from app.core.iot import publish_config_update

router = APIRouter()

# Default fallback values (must match the constants you'll use in ESP32)
# We pull this from settings for a single source of truth
DEFAULT_HOLD_DURATION_MS = 3000
DEFAULT_WEIGHT_THRESHOLD_G = 450


@router.get(
    "/config/{key}",
    response_model=ConfigItem,
    summary="Get a configuration setting by key"
)
async def get_config_setting(key: str) -> Dict[str, Union[str, Any]]:
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
        # Return default email notification config (disabled, no email)
        return {
            "config_key": config_key,
            "value": '{"email":"","enabled":false,"subscription_arn":""}'
        }

    raise HTTPException(status_code=404, detail=f"Configuration key '{key}' not found and has no default value.")


@router.put(
    "/config/{key}",
    response_model=ConfigItem,
    summary="Update a configuration setting"
)
async def set_config_setting(key: str, update_data: ConfigUpdate = Body(...)):
    config_key = key.upper()

    # Validation specific to the duration setting
    if config_key == "SERVO_OPEN_HOLD_DURATION_MS":
        try:
            value_int = int(update_data.value)
            if value_int < 1000 or value_int > 10000:
                raise HTTPException(status_code=400, detail="Duration must be between 1000 ms and 10000 ms (1-10 seconds).")

            # Update DynamoDB
            updated_item = await update_config_setting(config_key, value_int)

            # Publish to MQTT so ESP32 receives update immediately
            mqtt_success = await publish_config_update(config_key, value_int)
            if mqtt_success:
                print(f"Config update published to device via MQTT: {config_key}={value_int}")
            else:
                print(f"Warning: Failed to publish config update to MQTT (device will use cached value)")

            return updated_item

        except ValueError:
            raise HTTPException(status_code=400, detail="Value must be a valid integer.")

    # Validation specific to the weight threshold setting
    if config_key == "WEIGHT_THRESHOLD_G":
        try:
            value_int = int(update_data.value)
            if value_int < 50 or value_int > 5000:
                raise HTTPException(status_code=400, detail="Weight threshold must be between 50g and 5000g.")

            # Update DynamoDB
            updated_item = await update_config_setting(config_key, value_int)

            # Publish to MQTT so ESP32 receives update immediately
            mqtt_success = await publish_config_update(config_key, value_int)
            if mqtt_success:
                print(f"Config update published to device via MQTT: {config_key}={value_int}")
            else:
                print(f"Warning: Failed to publish config update to MQTT (device will use cached value)")

            return updated_item

        except ValueError:
            raise HTTPException(status_code=400, detail="Value must be a valid integer.")

    # Email notifications setting (stored as JSON string)
    if config_key == "EMAIL_NOTIFICATIONS":
        # The value should be a JSON string containing email config
        # No special validation needed - just store it
        updated_item = await update_config_setting(config_key, update_data.value)
        return updated_item

    # Generic update for other keys
    updated_item = await update_config_setting(config_key, update_data.value)
    return updated_item