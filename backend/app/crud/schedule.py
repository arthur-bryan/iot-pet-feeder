# backend/app/crud/schedule.py

from datetime import datetime
from uuid import uuid4
from typing import Dict, Any, List, Optional
from decimal import Decimal
import boto3
from botocore.exceptions import ClientError

from app.models.schedule import ScheduleRequest, ScheduleUpdate
from app.db.client import get_feed_schedule_table


def convert_decimal(obj):
    """Convert DynamoDB Decimal types to int/float for JSON serialization."""
    if isinstance(obj, list):
        return [convert_decimal(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: convert_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    else:
        return obj


def create_schedule(request: ScheduleRequest) -> Dict[str, Any]:
    """Create a new schedule in DynamoDB."""
    table = get_feed_schedule_table()
    schedule_id = str(uuid4())
    now = datetime.utcnow().isoformat()

    item = {
        "schedule_id": schedule_id,
        "requested_by": request.requested_by,
        "scheduled_time": request.scheduled_time,
        "feed_cycles": request.feed_cycles,
        "recurrence": request.recurrence,
        "enabled": request.enabled,
        "created_at": now,
        "updated_at": now
    }

    try:
        table.put_item(Item=item)
        return convert_decimal(item)
    except ClientError as e:
        print(f"Error creating schedule: {e}")
        raise e


def get_schedule(schedule_id: str) -> Optional[Dict[str, Any]]:
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
    requested_by: Optional[str] = None
) -> Dict[str, Any]:
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


def update_schedule(schedule_id: str, update: ScheduleUpdate) -> Optional[Dict[str, Any]]:
    """Update an existing schedule."""
    table = get_feed_schedule_table()

    # Build update expression dynamically
    update_parts = []
    expr_attr_values = {}
    expr_attr_names = {}

    if update.scheduled_time is not None:
        update_parts.append("#st = :st")
        expr_attr_names["#st"] = "scheduled_time"
        expr_attr_values[":st"] = update.scheduled_time

    if update.feed_cycles is not None:
        update_parts.append("feed_cycles = :fc")
        expr_attr_values[":fc"] = update.feed_cycles

    if update.recurrence is not None:
        update_parts.append("recurrence = :rec")
        expr_attr_values[":rec"] = update.recurrence

    if update.enabled is not None:
        update_parts.append("enabled = :en")
        expr_attr_values[":en"] = update.enabled

    # Always update updated_at
    update_parts.append("updated_at = :ua")
    expr_attr_values[":ua"] = datetime.utcnow().isoformat()

    if not update_parts:
        # No updates provided
        return get_schedule(schedule_id)

    update_expression = "SET " + ", ".join(update_parts)

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


def toggle_schedule(schedule_id: str, enabled: bool) -> Optional[Dict[str, Any]]:
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
