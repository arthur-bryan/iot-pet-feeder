# backend/status_updater.py
import json
import os
import boto3
from datetime import datetime

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')


def handler(event, context):
    """
    Lambda handler for processing IoT device status updates.
    Expects the MQTT payload as the event.
    """
    try:
        # The event is the MQTT payload from the IoT Rule
        payload = event

        table_name = os.environ.get("DEVICE_STATUS_TABLE_NAME")
        if not table_name:
            print("Error: DEVICE_STATUS_TABLE_NAME environment variable not set.")
            raise ValueError("DEVICE_STATUS_TABLE_NAME not configured.")

        table = dynamodb.Table(table_name)

        thing_id = os.environ.get("IOT_THING_ID")
        if not thing_id:
            print("Error: IOT_THING_ID environment variable not set.")
            raise ValueError("IOT_THING_ID not configured.")

        # Extract relevant status fields from the payload
        # Ensure these keys match what your ESP32 publishes
        feeder_state = payload.get("feeder_state", "unknown")
        network_status = payload.get("network_status", "unknown")
        message = payload.get("message", "No message")
        trigger_method = payload.get("trigger_method", "unknown")

        timestamp = datetime.utcnow().isoformat() + "Z"

        table.put_item(
            Item={
                'thingId': thing_id,
                'status': feeder_state,
                'network_status': network_status,
                'message': message,
                'trigger_method': trigger_method,
                'lastUpdated': timestamp
            }
        )
        print(f"Successfully updated status for {thing_id}: {feeder_state}")
        return {
            'statusCode': 200,
            'body': json.dumps('Status updated successfully!')
        }
    except Exception as e:
        print(f"Error updating device status: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error: {str(e)}')
        }
