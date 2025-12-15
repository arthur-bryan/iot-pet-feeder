# backend/feed_event_logger.py
import json
import logging
import os
import uuid
from datetime import datetime
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

FEED_HISTORY_TABLE_NAME = os.environ.get("DYNAMO_FEED_HISTORY_TABLE")
AWS_REGION = os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))

if not FEED_HISTORY_TABLE_NAME:
    logger.error("Missing required environment variable: DYNAMO_FEED_HISTORY_TABLE")

dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
table = dynamodb.Table(FEED_HISTORY_TABLE_NAME)


def handler(event, context):
    """
    AWS Lambda handler for logging feed events from IoT device.
    Triggered by IoT Rule on topic 'petfeeder/feed_event'.

    Handles both creating new events (status='initiated') and updating existing events
    (status='completed' or 'failed') using the same feed_id.
    """
    logger.info("Event received: %s", json.dumps(event, default=str))

    try:
        if isinstance(event, str):
            payload = json.loads(event)
        elif isinstance(event, dict):
            payload = event
        else:
            raise ValueError("Unexpected event format. Expected string or dict.")

        feed_id = payload.get("feed_id")
        if not feed_id:
            logger.warning("No feed_id in payload, generating new UUID")
            feed_id = str(uuid.uuid4())

        mode = payload.get("mode", "unknown")
        requested_by = payload.get("requested_by", "unknown")
        status = payload.get("status", "unknown")
        event_type = payload.get("event_type", "manual_feed")
        weight_before_g = payload.get("weight_before_g")
        weight_after_g = payload.get("weight_after_g")

        if status in ["completed", "failed"]:
            logger.info("Updating feed event %s with status '%s'", feed_id, status)

            existing_item = None
            try:
                response = table.get_item(Key={'feed_id': feed_id})
                existing_item = response.get('Item')
            except Exception as e:
                logger.warning("Could not fetch existing item: %s", e)

            if existing_item:
                update_expression = "SET #status = :status"
                expression_attribute_names = {"#status": "status"}
                expression_attribute_values = {":status": status}

                if weight_after_g is not None:
                    update_expression += ", weight_after_g = :weight_after"
                    expression_attribute_values[":weight_after"] = Decimal(str(weight_after_g))

                    if 'weight_before_g' in existing_item:
                        weight_before = float(existing_item['weight_before_g'])
                        weight_delta = float(weight_after_g) - weight_before
                        update_expression += ", weight_delta_g = :weight_delta"
                        expression_attribute_values[":weight_delta"] = Decimal(str(round(weight_delta, 1)))

                table.update_item(
                    Key={'feed_id': feed_id},
                    UpdateExpression=update_expression,
                    ExpressionAttributeNames=expression_attribute_names,
                    ExpressionAttributeValues=expression_attribute_values
                )
                logger.info("Updated feed event %s to status '%s'", feed_id, status)
            else:
                logger.info("Item %s doesn't exist, creating with status '%s'", feed_id, status)
                timestamp = datetime.utcnow().isoformat() + "Z"

                item = {
                    'feed_id': feed_id,
                    'requested_by': requested_by if requested_by != "unknown" else "unknown",
                    'mode': mode if mode != "unknown" else "unknown",
                    'status': status,
                    'timestamp': timestamp,
                    'event_type': event_type
                }

                if weight_after_g is not None:
                    item['weight_after_g'] = Decimal(str(weight_after_g))

                table.put_item(Item=item)
                logger.info("Created feed event %s with status '%s'", feed_id, status)
        else:
            logger.info("Creating new feed event %s with status '%s'", feed_id, status)

            timestamp = datetime.utcnow().isoformat() + "Z"

            item = {
                'feed_id': feed_id,
                'requested_by': requested_by,
                'mode': mode,
                'status': status,
                'timestamp': timestamp,
                'event_type': event_type
            }

            if weight_before_g is not None:
                item['weight_before_g'] = Decimal(str(weight_before_g))

            try:
                table.put_item(
                    Item=item,
                    ConditionExpression='attribute_not_exists(feed_id)'
                )
                logger.info("Created feed event %s", feed_id)
            except ClientError as e:
                if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                    logger.info("Item %s already exists, skipping creation", feed_id)
                else:
                    raise

        return {
            'statusCode': 200,
            'body': json.dumps('Feed event logged successfully!')
        }

    except json.JSONDecodeError as e:
        logger.error("Error decoding JSON payload: %s", e)
        return {
            'statusCode': 400,
            'body': json.dumps(f"Invalid JSON payload: {e}")
        }
    except ClientError as e:
        logger.error("DynamoDB Client Error: %s", e)
        return {
            'statusCode': 500,
            'body': json.dumps(f"DynamoDB error: {e}")
        }
    except Exception as e:
        logger.error("An unexpected error occurred: %s", e)
        return {
            'statusCode': 500,
            'body': json.dumps(f"Internal server error: {e}")
        }
