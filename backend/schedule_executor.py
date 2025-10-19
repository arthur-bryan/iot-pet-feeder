# backend/schedule_executor.py
import json
import os
import boto3
from datetime import datetime, timedelta
from decimal import Decimal
from botocore.exceptions import ClientError

# Environment variables
FEED_SCHEDULE_TABLE_NAME = os.environ.get("DYNAMO_FEED_SCHEDULE_TABLE")
IOT_ENDPOINT = os.environ.get("IOT_ENDPOINT")
IOT_TOPIC_FEED = os.environ.get("IOT_TOPIC_FEED", "petfeeder/commands")
AWS_REGION = os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))

# Validate environment variables
if not FEED_SCHEDULE_TABLE_NAME:
    print("ERROR: Missing required environment variable: DYNAMO_FEED_SCHEDULE_TABLE")
if not IOT_ENDPOINT:
    print("ERROR: Missing required environment variable: IOT_ENDPOINT")

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
schedule_table = dynamodb.Table(FEED_SCHEDULE_TABLE_NAME)

iot_client = boto3.client(
    "iot-data",
    region_name=AWS_REGION,
    endpoint_url=f"https://{IOT_ENDPOINT}"
)


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


def is_schedule_due(schedule_time_str: str, current_time: datetime, tolerance_minutes: int = 1) -> bool:
    """
    Check if a schedule is due to execute within the tolerance window.

    Args:
        schedule_time_str: ISO 8601 datetime string (e.g., '2025-10-18T14:30:00Z')
        current_time: Current UTC datetime
        tolerance_minutes: Number of minutes tolerance for execution

    Returns:
        bool: True if schedule is due for execution
    """
    try:
        # Parse the scheduled time
        scheduled_time = datetime.fromisoformat(schedule_time_str.replace('Z', '+00:00'))

        # Remove timezone info for comparison (both are UTC)
        scheduled_time = scheduled_time.replace(tzinfo=None)

        # Check if scheduled time is in the past and within tolerance window
        time_diff = (current_time - scheduled_time).total_seconds() / 60  # minutes

        # Schedule is due if it's past its time but within tolerance window
        # and hasn't been executed too long ago
        return 0 <= time_diff <= tolerance_minutes
    except Exception as e:
        print(f"Error parsing schedule time '{schedule_time_str}': {e}")
        return False


def calculate_next_execution(schedule_time_str: str, recurrence: str) -> str:
    """
    Calculate the next execution time based on recurrence pattern.

    Args:
        schedule_time_str: Current scheduled time (ISO 8601)
        recurrence: Recurrence pattern ('none', 'daily', 'weekly')

    Returns:
        str: Next scheduled time in ISO 8601 format
    """
    try:
        scheduled_time = datetime.fromisoformat(schedule_time_str.replace('Z', '+00:00'))
        scheduled_time = scheduled_time.replace(tzinfo=None)

        if recurrence == 'daily':
            next_time = scheduled_time + timedelta(days=1)
        elif recurrence == 'weekly':
            next_time = scheduled_time + timedelta(weeks=1)
        else:  # 'none' or any other value
            return schedule_time_str  # Don't update

        return next_time.isoformat() + 'Z'
    except Exception as e:
        print(f"Error calculating next execution: {e}")
        return schedule_time_str


def publish_feed_command(schedule_id: str, feed_cycles: int) -> bool:
    """
    Publish a scheduled feed command to the IoT device via MQTT.

    Args:
        schedule_id: Unique identifier of the schedule
        feed_cycles: Number of feed cycles to execute

    Returns:
        bool: True if publish succeeded, False otherwise
    """
    try:
        # Build JSON command for ESP32
        command = {
            "command": "FEED_NOW",
            "cycles": feed_cycles,
            "trigger": "scheduled",
            "schedule_id": schedule_id
        }

        payload = json.dumps(command)

        # Publish to IoT Core
        iot_client.publish(
            topic=IOT_TOPIC_FEED,
            qos=1,  # QoS 1 for reliable delivery
            payload=payload
        )

        print(f"✅ Published scheduled feed command: {payload}")
        return True
    except ClientError as e:
        print(f"❌ Error publishing MQTT message: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error during MQTT publish: {e}")
        return False


def update_schedule_after_execution(schedule_id: str, scheduled_time: str, recurrence: str) -> bool:
    """
    Update schedule after execution - either disable it or set next execution time.

    Args:
        schedule_id: ID of the schedule to update
        scheduled_time: Current scheduled time
        recurrence: Recurrence pattern

    Returns:
        bool: True if update succeeded
    """
    try:
        if recurrence == 'none':
            # One-time schedule - disable it after execution
            schedule_table.update_item(
                Key={"schedule_id": schedule_id},
                UpdateExpression="SET enabled = :disabled, updated_at = :ua",
                ExpressionAttributeValues={
                    ":disabled": False,
                    ":ua": datetime.utcnow().isoformat()
                }
            )
            print(f"📅 One-time schedule {schedule_id} disabled after execution")
        else:
            # Recurring schedule - update to next execution time
            next_time = calculate_next_execution(scheduled_time, recurrence)
            schedule_table.update_item(
                Key={"schedule_id": schedule_id},
                UpdateExpression="SET scheduled_time = :st, updated_at = :ua",
                ExpressionAttributeValues={
                    ":st": next_time,
                    ":ua": datetime.utcnow().isoformat()
                }
            )
            print(f"🔄 Recurring schedule {schedule_id} updated to next execution: {next_time}")

        return True
    except ClientError as e:
        print(f"❌ Error updating schedule {schedule_id}: {e}")
        return False


def handler(event, context):
    """
    AWS Lambda handler for executing scheduled feeds.
    Triggered by EventBridge on a regular interval (e.g., every minute).

    This function:
    1. Queries all enabled schedules from DynamoDB
    2. Checks which schedules are due for execution
    3. Publishes MQTT commands to the IoT device
    4. Updates schedules (disable one-time, or update recurring)
    """
    print(f"🕐 Schedule executor invoked at {datetime.utcnow().isoformat()}")
    print(f"Event: {json.dumps(event)}")

    current_time = datetime.utcnow()
    executed_count = 0
    failed_count = 0

    try:
        # Scan for all enabled schedules
        response = schedule_table.scan(
            FilterExpression="enabled = :enabled",
            ExpressionAttributeValues={":enabled": True}
        )

        schedules = response.get("Items", [])
        print(f"📋 Found {len(schedules)} enabled schedule(s)")

        for schedule in schedules:
            schedule_data = convert_decimal(schedule)
            schedule_id = schedule_data.get("schedule_id")
            scheduled_time = schedule_data.get("scheduled_time")
            feed_cycles = schedule_data.get("feed_cycles", 1)
            recurrence = schedule_data.get("recurrence", "none")
            requested_by = schedule_data.get("requested_by", "scheduler")

            print(f"\n🔍 Checking schedule {schedule_id}:")
            print(f"   Scheduled time: {scheduled_time}")
            print(f"   Feed cycles: {feed_cycles}")
            print(f"   Recurrence: {recurrence}")
            print(f"   Requested by: {requested_by}")

            # Check if this schedule is due for execution
            if is_schedule_due(scheduled_time, current_time, tolerance_minutes=1):
                print(f"⏰ Schedule {schedule_id} is due for execution!")

                # Publish feed command to IoT device
                if publish_feed_command(schedule_id, feed_cycles):
                    # Update schedule after successful execution
                    if update_schedule_after_execution(schedule_id, scheduled_time, recurrence):
                        executed_count += 1
                        print(f"✅ Successfully executed schedule {schedule_id}")
                    else:
                        failed_count += 1
                        print(f"⚠️ Executed schedule {schedule_id} but failed to update it")
                else:
                    failed_count += 1
                    print(f"❌ Failed to execute schedule {schedule_id}")
            else:
                print(f"⏸️ Schedule {schedule_id} not due yet")

        # Summary
        summary = {
            "total_schedules": len(schedules),
            "executed": executed_count,
            "failed": failed_count,
            "timestamp": current_time.isoformat()
        }

        print(f"\n📊 Execution Summary: {json.dumps(summary)}")

        return {
            'statusCode': 200,
            'body': json.dumps(summary)
        }

    except ClientError as e:
        print(f"❌ DynamoDB Client Error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f"DynamoDB error: {e}")
        }
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f"Internal server error: {e}")
        }
