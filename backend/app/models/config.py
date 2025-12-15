# backend/app/models/config.py

from typing import Any

from pydantic import BaseModel, Field


# --- ConfigItem Model ---
# Represents a full configuration record, as stored in DynamoDB and returned by GET requests.
class ConfigItem(BaseModel):
    """Model representing a configuration key-value pair."""

    config_key: str = Field(
        ...,
        description="Unique key for the configuration item (e.g., 'SERVO_OPEN_HOLD_DURATION_MS')"
    )

    # CHANGED: Use 'value' instead of 'config_value'
    value: Any = Field(
        ...,
        description="The value associated with the configuration key"
    )

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "examples": [
                {
                    "config_key": "SERVO_OPEN_HOLD_DURATION_MS",
                    "value": "1500",
                }
            ]
        }
    }


# --- ConfigUpdate Model ---
class ConfigUpdate(BaseModel):
    """Model used for updating a configuration item value via the API."""

    # CHANGED: Use 'value' instead of 'config_value'
    value: Any = Field(
        ...,
        description="The new value to set for the configuration key."
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "value": "2000"
                }
            ]
        }
    }
