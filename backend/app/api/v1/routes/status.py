import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException

from app.core.hardware_adapter import get_hardware_adapter

router = APIRouter()


@router.get(
    "",
    response_model=dict[str, Any],
    summary="Get cached device status",
    description="""
    Retrieves the latest cached device status from DynamoDB.

    **Production mode**: Returns last reported ESP32 status (weight, connectivity, battery)
    **Demo mode**: Returns simulated device status

    **Caching**: Status is cached from device reports, may be slightly stale (up to 30s)

    **Real-time alternative**: Use `PUT /api/v1/status` to request fresh status update
    """,
    responses={
        200: {
            "description": "Device status retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "weight_grams": 1250,
                        "battery_percent": 85,
                        "wifi_rssi": -45,
                        "last_update": "2025-12-14T10:29:45Z",
                        "device_online": True
                    }
                }
            }
        },
        404: {
            "description": "Device status not found (device never reported or offline)",
            "content": {
                "application/json": {
                    "example": {"detail": "Device status not found."}
                }
            }
        },
        500: {
            "description": "Server error (DynamoDB query failure)",
            "content": {
                "application/json": {
                    "example": {"detail": "Error retrieving device status: <error>"}
                }
            }
        }
    }
)
async def get_status():
    try:
        hardware = get_hardware_adapter()
        status_data = await hardware.get_device_status()
        if status_data:
            return status_data
        else:
            # Return a 404 if no status is found, indicating device might be offline or not yet reported
            raise HTTPException(status_code=404, detail="Device status not found.")
    except Exception as e:
        # Catch any other exceptions and return a 500
        raise HTTPException(status_code=500, detail=f"Error retrieving device status: {str(e)}") from e


@router.put(
    "",
    response_model=dict[str, Any],
    summary="Request real-time status update",
    description="""
    Requests fresh device status update from ESP32.

    **Production mode**:
    1. Publishes `GET_STATUS` command via MQTT to ESP32
    2. Waits 2 seconds for device response
    3. Returns updated status if received, or indicates device offline

    **Demo mode**: Immediately returns simulated status

    **Use case**: Get current weight reading before/after feeding

    **Response time**: ~2-3 seconds in production (includes MQTT round-trip)
    """,
    responses={
        200: {
            "description": "Status request processed (may include updated status or timeout)",
            "content": {
                "application/json": {
                    "examples": {
                        "success": {
                            "summary": "Status received from device",
                            "value": {
                                "success": True,
                                "message": "Status request sent and response received",
                                "status": {
                                    "weight_grams": 1250,
                                    "battery_percent": 85,
                                    "wifi_rssi": -45,
                                    "last_update": "2025-12-14T10:30:00Z"
                                }
                            }
                        },
                        "timeout": {
                            "summary": "Device offline or slow to respond",
                            "value": {
                                "success": True,
                                "message": "Status request sent, but no response yet. Device may be offline.",
                                "status": None
                            }
                        }
                    }
                }
            }
        },
        500: {
            "description": "Server error (MQTT publish failure)",
            "content": {
                "application/json": {
                    "example": {"detail": "Failed to send status request to device."}
                }
            }
        }
    }
)
async def request_status():
    try:
        hardware = get_hardware_adapter()
        success = await hardware.request_status_update()
        if success:
            # Wait a moment for device to respond (production) or immediate (demo)
            await asyncio.sleep(2)
            # Try to fetch the updated status
            status_data = await hardware.get_device_status()
            if status_data:
                return {
                    "success": True,
                    "message": "Status request sent and response received",
                    "status": status_data
                }
            else:
                return {
                    "success": True,
                    "message": "Status request sent, but no response yet. Device may be offline.",
                    "status": None
                }
        else:
            raise HTTPException(status_code=500, detail="Failed to send status request to device.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error requesting device status: {str(e)}") from e
