from fastapi import APIRouter, HTTPException
from app.crud.feed import get_latest_device_status # Assuming this function exists in crud/feed.py
from typing import Dict, Any

router = APIRouter()


@router.get("/", response_model=Dict[str, Any])
async def get_status():
    """
    Retrieves the latest status of the IoT device.
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
