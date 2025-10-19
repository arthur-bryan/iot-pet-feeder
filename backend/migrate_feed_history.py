#!/usr/bin/env python3
"""
Migration script to add event_type field to existing feed history records.
Run this once to update all old records in DynamoDB.

Usage:
    python backend/migrate_feed_history.py
"""
import boto3
import os
from decimal import Decimal

# Get table name from environment or use default
FEED_HISTORY_TABLE_NAME = os.environ.get("DYNAMO_FEED_HISTORY_TABLE", "iot-pet-feeder-feed-history-dev")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-2")

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
table = dynamodb.Table(FEED_HISTORY_TABLE_NAME)

def migrate_records():
    """
    Scans all feed history records and adds event_type='manual_feed' if missing.
    """
    print(f"🔄 Starting migration for table: {FEED_HISTORY_TABLE_NAME}")

    # Scan all items
    response = table.scan()
    items = response['Items']

    # Handle pagination if there are more items
    while 'LastEvaluatedKey' in response:
        response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        items.extend(response['Items'])

    print(f"📊 Found {len(items)} total records")

    updated_count = 0
    skipped_count = 0

    for item in items:
        feed_id = item.get('feed_id')

        # Check if event_type already exists
        if 'event_type' in item:
            skipped_count += 1
            continue

        # Update item with default event_type
        try:
            table.update_item(
                Key={'feed_id': feed_id},
                UpdateExpression='SET event_type = :event_type',
                ExpressionAttributeValues={
                    ':event_type': 'manual_feed'
                }
            )
            updated_count += 1
            print(f"✅ Updated record {feed_id}")
        except Exception as e:
            print(f"❌ Failed to update {feed_id}: {e}")

    print(f"\n📈 Migration complete!")
    print(f"   ✅ Updated: {updated_count} records")
    print(f"   ⏭️  Skipped: {skipped_count} records (already had event_type)")
    print(f"\nNote: weight_before_g, weight_after_g, and weight_delta_g will remain null for old records.")
    print("New events will automatically include these fields.")

if __name__ == "__main__":
    confirm = input(f"⚠️  This will update records in table '{FEED_HISTORY_TABLE_NAME}'. Continue? (yes/no): ")
    if confirm.lower() == 'yes':
        migrate_records()
    else:
        print("Migration cancelled.")
