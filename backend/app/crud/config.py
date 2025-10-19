# app/crud/config.py

import asyncio
from typing import Dict, Any, Optional
from botocore.exceptions import ClientError
from app.db.client import get_config_table

CONFIG_PARTITION_KEY = "config_key"


async def fetch_config_setting(key: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves a single configuration setting from the DynamoDB config table.
    The table is accessed via get_config_table().
    """
    loop = asyncio.get_event_loop()
    table = get_config_table()

    try:
        response = await loop.run_in_executor(
            None,
            lambda: table.get_item(Key={CONFIG_PARTITION_KEY: key})
        )
        # Returns the item if found, otherwise None
        return response.get('Item')
    except ClientError as e:
        print(f"Error getting config setting '{key}' from DynamoDB: {e}")
        # Re-raise the exception for the service/route layer to handle
        raise e


async def update_config_setting(key: str, value: Any) -> Dict[str, Any]:
    """
    Updates or creates a single configuration setting in the DynamoDB config table.
    """
    loop = asyncio.get_event_loop()
    table = get_config_table()

    # The item structure for DynamoDB
    item = {
        CONFIG_PARTITION_KEY: key,
        "value": value
    }

    try:
        # put_item is used for both inserts and full updates
        await loop.run_in_executor(
            None,
            lambda: table.put_item(Item=item)
        )
        # Return the item structure for the response
        return item
    except ClientError as e:
        print(f"Error updating config setting '{key}' in DynamoDB: {e}")
        # Re-raise the exception for the service/route layer to handle
        raise e