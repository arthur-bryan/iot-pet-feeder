import uuid
from datetime import datetime
from typing import Literal, Dict, Any, List
from app.models.feed import FeedRequest, FeedResponse
from app.models.schedule import ScheduleRequest, ScheduleResponse
from app.core import iot
from app.crud.feed import save_feed_event, fetch_feed_events_from_db, get_latest_device_status, convert_decimal_to_number
from app.crud.config import fetch_config_setting


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

    # Check current weight against threshold
    try:
        device_status = await get_latest_device_status()
        if device_status:
            current_weight = device_status.get('current_weight_g', 0.0)

            # Fetch weight threshold from config
            threshold_config = await fetch_config_setting('WEIGHT_THRESHOLD_G')
            weight_threshold = 450.0  # Default
            if threshold_config and 'value' in threshold_config:
                weight_threshold = float(threshold_config['value'])

            # Check if current weight exceeds threshold
            if current_weight >= weight_threshold:
                print(f"Feed denied: current weight ({current_weight}g) >= threshold ({weight_threshold}g)")
                # Note: We don't save the event here - ESP32 will detect and handle
                return FeedResponse(
                    requested_by=request.requested_by,
                    feed_id=feed_id,
                    mode=request.mode,
                    status="denied_weight_exceeded",
                    timestamp=datetime.fromisoformat(timestamp),
                    event_type="manual_feed"
                )
    except Exception as e:
        print(f"Error checking weight threshold: {e}. Proceeding with feed command.")

    # Send feed command to ESP32 via MQTT
    # The ESP32 will handle logging the feed event with weight data
    success = await iot.publish_feed_command("FEED_NOW")

    # Return response immediately - ESP32 will log the actual event with weight tracking
    return FeedResponse(
        requested_by=request.requested_by,
        feed_id=feed_id,
        mode=request.mode,
        status="sent" if success else "failed",
        timestamp=datetime.fromisoformat(timestamp),
        event_type="manual_feed"
    )


async def get_feed_history(
    page: int = 1,
    limit: int = 10,
    start_time: str = None,
    end_time: str = None
) -> Dict[str, Any]:
    """
    Retrieves paginated feed history from DynamoDB.
    Supports optional time-based filtering using start_time and end_time parameters.
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

    # Apply time-based filtering if start_time or end_time are provided
    if start_time or end_time:
        filtered_items = []
        for item in all_items:
            item_timestamp = item.get('timestamp', '')
            if not item_timestamp:
                continue

            # Check if item is within time range
            include_item = True
            if start_time and item_timestamp < start_time:
                include_item = False
            if end_time and item_timestamp > end_time:
                include_item = False

            if include_item:
                filtered_items.append(item)

        all_items = filtered_items

    # Sort all items by timestamp in descending order (newest to oldest)
    sorted_items = sorted(all_items, key=lambda x: x.get('timestamp', ''), reverse=True)

    # Implement in-memory pagination
    start_index = (page - 1) * limit
    end_index = start_index + limit
    paginated_items = sorted_items[start_index:end_index]

    # Convert DynamoDB Decimal types to regular numbers for JSON serialization
    paginated_items = convert_decimal_to_number(paginated_items)

    total_items = len(sorted_items)
    total_pages = (total_items + limit - 1) // limit  # Ceiling division

    return {
        "items": paginated_items,
        "total_items": total_items,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }
