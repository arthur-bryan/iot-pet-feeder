"""
Pytest fixtures and configuration for IoT Pet Feeder tests.
"""
import os

# Set environment variables BEFORE any imports
os.environ["AWS_REGION"] = "us-east-2"
os.environ["AWS_DEFAULT_REGION"] = "us-east-2"
os.environ["DYNAMO_FEED_HISTORY_TABLE"] = "test-feed-history"
os.environ["DYNAMO_FEED_SCHEDULE_TABLE"] = "test-feed-schedule"
os.environ["DEVICE_STATUS_TABLE_NAME"] = "test-device-status"
os.environ["DYNAMO_FEED_CONFIG_TABLE_NAME"] = "test-feed-config"
os.environ["DYNAMO_CONFIG_TABLE"] = "test-config"
os.environ["IOT_THING_ID"] = "test-thing-id"
os.environ["IOT_ENDPOINT"] = "test-endpoint.iot.us-east-2.amazonaws.com"
os.environ["ENVIRONMENT"] = "dev"
os.environ["SNS_TOPIC_ARN"] = "arn:aws:sns:us-east-2:123456789:test-topic"
os.environ["COGNITO_USER_POOL_ID"] = "us-east-2_testpool"
os.environ["DYNAMO_PENDING_USERS_TABLE"] = "test-pending-users"

from unittest.mock import MagicMock

import pytest


@pytest.fixture
def mock_dynamodb_table():
    """Mock DynamoDB table for testing."""
    mock_table = MagicMock()
    mock_table.put_item = MagicMock(return_value={})
    mock_table.get_item = MagicMock(return_value={'Item': None})
    mock_table.update_item = MagicMock(return_value={})
    mock_table.scan = MagicMock(return_value={'Items': []})
    mock_table.query = MagicMock(return_value={'Items': []})
    return mock_table


@pytest.fixture
def mock_iot_client():
    """Mock AWS IoT Data client for testing."""
    mock_client = MagicMock()
    mock_client.publish = MagicMock(return_value={})
    return mock_client


@pytest.fixture
def sample_feed_event():
    """Sample feed event payload from ESP32."""
    return {
        "feed_id": "test-feed-123",
        "mode": "manual",
        "requested_by": "api_user",
        "status": "initiated",
        "trigger_method": "api",
        "event_type": "manual_feed",
        "weight_before_g": 250.5
    }


@pytest.fixture
def sample_feed_event_completed():
    """Sample completed feed event payload."""
    return {
        "feed_id": "test-feed-123",
        "status": "completed",
        "weight_after_g": 275.0
    }


@pytest.fixture
def future_time_utc():
    """Generate a future time in UTC for testing (2 hours from now)."""
    from datetime import datetime, timedelta
    # Use utcnow() to get naive datetime, then add 'Z' for UTC
    return (datetime.utcnow() + timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%S') + 'Z'


@pytest.fixture
def sample_schedule():
    """Sample schedule data."""
    from datetime import datetime, timedelta
    future_time = (datetime.utcnow() + timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%S') + 'Z'
    return {
        "schedule_id": "test-schedule-123",
        "scheduled_time": future_time,
        "recurrence": "daily",
        "feed_cycles": 1,
        "enabled": True,
        "requested_by": "test@example.com"
    }


@pytest.fixture
def sample_status_event():
    """Sample device status event from ESP32."""
    return {
        "feeder_state": "CLOSED",
        "network_status": "ONLINE",
        "message": "Ready",
        "trigger_method": "system",
        "current_weight_g": 350.0
    }


@pytest.fixture
def mock_lambda_context():
    """Mock AWS Lambda context object."""
    context = MagicMock()
    context.function_name = "test-function"
    context.memory_limit_in_mb = 128
    context.invoked_function_arn = "arn:aws:lambda:us-east-2:123456789:function:test"
    context.aws_request_id = "test-request-id"
    return context
