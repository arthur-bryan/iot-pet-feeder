# backend/demo_data_roller.py
#
# Demo Data Rolling Window Manager
#
# This Lambda function maintains a 90-day rolling window of demo data by:
# 1. Deleting feed events older than 90 days
# 2. Generating new simulated events for today
#
# Scheduled to run daily via EventBridge (midnight UTC)
# DEMO ENVIRONMENT ONLY - Do not use in production

import json
import os
import random
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

import boto3

# DynamoDB client
dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('DYNAMO_FEED_HISTORY_TABLE')
table = dynamodb.Table(table_name)

def handler(event, context):
    """
    Main handler for demo data rolling window

    1. Delete events older than 90 days
    2. Generate new events for today
    """
    try:
        print("Starting demo data rolling window process...")

        # Step 1: Delete old events
        cutoff_date = datetime.utcnow() - timedelta(days=90)
        deleted_count = delete_old_events(cutoff_date)
        print(f"Deleted {deleted_count} events older than {cutoff_date.isoformat()}")

        # Step 2: Generate new events for today
        generated_count = generate_todays_events()
        print(f"Generated {generated_count} new events for today")

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Demo data rolling window completed successfully',
                'deleted_events': deleted_count,
                'generated_events': generated_count
            })
        }

    except Exception as e:
        print(f"Error in demo data roller: {str(e)}")
        raise


def delete_old_events(cutoff_date):
    """Delete all feed events older than cutoff_date"""
    deleted_count = 0

    try:
        # Scan for old events (this is acceptable for demo with max 90 days of data)
        cutoff_timestamp = cutoff_date.isoformat() + 'Z'

        response = table.scan(
            FilterExpression='#ts < :cutoff',
            ExpressionAttributeNames={'#ts': 'timestamp'},
            ExpressionAttributeValues={':cutoff': cutoff_timestamp}
        )

        # Delete each old item
        for item in response.get('Items', []):
            table.delete_item(Key={'feed_id': item['feed_id']})
            deleted_count += 1

        # Handle pagination if needed
        while 'LastEvaluatedKey' in response:
            response = table.scan(
                FilterExpression='#ts < :cutoff',
                ExpressionAttributeNames={'#ts': 'timestamp'},
                ExpressionAttributeValues={':cutoff': cutoff_timestamp},
                ExclusiveStartKey=response['LastEvaluatedKey']
            )

            for item in response.get('Items', []):
                table.delete_item(Key={'feed_id': item['feed_id']})
                deleted_count += 1

    except Exception as e:
        print(f"Error deleting old events: {str(e)}")
        raise

    return deleted_count


def generate_todays_events():
    """Generate realistic simulated events for today"""
    generated_count = 0
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # Typical daily pattern:
    # - 2-3 scheduled feeds (morning, afternoon, evening)
    # - 3-5 consumption events throughout the day
    # - 0-1 manual feeds
    # - 0-1 refill

    events_to_create = []
    current_weight = Decimal(str(random.uniform(200, 400)))  # Starting weight

    # Morning feed (7-9 AM)
    morning_time = today + timedelta(hours=random.randint(7, 9), minutes=random.randint(0, 59))
    feed_amount = Decimal(str(random.uniform(15, 25)))
    events_to_create.append(create_feed_event(
        timestamp=morning_time,
        weight_before=current_weight,
        weight_after=current_weight + feed_amount,
        event_type='scheduled_feed',
        trigger_method='schedule'
    ))
    current_weight += feed_amount

    # Morning consumption (9-11 AM)
    consumption_time = morning_time + timedelta(hours=random.randint(1, 3))
    consumed = Decimal(str(random.uniform(10, 20)))
    events_to_create.append(create_feed_event(
        timestamp=consumption_time,
        weight_before=current_weight,
        weight_after=current_weight - consumed,
        event_type='consumption',
        trigger_method='device'
    ))
    current_weight -= consumed

    # Afternoon feed (12-2 PM)
    afternoon_time = today + timedelta(hours=random.randint(12, 14), minutes=random.randint(0, 59))
    feed_amount = Decimal(str(random.uniform(15, 25)))
    events_to_create.append(create_feed_event(
        timestamp=afternoon_time,
        weight_before=current_weight,
        weight_after=current_weight + feed_amount,
        event_type='scheduled_feed',
        trigger_method='schedule'
    ))
    current_weight += feed_amount

    # Afternoon consumption (3-5 PM)
    consumption_time = afternoon_time + timedelta(hours=random.randint(2, 4))
    consumed = Decimal(str(random.uniform(10, 20)))
    events_to_create.append(create_feed_event(
        timestamp=consumption_time,
        weight_before=current_weight,
        weight_after=current_weight - consumed,
        event_type='consumption',
        trigger_method='device'
    ))
    current_weight -= consumed

    # Evening feed (6-8 PM)
    evening_time = today + timedelta(hours=random.randint(18, 20), minutes=random.randint(0, 59))
    feed_amount = Decimal(str(random.uniform(15, 25)))
    events_to_create.append(create_feed_event(
        timestamp=evening_time,
        weight_before=current_weight,
        weight_after=current_weight + feed_amount,
        event_type='scheduled_feed',
        trigger_method='schedule'
    ))
    current_weight += feed_amount

    # Evening consumption (8-10 PM)
    consumption_time = evening_time + timedelta(hours=random.randint(1, 3))
    consumed = Decimal(str(random.uniform(10, 20)))
    events_to_create.append(create_feed_event(
        timestamp=consumption_time,
        weight_before=current_weight,
        weight_after=current_weight - consumed,
        event_type='consumption',
        trigger_method='device'
    ))
    current_weight -= consumed

    # Random manual feed (30% chance)
    if random.random() < 0.3:
        manual_hour = random.randint(10, 16)
        manual_time = today + timedelta(hours=manual_hour, minutes=random.randint(0, 59))
        feed_amount = Decimal(str(random.uniform(10, 20)))
        events_to_create.append(create_feed_event(
            timestamp=manual_time,
            weight_before=current_weight,
            weight_after=current_weight + feed_amount,
            event_type='manual_feed',
            trigger_method='api',
            requested_by='demo-user@example.com'
        ))
        current_weight += feed_amount

    # Random refill (20% chance, if weight is low)
    if random.random() < 0.2 and current_weight < Decimal('250'):
        refill_hour = random.randint(17, 21)
        refill_time = today + timedelta(hours=refill_hour, minutes=random.randint(0, 59))
        refill_amount = Decimal(str(random.uniform(100, 200)))
        events_to_create.append(create_feed_event(
            timestamp=refill_time,
            weight_before=current_weight,
            weight_after=current_weight + refill_amount,
            event_type='refill',
            trigger_method='device'
        ))
        current_weight += refill_amount

    # Write all events to DynamoDB
    for event_data in events_to_create:
        try:
            table.put_item(Item=event_data)
            generated_count += 1
        except Exception as e:
            print(f"Error creating event: {str(e)}")

    return generated_count


def create_feed_event(timestamp, weight_before, weight_after, event_type, trigger_method, requested_by=None):
    """Create a feed event item for DynamoDB"""
    weight_delta = weight_after - weight_before

    item = {
        'feed_id': str(uuid.uuid4()),
        'timestamp': timestamp.isoformat() + 'Z',
        'event_type': event_type,
        'trigger_method': trigger_method,
        'status': 'completed',
        'weight_before_g': weight_before,
        'weight_after_g': weight_after,
        'weight_delta_g': weight_delta,
        'device_id': 'demo-device',
        'simulated': True  # Mark as simulated data
    }

    if requested_by:
        item['requested_by'] = requested_by

    return item


if __name__ == '__main__':
    # For local testing
    print("Testing demo data roller locally...")
    result = handler({}, {})
    print(json.dumps(result, indent=2))
