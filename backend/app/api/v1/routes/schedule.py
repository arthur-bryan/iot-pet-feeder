from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.models.schedule import (
    ScheduleRequest,
    ScheduleResponse,
    ScheduleUpdate,
    ScheduleListResponse
)
from app.crud.schedule import (
    create_schedule as create_schedule_db,
    get_schedule as get_schedule_db,
    list_schedules as list_schedules_db,
    update_schedule as update_schedule_db,
    delete_schedule as delete_schedule_db,
    toggle_schedule as toggle_schedule_db
)

router = APIRouter()


@router.post("/schedules", response_model=ScheduleResponse, status_code=201)
async def create_schedule(request: ScheduleRequest):
    """Create a new feeding schedule."""
    try:
        schedule = create_schedule_db(request)
        return ScheduleResponse(**schedule)
    except Exception as e:
        print(f"Error creating schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/schedules", response_model=ScheduleListResponse)
async def list_schedules(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    requested_by: Optional[str] = Query(None, description="Filter by user")
):
    """List all schedules with pagination."""
    try:
        result = list_schedules_db(page=page, page_size=page_size, requested_by=requested_by)

        schedules = [ScheduleResponse(**schedule) for schedule in result["schedules"]]

        return ScheduleListResponse(
            schedules=schedules,
            total=result["total"],
            page=result["page"],
            page_size=result["page_size"],
            has_next=result["has_next"]
        )
    except Exception as e:
        print(f"Error listing schedules: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/schedules/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(schedule_id: str):
    """Get a single schedule by ID."""
    try:
        schedule = get_schedule_db(schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        return ScheduleResponse(**schedule)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/schedules/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(schedule_id: str, update: ScheduleUpdate):
    """Update an existing schedule."""
    try:
        # Check if schedule exists
        existing = get_schedule_db(schedule_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Schedule not found")

        updated_schedule = update_schedule_db(schedule_id, update)
        return ScheduleResponse(**updated_schedule)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/schedules/{schedule_id}", status_code=204)
async def delete_schedule(schedule_id: str):
    """Delete a schedule."""
    try:
        # Check if schedule exists
        existing = get_schedule_db(schedule_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Schedule not found")

        delete_schedule_db(schedule_id)
        return None
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/schedules/{schedule_id}/toggle", response_model=ScheduleResponse)
async def toggle_schedule(schedule_id: str, enabled: bool = Query(..., description="Enable or disable")):
    """Enable or disable a schedule."""
    try:
        # Check if schedule exists
        existing = get_schedule_db(schedule_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Schedule not found")

        toggled_schedule = toggle_schedule_db(schedule_id, enabled)
        return ScheduleResponse(**toggled_schedule)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error toggling schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))
