# backend/feed_event_logger.py
import json
import os
import boto3
import uuid
from datetime import datetime
from decimal import Decimal
from botocore.exceptions import ClientError

FEED_HISTORY_TABLE_NAME = os.environ.get("DYNAMO_FEED_HISTORY_TABLE")
AWS_REGION = os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))

# Ensure environment variables are set
if not FEED_HISTORY_TABLE_NAME:
    print("ERROR: Missing required environment variable: DYNAMO_FEED_HISTORY_TABLE")

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
table = dynamodb.Table(FEED_HISTORY_TABLE_NAME)


def handler(event, context):
    """
    AWS Lambda handler for logging feed events from IoT device.
    Triggered by IoT Rule on topic 'petfeeder/feed_event'.

    Handles both creating new events (status='initiated') and updating existing events
    (status='completed' or 'failed') using the same feed_id.
    """
    print(f"RAW EVENT RECEIVED: {json.dumps(event, default=str)}")
    print(f"EVENT TYPE: {type(event)}")

    try:
        # Parse event payload
        if isinstance(event, str):
            payload = json.loads(event)
        elif isinstance(event, dict):
            payload = event
        else:
            raise ValueError("Unexpected event format. Expected string or dict.")

        print(f"PARSED PAYLOAD: {json.dumps(payload, default=str)}")

        # Extract feed_id from payload (sent by ESP32)
        feed_id = payload.get("feed_id")
        if not feed_id:
            print("WARNING: No feed_id in payload, generating new UUID")
            feed_id = str(uuid.uuid4())

        mode = payload.get("mode", "unknown")
        requested_by = payload.get("requested_by", "unknown")
        status = payload.get("status", "unknown")
        trigger_method = payload.get("trigger_method", "unknown")

        # New fields for behavior tracking
        event_type = payload.get("event_type", "manual_feed")
        weight_before_g = payload.get("weight_before_g")
        weight_after_g = payload.get("weight_after_g")

        # DEBUG: Log ALL payload keys
        print(f"PAYLOAD KEYS: {list(payload.keys())}")
        print(f"DEBUG: feed_id = {feed_id}, status = {status}, event_type = {event_type}")
        print(f"DEBUG: weight_before_g = {weight_before_g} (type: {type(weight_before_g).__name__}, present: {'weight_before_g' in payload})")
        print(f"DEBUG: weight_after_g = {weight_after_g} (type: {type(weight_after_g).__name__}, present: {'weight_after_g' in payload})")
        print(f"DEBUG: mode = {mode}, requested_by = {requested_by}, trigger_method = {trigger_method}")

        # Check if this is an update (completed/failed) or a new event (initiated)
        if status in ["completed", "failed"]:
            # UPDATE existing event
            print(f"Updating existing feed event {feed_id} with status '{status}'")

            update_expression = "SET #status = :status"
            expression_attribute_names = {"#status": "status"}
            expression_attribute_values = {":status": status}

            # Add weight_after_g if provided
            if weight_after_g is not None:
                update_expression += ", weight_after_g = :weight_after"
                expression_attribute_values[":weight_after"] = Decimal(str(weight_after_g))
                print(f"DEBUG: Adding weight_after_g: {weight_after_g}")

                # Try to calculate delta if we have weight_before in the existing item
                try:
                    existing_item = table.get_item(Key={'feed_id': feed_id})
                    if 'Item' in existing_item and 'weight_before_g' in existing_item['Item']:
                        weight_before = float(existing_item['Item']['weight_before_g'])
                        weight_delta = float(weight_after_g) - weight_before
                        update_expression += ", weight_delta_g = :weight_delta"
                        expression_attribute_values[":weight_delta"] = Decimal(str(round(weight_delta, 1)))
                        print(f"DEBUG: Calculated weight_delta_g: {round(weight_delta, 1)}")
                except Exception as e:
                    print(f"Could not calculate delta: {e}")

            table.update_item(
                Key={'feed_id': feed_id},
                UpdateExpression=update_expression,
                ExpressionAttributeNames=expression_attribute_names,
                ExpressionAttributeValues=expression_attribute_values
            )

            print(f"Successfully updated feed event {feed_id} to status '{status}'")
        else:
            # CREATE new event (status = 'initiated' or other initial status)
            print(f"Creating new feed event {feed_id} with status '{status}'")

            timestamp = datetime.utcnow().isoformat() + "Z"  # Add 'Z' suffix to indicate UTC

            # Prepare item for DynamoDB
            item = {
                'feed_id': feed_id,
                'requested_by': requested_by,
                'mode': mode,
                'status': status,
                'timestamp': timestamp,
                'event_type': event_type
            }

            # Add weight_before_g if available
            if weight_before_g is not None:
                item['weight_before_g'] = Decimal(str(weight_before_g))
                print(f"DEBUG: Added weight_before_g to item: {item['weight_before_g']}")
            else:
                print(f"DEBUG: weight_before_g is None, not adding to item")

            # Save to DynamoDB
            print(f"DEBUG: About to save item to DynamoDB: {json.dumps(item, default=str)}")
            table.put_item(Item=item)
            print(f"DEBUG: Successfully wrote to DynamoDB")

            print(f"Successfully created feed event {feed_id}: {json.dumps(item, default=str)}")

        return {
            'statusCode': 200,
            'body': json.dumps('Feed event logged successfully!')
        }

    except json.JSONDecodeError as e:
        print(f"Error decoding JSON payload: {e}")
        return {
            'statusCode': 400,
            'body': json.dumps(f"Invalid JSON payload: {e}")
        }
    except ClientError as e:
        print(f"DynamoDB Client Error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f"DynamoDB error: {e}")
        }
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f"Internal server error: {e}")
        }
