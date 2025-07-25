from datetime import datetime
from uuid import uuid4
import asyncio
import boto3
from botocore.exceptions import ClientError
from typing import List, Dict, Any

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

async def get_latest_device_status() -> Dict[str, Any]: # <<< NEW FUNCTION
    """
    Retrieves the latest device status from the DynamoDB table.
    Assumes 'thingId' is the partition key and we want the item for the configured IOT_THING_ID.
    """
    from app.core.config import settings # Import here to avoid circular dependency
    loop = asyncio.get_event_loop()
    table = get_device_status_table()
    thing_id = settings.IOT_THING_ID

    try:
        response = await loop.run_in_executor(
            None,
            lambda: table.get_item(Key={'thingId': thing_id})
        )
        return response.get('Item')
    except ClientError as e:
        print(f"Error getting device status from DynamoDB: {e}")
        raise e
    except Exception as e:
        print(f"An unexpected error occurred while fetching device status: {e}")
        raise e
