#!/usr/bin/env python3
"""
Clean up invalid feed events from DynamoDB.

Removes:
1. Events with mode='unknown'
2. Events with missing weight data (no weight_before or weight_after)
3. Events with 0g -> 0g (no actual weight change)
"""
import os
import sys

import boto3
from botocore.exceptions import ClientError


def cleanup_invalid_events():
    """Remove invalid feed events from DynamoDB."""
    table_name = os.environ.get('DYNAMO_FEED_HISTORY_TABLE', 'iot-pet-feeder-feed-history-dev')
    region = os.environ.get('AWS_REGION', 'us-east-2')

    print(f"Connecting to DynamoDB table: {table_name} in {region}")
    print("="*60)

    dynamodb = boto3.resource('dynamodb', region_name=region)
    table = dynamodb.Table(table_name)

    # Scan all feed events
    try:
        print("Scanning all feed events...")
        response = table.scan()
        items = response.get('Items', [])

        print(f"Total events: {len(items)}\n")

        stats = {
            'unknown_mode': 0,
            'no_data': 0,
            'zero_to_zero': 0,
            'kept': 0,
            'total_deleted': 0
        }

        events_to_delete = []

        for item in items:
            feed_id = item.get('feed_id')
            status = item.get('status')
            event_type = item.get('event_type', 'manual_feed')
            mode = item.get('mode', 'unknown')
            timestamp = item.get('timestamp', 'unknown')

            weight_before = item.get('weight_before_g')
            weight_after = item.get('weight_after_g')

            should_delete = False
            reason = None

            # Rule 1: Unknown mode
            if mode == 'unknown':
                should_delete = True
                reason = "mode=unknown"
                stats['unknown_mode'] += 1

            # Rule 2: Missing weight data (both before and after)
            elif weight_before is None and weight_after is None:
                should_delete = True
                reason = "no weight data"
                stats['no_data'] += 1

            # Rule 3: 0g -> 0g (no actual change)
            elif weight_before is not None and weight_after is not None:
                before_val = float(weight_before)
                after_val = float(weight_after)
                if before_val == 0.0 and after_val == 0.0:
                    should_delete = True
                    reason = "0g -> 0g"
                    stats['zero_to_zero'] += 1

            if should_delete:
                events_to_delete.append({
                    'feed_id': feed_id,
                    'timestamp': timestamp,
                    'mode': mode,
                    'event_type': event_type,
                    'reason': reason
                })
                print(f"🗑  {feed_id[:8]}... ({timestamp[:10]}) - {reason}")
            else:
                stats['kept'] += 1

        print(f"\n{'='*60}")
        print(f"Analysis Summary:")
        print(f"  Total events: {len(items)}")
        print(f"  Events to delete: {len(events_to_delete)}")
        print(f"    - Unknown mode: {stats['unknown_mode']}")
        print(f"    - No weight data: {stats['no_data']}")
        print(f"    - Zero to zero: {stats['zero_to_zero']}")
        print(f"  Events to keep: {stats['kept']}")
        print(f"{'='*60}\n")

        if len(events_to_delete) == 0:
            print("No events to delete. Exiting.")
            return 0

        # Confirm deletion
        print(f"Ready to delete {len(events_to_delete)} events.")

        # Delete events
        print("\nDeleting events...")
        for event in events_to_delete:
            try:
                table.delete_item(Key={'feed_id': event['feed_id']})
                stats['total_deleted'] += 1
            except ClientError as e:
                print(f"  ✗ Failed to delete {event['feed_id']}: {e}")

        print(f"\n{'='*60}")
        print(f"Cleanup Complete:")
        print(f"  Successfully deleted: {stats['total_deleted']}")
        print(f"  Failed: {len(events_to_delete) - stats['total_deleted']}")
        print(f"{'='*60}")

        return stats['total_deleted']

    except ClientError as e:
        print(f"Error accessing DynamoDB: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def main():
    """Main entry point."""
    print("Feed Event Cleanup Tool")
    print("="*60)
    print()

    total_deleted = cleanup_invalid_events()

    if total_deleted > 0:
        print(f"\n✓ Cleanup successful - removed {total_deleted} invalid events")
    else:
        print("\n✓ No invalid events found")

    return 0


if __name__ == '__main__':
    sys.exit(main())
