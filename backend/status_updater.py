# backend/status_updater.py
import json
import os
import boto3
from datetime import datetime
from decimal import Decimal
from botocore.exceptions import ClientError


DYNAMODB_TABLE_NAME = os.environ.get("DEVICE_STATUS_TABLE_NAME")
IOT_THING_ID = os.environ.get("IOT_THING_ID")
AWS_REGION = os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))

# Ensure environment variables are set
if not DYNAMODB_TABLE_NAME or not IOT_THING_ID:
    print("ERROR: Missing required environment variables (DEVICE_STATUS_TABLE_NAME, IOT_THING_ID).")
    # In a production scenario, you might raise an exception or log to a dead-letter queue.
    # For now, we'll let it proceed to raise an error during execution if not set,
    # but this print statement helps with initial debugging.

# Initialize DynamoDB client (region is automatically detected in Lambda)
dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
table = dynamodb.Table(DYNAMODB_TABLE_NAME)


def handler(event, context):
    """
    AWS Lambda handler for processing IoT device status messages.
    This function is triggered by an AWS IoT Rule.
    """
    print(f"Received event: {json.dumps(event)}")

    try:
        # The IoT rule "SELECT * FROM 'petfeeder/status'" forwards the entire MQTT payload
        # as the event body. It's usually a JSON string.
        # Ensure the event structure matches what the IoT rule sends.
        # For a simple SELECT *, the MQTT payload is directly the event body.
        # If the payload is a string, parse it. If it's already an object, use it directly.
        if isinstance(event, str):
            payload = json.loads(event)
        elif isinstance(event, dict):
            payload = event
        else:
            raise ValueError("Unexpected event format. Expected string or dict.")

        feeder_state = payload.get("feeder_state", "unknown")
        network_status = payload.get("network_status", "unknown")
        message = payload.get("message", "No message")
        trigger_method = payload.get("trigger_method", "unknown")
        current_weight_g = payload.get("current_weight_g", 0.0)

        current_timestamp = datetime.utcnow().isoformat() + "Z"  # ISO 8601 with Z for UTC

        # Prepare the item to be stored/updated in DynamoDB
        # The 'thing_id' is the partition key for the DeviceStatus table.
        # DynamoDB requires Decimal type for numeric values, not float
        item = {
            'thing_id': IOT_THING_ID,
            'feeder_state': feeder_state,
            'network_status': network_status,
            'message': message,
            'trigger_method': trigger_method,
            'current_weight_g': Decimal(str(current_weight_g)),  # Convert to Decimal for DynamoDB
            'last_updated': current_timestamp
        }

        # PutItem will create a new item or replace an existing item with the same primary key.
        table.put_item(Item=item)

        print(f"Successfully updated device status for {IOT_THING_ID}: weight={current_weight_g}g, state={feeder_state}")
        return {
            'statusCode': 200,
            'body': json.dumps('Device status updated successfully!')
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
    except ValueError as e:
        print(f"Validation Error: {e}")
        return {
            'statusCode': 400,
            'body': json.dumps(f"Payload validation error: {e}")
        }
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f"Internal server error: {e}")
        }
