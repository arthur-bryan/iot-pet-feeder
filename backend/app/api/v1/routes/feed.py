from fastapi import APIRouter,  HTTPException
from backend.app.models.feed import FeedRequest, FeedResponse
from backend.app.services.feed_service import process_feed

router = APIRouter(prefix="/feed")


@router.post("/", response_model=FeedResponse)
async def on_demand(request: FeedRequest):
    try:
        result = await process_feed(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
def read_all():
    return

