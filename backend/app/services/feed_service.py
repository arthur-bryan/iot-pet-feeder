import uuid
from datetime import datetime
from typing import Any

from app.core.hardware_adapter import get_hardware_adapter
from app.core.serialization import convert_decimal
from app.crud.config import fetch_config_setting
from app.crud.feed import fetch_feed_events_from_db
from app.models.feed import FeedRequest, FeedResponse


async def process_feed(request: FeedRequest) -> FeedResponse:
    feed_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat()

    # Get hardware adapter (production or demo)
    hardware = get_hardware_adapter()

    # Determine event type based on mode
    event_type = "scheduled_feed" if request.mode == "scheduled" else "manual_feed"

    # Check current weight against threshold
    try:
        device_status = await hardware.get_device_status()
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
                return FeedResponse(
                    requested_by=request.requested_by,
                    feed_id=feed_id,
                    mode=request.mode,
                    status="denied_weight_exceeded",
                    timestamp=datetime.fromisoformat(timestamp),
                    event_type=event_type
                )
    except Exception as e:
        print(f"Error checking weight threshold: {e}. Proceeding with feed command.")

    # Trigger feed using hardware adapter (real or simulated)
    # Production: sends MQTT command to ESP32
    # Demo: generates fake event and saves to DynamoDB
    result = await hardware.trigger_feed(
        requested_by=request.requested_by,
        mode=request.mode
    )

    # Determine status from result
    if result.get('status') in ['sent', 'simulated', 'completed']:
        status = 'sent'
    else:
        status = 'failed'

    # Return response
    return FeedResponse(
        requested_by=request.requested_by,
        feed_id=feed_id,
        mode=request.mode,
        status=status,
        timestamp=datetime.fromisoformat(timestamp),
        event_type=event_type
    )


async def get_feed_history(
    page: int = 1,
    limit: int = 10,
    start_time: str = None,
    end_time: str = None
) -> dict[str, Any]:
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

    paginated_items = convert_decimal(paginated_items)

    total_items = len(sorted_items)
    total_pages = (total_items + limit - 1) // limit  # Ceiling division

    return {
        "items": paginated_items,
        "total_items": total_items,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }
