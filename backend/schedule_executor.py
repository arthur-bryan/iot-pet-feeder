# backend/schedule_executor.py
import asyncio
import json
import os
from datetime import datetime, timedelta
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError

# Environment variables
ENVIRONMENT = os.environ.get("ENVIRONMENT", "prd").lower()
FEED_SCHEDULE_TABLE_NAME = os.environ.get("DYNAMO_FEED_SCHEDULE_TABLE")
SCHEDULE_EXECUTION_HISTORY_TABLE = os.environ.get("SCHEDULE_EXECUTION_HISTORY_TABLE")
IOT_ENDPOINT = os.environ.get("IOT_ENDPOINT")
IOT_TOPIC_FEED = os.environ.get("IOT_TOPIC_FEED", "petfeeder/commands")
AWS_REGION = os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))

# Validate environment variables
if not FEED_SCHEDULE_TABLE_NAME:
    print("ERROR: Missing required environment variable: DYNAMO_FEED_SCHEDULE_TABLE")

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
schedule_table = dynamodb.Table(FEED_SCHEDULE_TABLE_NAME)
execution_history_table = dynamodb.Table(SCHEDULE_EXECUTION_HISTORY_TABLE) if SCHEDULE_EXECUTION_HISTORY_TABLE else None

# IoT client only needed for production (real ESP32)
iot_client = None
if ENVIRONMENT != "demo":
    if not IOT_ENDPOINT:
        print("ERROR: Missing required environment variable: IOT_ENDPOINT for production environment")
    else:
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


def log_execution_history(
    schedule_id: str,
    scheduled_time: str,
    status: str,
    feed_cycles: int,
    recurrence: str,
    requested_by: str,
    error_message: str = None
) -> None:
    """
    Log schedule execution to history table for audit trail.

    Args:
        schedule_id: ID of the schedule that was executed
        scheduled_time: Scheduled time of the execution
        status: 'success' or 'failed'
        feed_cycles: Number of feed cycles
        recurrence: Recurrence pattern
        requested_by: User who created the schedule
        error_message: Optional error message if failed
    """
    if not execution_history_table:
        print("Warning: Execution history table not configured, skipping history log")
        return

    import uuid
    try:
        execution_record = {
            'execution_id': str(uuid.uuid4()),
            'schedule_id': schedule_id,
            'scheduled_time': scheduled_time,
            'executed_at': datetime.utcnow().isoformat() + 'Z',
            'status': status,
            'feed_cycles': feed_cycles,
            'recurrence': recurrence,
            'requested_by': requested_by,
            'environment': ENVIRONMENT
        }

        if error_message:
            execution_record['error_message'] = error_message

        execution_history_table.put_item(Item=execution_record)
        print(f"Logged execution history: {execution_record['execution_id']}")
    except Exception as e:
        print(f"Warning: Failed to log execution history: {e}")


def is_schedule_due(schedule_time_str: str, current_time: datetime, tolerance_minutes: int = 1, max_overdue_minutes: int = 60) -> bool:
    """
    Check if a schedule is due to execute.

    All times are stored in UTC in DynamoDB, so we compare UTC times directly.

    Args:
        schedule_time_str: ISO 8601 datetime string in UTC (e.g., '2025-10-18T14:30:00Z')
        current_time: Current UTC datetime
        tolerance_minutes: Number of minutes tolerance for normal execution (default: 1)
        max_overdue_minutes: Maximum minutes overdue to still execute (default: 60)

    Returns:
        bool: True if schedule is due for execution (past scheduled time but not too old)
    """
    try:
        # Parse the scheduled time (stored in UTC)
        scheduled_time = datetime.fromisoformat(schedule_time_str.replace('Z', '+00:00'))

        # Remove timezone info for comparison (both are UTC)
        scheduled_time = scheduled_time.replace(tzinfo=None)

        # Calculate how overdue the schedule is
        time_diff = (current_time - scheduled_time).total_seconds() / 60  # minutes

        # Schedule is due if:
        # 1. It's past the scheduled time (time_diff >= 0)
        # 2. It's not too old (time_diff <= max_overdue_minutes)
        # This allows catching up on missed/rescheduled executions
        return 0 <= time_diff <= max_overdue_minutes
    except Exception as e:
        print(f"Error parsing schedule time '{schedule_time_str}': {e}")
        return False


def calculate_next_execution(schedule_time_str: str, recurrence: str) -> str:
    """
    Calculate the next execution time based on recurrence pattern.
    All times are in UTC.

    Args:
        schedule_time_str: Current scheduled time in UTC (ISO 8601)
        recurrence: Recurrence pattern ('none', 'daily', 'weekly', 'monthly')

    Returns:
        str: Next scheduled time in ISO 8601 UTC format
    """
    try:
        scheduled_time = datetime.fromisoformat(schedule_time_str.replace('Z', '+00:00'))
        scheduled_time = scheduled_time.replace(tzinfo=None)

        if recurrence == 'daily':
            next_time = scheduled_time + timedelta(days=1)
        elif recurrence == 'weekly':
            next_time = scheduled_time + timedelta(weeks=1)
        elif recurrence == 'monthly':
            # Add approximately 30 days, then adjust to same day of month
            month = scheduled_time.month
            year = scheduled_time.year
            if month == 12:
                next_month = 1
                next_year = year + 1
            else:
                next_month = month + 1
                next_year = year

            # Handle edge case: if current day doesn't exist in next month (e.g., Jan 31 -> Feb 28)
            import calendar
            max_day = calendar.monthrange(next_year, next_month)[1]
            next_day = min(scheduled_time.day, max_day)

            next_time = scheduled_time.replace(year=next_year, month=next_month, day=next_day)
        else:  # 'none' or any other value
            return schedule_time_str  # Don't update

        return next_time.isoformat() + 'Z'
    except Exception as e:
        print(f"Error calculating next execution: {e}")
        return schedule_time_str


def trigger_scheduled_feed(schedule_id: str, feed_cycles: int, requested_by: str) -> bool:
    """
    Trigger a scheduled feed by calling the feed service.
    This ensures feed events are created in DynamoDB with proper event_type.

    Args:
        schedule_id: Unique identifier of the schedule
        feed_cycles: Number of feed cycles to execute
        requested_by: User who created the schedule

    Returns:
        bool: True if succeeded, False otherwise
    """
    try:
        # Import feed service and models
        from app.models.feed import FeedRequest
        from app.services.feed_service import process_feed

        # Create feed request with mode="scheduled"
        feed_request = FeedRequest(
            mode="scheduled",
            requested_by=requested_by,
            feed_cycles=feed_cycles
        )

        # Process feed - this will:
        # 1. Publish MQTT to ESP32
        # 2. Create feed event in DynamoDB with event_type="scheduled_feed"
        result = asyncio.run(process_feed(feed_request))

        if result.status == 'sent':
            print(f"Scheduled feed triggered successfully: schedule_id={schedule_id}, feed_id={result.feed_id}")
            return True
        else:
            print(f"Scheduled feed failed: status={result.status}")
            return False

    except Exception as e:
        print(f"Unexpected error during feed trigger: {e}")
        import traceback
        traceback.print_exc()
        return False


def update_schedule_after_execution(schedule_id: str, scheduled_time: str, recurrence: str) -> bool:
    """
    Update schedule after execution - either disable it or set next execution time.
    Also tracks last_executed_at timestamp.

    Args:
        schedule_id: ID of the schedule to update
        scheduled_time: Current scheduled time
        recurrence: Recurrence pattern

    Returns:
        bool: True if update succeeded
    """
    try:
        current_time = datetime.utcnow().isoformat()

        if recurrence == 'none':
            # One-time schedule - disable it after execution
            schedule_table.update_item(
                Key={"schedule_id": schedule_id},
                UpdateExpression="SET enabled = :disabled, updated_at = :ua, last_executed_at = :lea",
                ExpressionAttributeValues={
                    ":disabled": False,
                    ":ua": current_time,
                    ":lea": current_time
                }
            )
            print(f"One-time schedule {schedule_id} disabled after execution")
        else:
            # Recurring schedule - update to next execution time
            next_time = calculate_next_execution(scheduled_time, recurrence)
            schedule_table.update_item(
                Key={"schedule_id": schedule_id},
                UpdateExpression="SET scheduled_time = :st, updated_at = :ua, last_executed_at = :lea",
                ExpressionAttributeValues={
                    ":st": next_time,
                    ":ua": current_time,
                    ":lea": current_time
                }
            )
            print(f"Recurring schedule {schedule_id} updated to next execution: {next_time}")

        return True
    except ClientError as e:
        print(f"Error updating schedule {schedule_id}: {e}")
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
    print(f"Schedule executor invoked at {datetime.utcnow().isoformat()}")
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
        print(f"Found {len(schedules)} enabled schedule(s)")

        for schedule in schedules:
            schedule_data = convert_decimal(schedule)
            schedule_id = schedule_data.get("schedule_id")
            scheduled_time = schedule_data.get("scheduled_time")
            feed_cycles = schedule_data.get("feed_cycles", 1)
            recurrence = schedule_data.get("recurrence", "none")
            requested_by = schedule_data.get("requested_by", "scheduler")
            last_executed_at = schedule_data.get("last_executed_at")

            print(f"\nChecking schedule {schedule_id}:")
            print(f"   Scheduled time: {scheduled_time}")
            print(f"   Last executed: {last_executed_at}")
            print(f"   Feed cycles: {feed_cycles}")
            print(f"   Recurrence: {recurrence}")
            print(f"   Requested by: {requested_by}")

            # Check if this schedule is due for execution
            if is_schedule_due(scheduled_time, current_time, tolerance_minutes=1):
                # Prevent re-execution: only execute if never executed OR if scheduled_time changed
                if last_executed_at is None or last_executed_at != scheduled_time:
                    print(f"Schedule {schedule_id} is due for execution")

                    # Trigger feed (real or simulated based on environment)
                    if trigger_scheduled_feed(schedule_id, feed_cycles, requested_by):
                        # Update schedule after successful execution
                        if update_schedule_after_execution(schedule_id, scheduled_time, recurrence):
                            executed_count += 1
                            print(f"Successfully executed schedule {schedule_id}")
                            log_execution_history(
                                schedule_id=schedule_id,
                                scheduled_time=scheduled_time,
                                status='success',
                                feed_cycles=feed_cycles,
                                recurrence=recurrence,
                                requested_by=requested_by
                            )
                        else:
                            failed_count += 1
                            print(f"Executed schedule {schedule_id} but failed to update it")
                            log_execution_history(
                                schedule_id=schedule_id,
                                scheduled_time=scheduled_time,
                                status='failed',
                                feed_cycles=feed_cycles,
                                recurrence=recurrence,
                                requested_by=requested_by,
                                error_message='Failed to update schedule after execution'
                            )
                    else:
                        failed_count += 1
                        print(f"Failed to execute schedule {schedule_id}")
                        log_execution_history(
                            schedule_id=schedule_id,
                            scheduled_time=scheduled_time,
                            status='failed',
                            feed_cycles=feed_cycles,
                            recurrence=recurrence,
                            requested_by=requested_by,
                            error_message='Failed to trigger feed'
                        )
                else:
                    print(f"Schedule {schedule_id} already executed for this time (last_executed_at={last_executed_at})")
            else:
                print(f"Schedule {schedule_id} not due yet")

        # Summary
        summary = {
            "total_schedules": len(schedules),
            "executed": executed_count,
            "failed": failed_count,
            "timestamp": current_time.isoformat()
        }

        print(f"\nExecution Summary: {json.dumps(summary)}")

        return {
            'statusCode': 200,
            'body': json.dumps(summary)
        }

    except ClientError as e:
        print(f"DynamoDB Client Error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f"DynamoDB error: {e}")
        }
    except Exception as e:
        print(f"Unexpected error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f"Internal server error: {e}")
        }
