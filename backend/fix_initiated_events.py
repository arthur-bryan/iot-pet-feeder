#!/usr/bin/env python3
"""
Fix feed events stuck in 'initiated' status by updating them to 'completed'.
This script updates all events with status='initiated' to status='completed'.
"""
import asyncio
import os
import sys

import boto3
from botocore.exceptions import ClientError


async def update_initiated_events():
    """Update all feed events with status='initiated' to 'completed'."""
    table_name = os.environ.get('DYNAMO_FEED_HISTORY_TABLE', 'iot-pet-feeder-feed-history-dev')
    region = os.environ.get('AWS_REGION', 'us-east-2')

    print(f"Connecting to DynamoDB table: {table_name} in {region}")

    dynamodb = boto3.resource('dynamodb', region_name=region)
    table = dynamodb.Table(table_name)

    # Scan for all items with status='initiated'
    try:
        print("Scanning for events with status='initiated'...")
        response = table.scan(
            FilterExpression='#s = :initiated',
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={':initiated': 'initiated'}
        )

        items = response.get('Items', [])
        total_count = len(items)

        print(f"Found {total_count} events stuck in 'initiated' status")

        if total_count == 0:
            print("No events to update. Exiting.")
            return 0

        # Update each item
        updated_count = 0
        failed_count = 0

        for item in items:
            feed_id = item.get('feed_id')
            timestamp = item.get('timestamp')
            mode = item.get('mode', 'unknown')
            requested_by = item.get('requested_by', 'unknown')

            try:
                # Update status to 'completed'
                table.update_item(
                    Key={'feed_id': feed_id},
                    UpdateExpression='SET #s = :completed',
                    ExpressionAttributeNames={'#s': 'status'},
                    ExpressionAttributeValues={':completed': 'completed'}
                )
                updated_count += 1
                print(f"✓ Updated {feed_id} ({timestamp}, mode={mode}, by={requested_by})")

            except ClientError as e:
                failed_count += 1
                print(f"✗ Failed to update {feed_id}: {e}")

        print(f"\n{'='*60}")
        print(f"Update complete:")
        print(f"  Total found: {total_count}")
        print(f"  Successfully updated: {updated_count}")
        print(f"  Failed: {failed_count}")
        print(f"{'='*60}")

        return updated_count

    except ClientError as e:
        print(f"Error scanning DynamoDB: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)


def main():
    """Main entry point."""
    print("Feed Event Status Fixer")
    print("="*60)

    # Check for required environment variables
    if not os.environ.get('AWS_REGION'):
        print("Warning: AWS_REGION not set, using default: us-east-2")

    # Run the async update function
    loop = asyncio.get_event_loop()
    updated = loop.run_until_complete(update_initiated_events())

    if updated > 0:
        print(f"\n✓ Successfully updated {updated} feed events from 'initiated' to 'completed'")

    return 0


if __name__ == '__main__':
    sys.exit(main())
