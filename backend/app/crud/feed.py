import asyncio
from typing import Any

from botocore.exceptions import ClientError

from app.core.serialization import convert_decimal
from app.db.client import get_device_status_table, get_feed_history_table


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
    exclusive_start_key: dict[str, Any] = None
) -> dict[str, Any]:
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


async def get_latest_device_status() -> dict[str, Any]:
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
            item = convert_decimal(item)
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
