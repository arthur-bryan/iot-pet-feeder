from datetime import datetime
from uuid import uuid4

from app.models.feed import FeedRequest
from app.models.schedule import ScheduleRequest

from app.db.client import get_feed_history_table, get_feed_schedule_table


def save_feed_event(
    feed_id: str,
    timestamp: str,
    status: str,
) -> dict:
    table = get_feed_history_table()

    item = {
        "feed_id": feed_id,
        "timestamp": timestamp,
        "status": status,
    }

    table.put_item(Item=item)
    return item


def save_schedule(request: ScheduleRequest) -> dict:
    table = get_feed_schedule_table()
    schedule_id = str(uuid4())
    item = {
        "schedule_id": schedule_id,
        "requested_by": request.requested_by,
        "scheduled_time": request.scheduled_time,
        "recurrence": request.recurring,
        "enabled": True,
        "created_at": datetime.utcnow().isoformat()
    }
    table.put_item(Item=item)
    return item
