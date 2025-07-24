import uuid
from datetime import datetime
from typing import Literal
from app.models.feed import FeedRequest, FeedResponse
from app.models.schedule import ScheduleRequest, ScheduleResponse
from app.core import iot
from app.crud.feed import save_feed_event, save_schedule


def create_schedule(request: ScheduleRequest) -> ScheduleResponse:
    schedule_id = str(uuid.uuid4())
    schedule_time = request.scheduled_time
    status: Literal["scheduled", "failed"] = "scheduled"

    return ScheduleResponse(
        schedule_id=schedule_id,
        status=status,
        schedule_time=schedule_time
    )


def process_feed(request: FeedRequest) -> FeedResponse:
    feed_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat()
    success = iot.publish_feed_command("FEED_NOW")

    save_feed_event(
        feed_id=feed_id,
        timestamp=timestamp,
        status="queued" if success else "failed"
    )

    return FeedResponse(
        requested_by="admin@example.com",
        feed_id=feed_id,
        status="queued" if success else "failed",
        timestamp=timestamp
    )