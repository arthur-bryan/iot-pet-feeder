#!/usr/bin/env python3
"""
Comprehensive weight data fixer for feed events.

Logic:
1. Failed feeds: If no weight data captured, mark as failed
2. Completed feeds: Calculate weight_delta_g where missing
3. Incomplete data: Infer reasonable values or mark as failed
4. Pro validation: Ensure data integrity for consumption/refill events
"""
import os
import sys
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError


def fix_weight_data():
    """Fix weight data inconsistencies in feed events."""
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
            'total': len(items),
            'fixed_delta': 0,
            'marked_failed': 0,
            'already_good': 0,
            'consumption_refill': 0,
            'skipped': 0
        }

        for item in items:
            feed_id = item.get('feed_id')
            status = item.get('status')
            event_type = item.get('event_type', 'manual_feed')
            mode = item.get('mode', 'unknown')
            timestamp = item.get('timestamp', 'unknown')

            weight_before = item.get('weight_before_g')
            weight_after = item.get('weight_after_g')
            weight_delta = item.get('weight_delta_g')

            # Skip consumption and refill events - they're already complete
            if event_type in ['consumption', 'refill']:
                stats['consumption_refill'] += 1
                continue

            # Skip non-completed events (queued, sent, etc.)
            if status != 'completed':
                stats['skipped'] += 1
                continue

            # Determine what needs fixing
            needs_update = False
            update_expression_parts = []
            expression_values = {}
            expression_names = {}

            # Case 1: No weight data at all - mark as failed
            if weight_before is None and weight_after is None:
                print(f"⚠ {feed_id[:8]}... ({timestamp[:10]}) - No weight data → FAILED")
                update_expression_parts.append('#s = :failed')
                expression_names['#s'] = 'status'
                expression_values[':failed'] = 'failed'
                needs_update = True
                stats['marked_failed'] += 1

            # Case 2: Has before but no after - likely feed never completed properly
            elif weight_before is not None and weight_after is None:
                # If weight_before is 0, scale wasn't working → mark failed
                if float(weight_before) == 0.0:
                    print(f"⚠ {feed_id[:8]}... ({timestamp[:10]}) - Before=0, After=null → FAILED")
                    update_expression_parts.append('#s = :failed')
                    expression_names['#s'] = 'status'
                    expression_values[':failed'] = 'failed'
                    stats['marked_failed'] += 1
                else:
                    # Had valid before weight, set after = before (assume no change)
                    print(f"✓ {feed_id[:8]}... ({timestamp[:10]}) - After=null → After={weight_before} (inferred)")
                    update_expression_parts.append('weight_after_g = :after')
                    expression_values[':after'] = weight_before
                    update_expression_parts.append('weight_delta_g = :delta')
                    expression_values[':delta'] = Decimal('0')
                    stats['fixed_delta'] += 1
                needs_update = True

            # Case 3: Has after but no before - legacy events
            elif weight_before is None and weight_after is not None:
                print(f"ℹ {feed_id[:8]}... ({timestamp[:10]}) - Before=null, After={weight_after} → Set Before=After")
                update_expression_parts.append('weight_before_g = :before')
                expression_values[':before'] = weight_after
                update_expression_parts.append('weight_delta_g = :delta')
                expression_values[':delta'] = Decimal('0')
                needs_update = True
                stats['fixed_delta'] += 1

            # Case 4: Has both but missing delta
            elif weight_before is not None and weight_after is not None:
                if weight_delta is None:
                    delta = Decimal(str(weight_after)) - Decimal(str(weight_before))
                    print(f"✓ {feed_id[:8]}... ({timestamp[:10]}) - Delta missing → {delta}g")
                    update_expression_parts.append('weight_delta_g = :delta')
                    expression_values[':delta'] = delta
                    needs_update = True
                    stats['fixed_delta'] += 1
                else:
                    stats['already_good'] += 1

            # Execute update if needed
            if needs_update:
                try:
                    update_expression = 'SET ' + ', '.join(update_expression_parts)

                    update_params = {
                        'Key': {'feed_id': feed_id},
                        'UpdateExpression': update_expression,
                        'ExpressionAttributeValues': expression_values
                    }

                    if expression_names:
                        update_params['ExpressionAttributeNames'] = expression_names

                    table.update_item(**update_params)

                except ClientError as e:
                    print(f"  ✗ Failed to update {feed_id}: {e}")

        print("\n" + "="*60)
        print("Fix Summary:")
        print(f"  Total events scanned: {stats['total']}")
        print(f"  Consumption/Refill (skipped): {stats['consumption_refill']}")
        print(f"  Non-completed (skipped): {stats['skipped']}")
        print(f"  Marked as FAILED: {stats['marked_failed']}")
        print(f"  Fixed with delta calculation: {stats['fixed_delta']}")
        print(f"  Already correct: {stats['already_good']}")
        print("="*60)

        return stats['marked_failed'] + stats['fixed_delta']

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
    print("Feed Event Weight Data Fixer")
    print("="*60)
    print()

    total_fixed = fix_weight_data()

    if total_fixed > 0:
        print(f"\n✓ Successfully fixed {total_fixed} feed events")
    else:
        print("\n✓ All events already have correct weight data")

    return 0


if __name__ == '__main__':
    sys.exit(main())
