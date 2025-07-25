from fastapi import APIRouter, HTTPException
from app.models.schedule import ScheduleRequest, ScheduleResponse
from app.services.feed_service import create_schedule

router = APIRouter()


@router.post("/", response_model=ScheduleResponse)
async def schedule(request: ScheduleRequest):
    try:
        result = await create_schedule(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
