from fastapi import APIRouter, HTTPException, Query
from app.models.feed import FeedRequest, FeedResponse
from app.services.feed_service import process_feed, get_feed_history
from typing import List, Dict, Any

router = APIRouter()


@router.post("/feed/", response_model=FeedResponse)
async def on_demand(request: FeedRequest):
    try:
        result = await process_feed(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/feed_history/", response_model=Dict[str, Any]) # This will now be GET /api/v1/feed_history/
async def read_feed_history(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100)
):
    try:
        history_data = await get_feed_history(page=page, limit=limit)
        return history_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))