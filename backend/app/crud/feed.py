from datetime import datetime
from uuid import uuid4
import asyncio
import boto3
from botocore.exceptions import ClientError
from typing import List, Dict, Any
from decimal import Decimal

from app.models.feed import FeedRequest
from app.models.schedule import ScheduleRequest

from app.db.client import get_feed_history_table, get_feed_schedule_table, get_device_status_table # <<< IMPORTED NEW TABLE


async def save_feed_event(
    feed_id: str,
    timestamp: str,
    mode: str,
    status: str,
    requested_by: str
) -> dict:
    loop = asyncio.get_event_loop()
    item = await loop.run_in_executor(
        None,
        lambda: get_feed_history_table().put_item(
            Item={
                "feed_id": feed_id,
                "requested_by": requested_by,
                "mode": mode,
                "timestamp": timestamp,
                "status": status
            }
        )
    )
    return item


async def fetch_feed_events_from_db(
    limit: int,
    exclusive_start_key: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Fetches feed events from DynamoDB with pagination.
    Uses scan operation and sorts results by timestamp in Python.
    For large datasets, a GSI on timestamp would be more efficient.
    """
    loop = asyncio.get_event_loop()
    table = get_feed_history_table()

    scan_params = {
        'Limit': limit,
        'ExclusiveStartKey': exclusive_start_key
    } if exclusive_start_key else {'Limit': limit}

    try:
        response = await loop.run_in_executor(
            None,
            lambda: table.scan(**scan_params)
        )
        items = response.get('Items', [])
        last_evaluated_key = response.get('LastEvaluatedKey')

        sorted_items = sorted(items, key=lambda x: x.get('timestamp', ''), reverse=True)

        return {
            "items": sorted_items,
            "last_evaluated_key": last_evaluated_key,
            "count": response.get('Count', 0),
            "scanned_count": response.get('ScannedCount', 0)
        }
    except ClientError as e:
        print(f"Error scanning DynamoDB for feed events: {e}")
        raise e
    except Exception as e:
        print(f"An unexpected error occurred while fetching feed events: {e}")
        raise e


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


def convert_decimal_to_number(obj):
    """
    Recursively converts DynamoDB Decimal types to int or float for JSON serialization.
    """
    if isinstance(obj, list):
        return [convert_decimal_to_number(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: convert_decimal_to_number(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        # Convert to int if it's a whole number, otherwise float
        if obj % 1 == 0:
            return int(obj)
        else:
            return float(obj)
    else:
        return obj


async def get_latest_device_status() -> Dict[str, Any]: # <<< NEW FUNCTION
    """
    Retrieves the latest device status from the DynamoDB table.
    Assumes 'thingId' is the partition key and we want the item for the configured IOT_THING_ID.
    """
    from app.core.config import settings
    loop = asyncio.get_event_loop()
    table = get_device_status_table()
    thing_id = settings.IOT_THING_ID

    try:
        response = await loop.run_in_executor(
            None,
            lambda: table.get_item(Key={'thing_id': thing_id})
        )
        item = response.get('Item')
        if item:
            # Convert Decimal types to regular numbers for JSON serialization
            item = convert_decimal_to_number(item)
        return item
    except ClientError as e:
        print(f"Error getting device status from DynamoDB: {e}")
        raise e
    except Exception as e:
        print(f"An unexpected error occurred while fetching device status: {e}")
        raise e


async def delete_all_feed_events() -> int:
    """
    Deletes all feed events from the DynamoDB feed history table.
    Returns the number of items deleted.
    """
    loop = asyncio.get_event_loop()
    table = get_feed_history_table()
    deleted_count = 0

    try:
        # Scan to get all items
        scan_params = {}
        while True:
            response = await loop.run_in_executor(
                None,
                lambda: table.scan(**scan_params)
            )

            items = response.get('Items', [])

            # Delete each item
            for item in items:
                # feed_id is the partition key
                feed_id = item.get('feed_id')
                if feed_id:
                    await loop.run_in_executor(
                        None,
                        lambda key=feed_id: table.delete_item(Key={'feed_id': key})
                    )
                    deleted_count += 1
                    print(f"Deleted feed event: {feed_id}")

            # Check if there are more items to scan
            last_evaluated_key = response.get('LastEvaluatedKey')
            if not last_evaluated_key:
                break

            scan_params['ExclusiveStartKey'] = last_evaluated_key

        print(f"Successfully deleted {deleted_count} feed events")
        return deleted_count

    except ClientError as e:
        print(f"Error deleting feed events from DynamoDB: {e}")
        raise e
    except Exception as e:
        print(f"An unexpected error occurred while deleting feed events: {e}")
        raise e
