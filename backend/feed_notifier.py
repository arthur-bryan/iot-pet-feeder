# backend/feed_notifier.py
import json
import os
import boto3
from datetime import datetime
from botocore.exceptions import ClientError

# Environment variables
CONFIG_TABLE_NAME = os.environ.get("DYNAMO_CONFIG_TABLE")
AWS_REGION = os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN")

# Ensure environment variables are set
if not CONFIG_TABLE_NAME:
    print("ERROR: Missing required environment variable: DYNAMO_CONFIG_TABLE")
if not SNS_TOPIC_ARN:
    print("ERROR: Missing required environment variable: SNS_TOPIC_ARN")

# Initialize clients outside handler for Lambda container reuse
dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
sns_client = boto3.client('sns', region_name=AWS_REGION)
config_table = dynamodb.Table(CONFIG_TABLE_NAME)


def get_email_config():
    """
    Fetch email notification configuration from DynamoDB.
    Returns dict with 'email' and 'enabled' keys, or None if not configured.
    """
    try:
        response = config_table.get_item(Key={'config_key': 'EMAIL_NOTIFICATIONS'})
        if 'Item' in response:
            config_value = response['Item'].get('value')
            if config_value:
                return json.loads(config_value)
        return None
    except ClientError as e:
        print(f"Error fetching email config: {e}")
        return None


def send_email_notification(subject, message, user_email):
    """
    Send email notification via SNS.
    Publishes to SNS topic with email filter attribute.
    """
    try:
        response = sns_client.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=subject,
            Message=message,
            MessageAttributes={
                'email': {
                    'DataType': 'String',
                    'StringValue': user_email
                }
            }
        )
        print(f"Notification published to SNS for {user_email}. MessageId: {response['MessageId']}")
        return True
    except ClientError as e:
        print(f"Error publishing to SNS: {e}")
        return False


def handler(event, context):
    """
    AWS Lambda handler for sending email notifications about feed events.
    Triggered by DynamoDB Stream from feed_history table.

    Only sends notifications for:
    - Feed completion (status='completed')
    - Feed failure (status='failed')

    Does NOT send notifications for:
    - Feed initiation (status='initiated')
    - Consumption events (event_type='consumption')
    """
    print(f"RAW EVENT RECEIVED: {json.dumps(event, default=str)}")

    try:
        # Check email config first
        email_config = get_email_config()
        if not email_config:
            print("Email notifications not configured. Skipping.")
            return {'statusCode': 200, 'body': 'No email config'}

        if not email_config.get('enabled'):
            print("Email notifications disabled. Skipping.")
            return {'statusCode': 200, 'body': 'Email notifications disabled'}

        email = email_config.get('email')
        if not email:
            print("No email address configured. Skipping.")
            return {'statusCode': 200, 'body': 'No email address'}

        # Process DynamoDB Stream records
        for record in event.get('Records', []):
            event_name = record.get('eventName')

            # We care about INSERT (new events) and MODIFY (status updates)
            if event_name not in ['INSERT', 'MODIFY']:
                continue

            # Get the new image (current state of the item)
            new_image = record.get('dynamodb', {}).get('NewImage', {})
            if not new_image:
                continue

            # Extract relevant fields from DynamoDB format
            status = new_image.get('status', {}).get('S', '')
            event_type = new_image.get('event_type', {}).get('S', 'manual_feed')
            mode = new_image.get('mode', {}).get('S', 'unknown')
            requested_by = new_image.get('requested_by', {}).get('S', 'unknown')
            timestamp = new_image.get('timestamp', {}).get('S', '')
            feed_id = new_image.get('feed_id', {}).get('S', '')

            print(f"Processing record: feed_id={feed_id}, status={status}, event_type={event_type}")

            # ONLY send notifications for feed events (not consumption)
            if event_type == 'consumption':
                print(f"Skipping consumption event: {feed_id}")
                continue

            # ONLY send notifications for completed or failed feeds
            if status not in ['completed', 'failed']:
                print(f"Skipping feed with status '{status}': {feed_id}")
                continue

            # Prepare email content
            if status == 'completed':
                subject = "Pet Feeder: Feed Successful"
                message = f"""Your pet feeder successfully dispensed food.

Feed ID: {feed_id}
Mode: {mode}
Requested by: {requested_by}
Time: {timestamp}

Your pet has been fed!
"""
            else:  # status == 'failed'
                subject = "Pet Feeder: Feed Failed"
                message = f"""WARNING: Your pet feeder failed to dispense food.

Feed ID: {feed_id}
Mode: {mode}
Requested by: {requested_by}
Time: {timestamp}

Please check your device.
"""

            # Send email
            send_email_notification(subject, message, email)

        return {
            'statusCode': 200,
            'body': json.dumps('Feed notifications processed successfully')
        }

    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f"Internal server error: {e}")
        }
