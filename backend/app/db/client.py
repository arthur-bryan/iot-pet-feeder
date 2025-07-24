import boto3
from backend.app.core.config import settings


def get_dynamodb_resource():
    return boto3.resource("dynamodb", region_name=settings.AWS_REGION)


def get_feed_history_table():
    return get_dynamodb_resource().Table(settings.DYNAMO_FEED_HISTORY_TABLE)


def get_feed_schedule_table():
    return get_dynamodb_resource().Table(settings.DYNAMO_FEED_SCHEDULE_TABLE)

