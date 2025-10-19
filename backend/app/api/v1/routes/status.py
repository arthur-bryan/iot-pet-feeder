from fastapi import APIRouter, HTTPException
from app.crud.feed import get_latest_device_status
from app.core.iot import request_device_status
from typing import Dict, Any
import asyncio

router = APIRouter()


@router.get("/", response_model=Dict[str, Any])
async def get_status():
    """
    Retrieves the latest cached status of the IoT device from DynamoDB.
    This is a fallback for when real-time status is not available.
    For real-time status, use POST /status/request
    """
    try:
        status_data = await get_latest_device_status()
        if status_data:
            return status_data
        else:
            # Return a 404 if no status is found, indicating device might be offline or not yet reported
            raise HTTPException(status_code=404, detail="Device status not found.")
    except Exception as e:
        # Catch any other exceptions and return a 500
        raise HTTPException(status_code=500, detail=f"Error retrieving device status: {str(e)}")


@router.post("/request")
async def request_status():
    """
    Requests real-time device status by publishing GET_STATUS command via MQTT.
    The ESP32 will respond by publishing to petfeeder/status, which will be saved to DynamoDB.
    Frontend should wait ~2-3 seconds then call GET /status/ to retrieve the updated status.
    """
    try:
        success = await request_device_status()
        if success:
            # Wait a moment for ESP32 to respond and Lambda to update DynamoDB
            await asyncio.sleep(2)
            # Try to fetch the updated status
            status_data = await get_latest_device_status()
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
        raise HTTPException(status_code=500, detail=f"Error requesting device status: {str(e)}")
