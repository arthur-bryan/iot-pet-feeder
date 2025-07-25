import uuid
from datetime import datetime
from typing import Literal, Dict, Any, List
from app.models.feed import FeedRequest, FeedResponse
from app.models.schedule import ScheduleRequest, ScheduleResponse
from app.core import iot
from app.crud.feed import save_feed_event, fetch_feed_events_from_db  # Import new crud function


# import json # <<< REMOVED THIS

def create_schedule(request: ScheduleRequest) -> ScheduleResponse:
    schedule_id = str(uuid.uuid4())
    schedule_time = request.scheduled_time
    status: Literal["scheduled", "failed"] = "scheduled"

    return ScheduleResponse(
        schedule_id=schedule_id,
        status=status,
        schedule_time=schedule_time
    )


async def process_feed(request: FeedRequest) -> FeedResponse:
    feed_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat()

    # Reverted to sending a simple string command, as requested
    success = await iot.publish_feed_command("FEED_NOW")  # <<< REVERTED THIS

    await save_feed_event(
        feed_id=feed_id,
        timestamp=timestamp,
        mode=request.mode,
        requested_by=request.requested_by,
        status="sent" if success else "failed"
    )

    return FeedResponse(
        requested_by=request.requested_by,
        feed_id=feed_id,
        mode=request.mode,
        status="sent" if success else "failed",
        timestamp=datetime.fromisoformat(timestamp)
    )


async def get_feed_history(page: int = 1, limit: int = 10) -> Dict[str, Any]:
    """
    Retrieves paginated feed history from DynamoDB.
    Note: For DynamoDB 'scan', pagination is handled by LastEvaluatedKey.
    This implementation performs a full scan and then paginates in memory,
    which is not efficient for very large tables.
    For truly scalable pagination with sorted results, a DynamoDB Global Secondary Index
    with 'timestamp' as a sort key would be required, and 'query' operation used.
    """
    all_items = []
    last_evaluated_key = None

    # Fetch all items (or enough to cover requested pages)
    # In a real-world scenario with large datasets, you'd refine this to only scan
    # up to the required page's data using LastEvaluatedKey and multiple scans.
    # For now, we'll fetch all to simplify in-memory pagination.
    while True:
        response = await fetch_feed_events_from_db(
            limit=1000,  # Fetch a larger chunk to reduce scan calls if table is small
            exclusive_start_key=last_evaluated_key
        )
        all_items.extend(response['items'])
        last_evaluated_key = response['last_evaluated_key']
        if not last_evaluated_key:
            break

    # Sort all items by timestamp in descending order (newest to oldest)
    sorted_items = sorted(all_items, key=lambda x: x.get('timestamp', ''), reverse=True)

    # Implement in-memory pagination
    start_index = (page - 1) * limit
    end_index = start_index + limit
    paginated_items = sorted_items[start_index:end_index]

    total_items = len(sorted_items)
    total_pages = (total_items + limit - 1) // limit  # Ceiling division

    return {
        "items": paginated_items,
        "total_items": total_items,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }
