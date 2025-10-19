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
    limit: int = Query(10, ge=1, le=1000),
    start_time: str = Query(None, description="ISO 8601 timestamp for range start"),
    end_time: str = Query(None, description="ISO 8601 timestamp for range end")
):
    try:
        history_data = await get_feed_history(
            page=page,
            limit=limit,
            start_time=start_time,
            end_time=end_time
        )
        return history_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/feed_history/delete_all")
async def delete_all_feed_events_endpoint():
    """
    Deletes all feed events from the DynamoDB feed history table.
    This is a destructive operation that cannot be undone.
    """
    from app.crud.feed import delete_all_feed_events
    try:
        deleted_count = await delete_all_feed_events()
        return {
            "success": True,
            "deleted_count": deleted_count,
            "message": f"Successfully deleted {deleted_count} feed events"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting feed events: {str(e)}")