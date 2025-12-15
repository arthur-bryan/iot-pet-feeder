from datetime import datetime
from typing import Any
from uuid import uuid4
from zoneinfo import ZoneInfo

from botocore.exceptions import ClientError

from app.core.serialization import convert_decimal
from app.db.client import get_feed_schedule_table
from app.models.schedule import ScheduleRequest, ScheduleUpdate


def convert_to_utc(scheduled_time_str: str, timezone: str) -> str:
    """
    Convert a scheduled time from user's timezone to UTC.

    Args:
        scheduled_time_str: ISO 8601 datetime string (e.g., '2025-10-18T14:30:00')
        timezone: User's timezone (e.g., 'America/New_York')

    Returns:
        str: ISO 8601 datetime string in UTC with 'Z' suffix
    """
    # Parse the datetime string
    dt = datetime.fromisoformat(scheduled_time_str.replace('Z', ''))

    # If no timezone info, assume user's timezone
    if dt.tzinfo is None:
        user_tz = ZoneInfo(timezone)
        dt = dt.replace(tzinfo=user_tz)

    # Convert to UTC
    dt_utc = dt.astimezone(ZoneInfo('UTC'))

    # Return as ISO string with Z suffix
    return dt_utc.strftime('%Y-%m-%dT%H:%M:%S') + 'Z'


def create_schedule(request: ScheduleRequest) -> dict[str, Any]:
    """
    Create a new schedule in DynamoDB.
    Converts scheduled_time from user's timezone to UTC before storage.
    """
    table = get_feed_schedule_table()
    schedule_id = str(uuid4())
    now = datetime.utcnow().isoformat()

    # Convert scheduled_time from user's timezone to UTC
    scheduled_time_utc = convert_to_utc(request.scheduled_time, request.timezone)

    item = {
        "schedule_id": schedule_id,
        "requested_by": request.requested_by,
        "scheduled_time": scheduled_time_utc,
        "feed_cycles": request.feed_cycles,
        "recurrence": request.recurrence,
        "enabled": request.enabled,
        "timezone": request.timezone,
        "created_at": now,
        "updated_at": now
    }

    try:
        table.put_item(Item=item)
        return convert_decimal(item)
    except ClientError as e:
        print(f"Error creating schedule: {e}")
        raise e


def get_schedule(schedule_id: str) -> dict[str, Any] | None:
    """Get a single schedule by ID."""
    table = get_feed_schedule_table()

    try:
        response = table.get_item(Key={"schedule_id": schedule_id})
        item = response.get("Item")
        return convert_decimal(item) if item else None
    except ClientError as e:
        print(f"Error getting schedule {schedule_id}: {e}")
        raise e


def list_schedules(
    page: int = 1,
    page_size: int = 20,
    requested_by: str | None = None
) -> dict[str, Any]:
    """List all schedules with pagination."""
    table = get_feed_schedule_table()

    try:
        # Scan with optional filter
        scan_params = {}

        if requested_by:
            scan_params["FilterExpression"] = "requested_by = :user"
            scan_params["ExpressionAttributeValues"] = {":user": requested_by}

        response = table.scan(**scan_params)
        items = response.get("Items", [])

        # Sort by created_at descending (newest first)
        sorted_items = sorted(
            items,
            key=lambda x: x.get("created_at", ""),
            reverse=True
        )

        # Manual pagination
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_items = sorted_items[start_idx:end_idx]

        return {
            "schedules": [convert_decimal(item) for item in paginated_items],
            "total": len(sorted_items),
            "page": page,
            "page_size": page_size,
            "has_next": end_idx < len(sorted_items)
        }
    except ClientError as e:
        print(f"Error listing schedules: {e}")
        raise e


def update_schedule(schedule_id: str, update: ScheduleUpdate) -> dict[str, Any] | None:
    """
    Update an existing schedule.
    If scheduled_time is updated, converts from user's timezone to UTC.
    """
    table = get_feed_schedule_table()

    # Get existing schedule to retrieve timezone if needed
    existing = table.get_item(Key={"schedule_id": schedule_id}).get("Item")
    if not existing:
        return None

    existing_timezone = existing.get("timezone", "UTC")

    # Build update expression dynamically
    update_parts = []
    remove_parts = []
    expr_attr_values = {}
    expr_attr_names = {}
    scheduled_time_changed = False

    if update.scheduled_time is not None:
        # Use updated timezone if provided, otherwise use existing
        timezone = update.timezone if update.timezone is not None else existing_timezone
        scheduled_time_utc = convert_to_utc(update.scheduled_time, timezone)

        update_parts.append("#st = :st")
        expr_attr_names["#st"] = "scheduled_time"
        expr_attr_values[":st"] = scheduled_time_utc
        scheduled_time_changed = True

    if update.feed_cycles is not None:
        update_parts.append("feed_cycles = :fc")
        expr_attr_values[":fc"] = update.feed_cycles

    if update.recurrence is not None:
        update_parts.append("recurrence = :rec")
        expr_attr_values[":rec"] = update.recurrence

    if update.enabled is not None:
        update_parts.append("enabled = :en")
        expr_attr_values[":en"] = update.enabled

    if update.timezone is not None:
        update_parts.append("timezone = :tz")
        expr_attr_values[":tz"] = update.timezone

    # Always update updated_at
    update_parts.append("updated_at = :ua")
    expr_attr_values[":ua"] = datetime.utcnow().isoformat()

    # If scheduled_time changed, clear last_executed_at so schedule can execute at new time
    if scheduled_time_changed:
        remove_parts.append("last_executed_at")

    update_expression = "SET " + ", ".join(update_parts)
    if remove_parts:
        update_expression += " REMOVE " + ", ".join(remove_parts)

    try:
        response = table.update_item(
            Key={"schedule_id": schedule_id},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expr_attr_values,
            ExpressionAttributeNames=expr_attr_names if expr_attr_names else None,
            ReturnValues="ALL_NEW"
        )
        return convert_decimal(response.get("Attributes"))
    except ClientError as e:
        print(f"Error updating schedule {schedule_id}: {e}")
        raise e


def delete_schedule(schedule_id: str) -> bool:
    """Delete a schedule by ID."""
    table = get_feed_schedule_table()

    try:
        table.delete_item(Key={"schedule_id": schedule_id})
        return True
    except ClientError as e:
        print(f"Error deleting schedule {schedule_id}: {e}")
        raise e


def toggle_schedule(schedule_id: str, enabled: bool) -> dict[str, Any] | None:
    """Enable or disable a schedule."""
    table = get_feed_schedule_table()

    try:
        response = table.update_item(
            Key={"schedule_id": schedule_id},
            UpdateExpression="SET enabled = :en, updated_at = :ua",
            ExpressionAttributeValues={
                ":en": enabled,
                ":ua": datetime.utcnow().isoformat()
            },
            ReturnValues="ALL_NEW"
        )
        return convert_decimal(response.get("Attributes"))
    except ClientError as e:
        print(f"Error toggling schedule {schedule_id}: {e}")
        raise e
