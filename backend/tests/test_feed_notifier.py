"""
Tests for feed_notifier Lambda handler.
"""
import json
import sys
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture(autouse=True)
def mock_boto3_resources():
    """Mock boto3 resources before importing feed_notifier."""
    mock_table = MagicMock()
    mock_sns = MagicMock()
    mock_dynamodb = MagicMock()
    mock_dynamodb.Table.return_value = mock_table

    with patch.dict('sys.modules', {}):
        with patch('boto3.resource', return_value=mock_dynamodb):
            with patch('boto3.client', return_value=mock_sns):
                if 'feed_notifier' in sys.modules:
                    del sys.modules['feed_notifier']
                yield {
                    'table': mock_table,
                    'sns': mock_sns,
                    'dynamodb': mock_dynamodb
                }


class TestFeedNotifier:
    """Test cases for feed notification functionality."""

    def test_get_email_config_returns_none_when_not_configured(self, mock_boto3_resources):
        """Test that get_email_config returns None when not configured."""
        mock_boto3_resources['table'].get_item.return_value = {}

        with patch('boto3.resource') as mock_resource:
            mock_resource.return_value.Table.return_value = mock_boto3_resources['table']
            with patch('boto3.client'):
                import feed_notifier
                result = feed_notifier.get_email_config()

        assert result is None

    def test_get_email_config_returns_config_when_exists(self, mock_boto3_resources):
        """Test that get_email_config returns config when it exists."""
        config = {"email": "test@example.com", "enabled": True}
        mock_boto3_resources['table'].get_item.return_value = {
            'Item': {'config_key': 'EMAIL_NOTIFICATIONS', 'value': json.dumps(config)}
        }

        with patch('boto3.resource') as mock_resource:
            mock_resource.return_value.Table.return_value = mock_boto3_resources['table']
            with patch('boto3.client'):
                if 'feed_notifier' in sys.modules:
                    del sys.modules['feed_notifier']
                import feed_notifier
                feed_notifier.config_table = mock_boto3_resources['table']
                result = feed_notifier.get_email_config()

        assert result == config

    def test_send_email_notification_publishes_to_sns(self, mock_boto3_resources):
        """Test that send_email_notification publishes to SNS."""
        mock_boto3_resources['sns'].publish.return_value = {'MessageId': 'test-123'}

        with patch('boto3.resource') as mock_resource:
            mock_resource.return_value.Table.return_value = mock_boto3_resources['table']
            with patch('boto3.client', return_value=mock_boto3_resources['sns']):
                if 'feed_notifier' in sys.modules:
                    del sys.modules['feed_notifier']
                import feed_notifier
                feed_notifier.sns_client = mock_boto3_resources['sns']
                result = feed_notifier.send_email_notification(
                    "Test Subject",
                    "Test Message",
                    "test@example.com"
                )

        assert result is True
        mock_boto3_resources['sns'].publish.assert_called_once()

    def test_handler_skips_when_notifications_disabled(self, mock_boto3_resources, mock_lambda_context):
        """Test that handler skips when notifications are disabled."""
        mock_boto3_resources['table'].get_item.return_value = {
            'Item': {
                'config_key': 'EMAIL_NOTIFICATIONS',
                'value': json.dumps({"email": "test@example.com", "enabled": False})
            }
        }

        with patch('boto3.resource') as mock_resource:
            mock_resource.return_value.Table.return_value = mock_boto3_resources['table']
            with patch('boto3.client', return_value=mock_boto3_resources['sns']):
                if 'feed_notifier' in sys.modules:
                    del sys.modules['feed_notifier']
                import feed_notifier
                feed_notifier.config_table = mock_boto3_resources['table']
                result = feed_notifier.handler({'Records': []}, mock_lambda_context)

        assert result['statusCode'] == 200

    def test_handler_sends_notification_on_completed_feed(self, mock_boto3_resources, mock_lambda_context):
        """Test that handler sends notification when feed is completed."""
        mock_boto3_resources['table'].get_item.return_value = {
            'Item': {
                'config_key': 'EMAIL_NOTIFICATIONS',
                'value': json.dumps({
                    "email": "test@example.com",
                    "enabled": True,
                    "preferences": {"feedings": True, "failures": True, "pet_ate": False}
                })
            }
        }
        mock_boto3_resources['sns'].publish.return_value = {'MessageId': 'test-123'}

        event = {
            'Records': [{
                'eventName': 'INSERT',
                'dynamodb': {
                    'NewImage': {
                        'feed_id': {'S': 'test-123'},
                        'status': {'S': 'completed'},
                        'event_type': {'S': 'manual_feed'},
                        'mode': {'S': 'manual'},
                        'requested_by': {'S': 'user'},
                        'timestamp': {'S': '2025-12-13T14:00:00Z'}
                    }
                }
            }]
        }

        with patch('boto3.resource') as mock_resource:
            mock_resource.return_value.Table.return_value = mock_boto3_resources['table']
            with patch('boto3.client', return_value=mock_boto3_resources['sns']):
                if 'feed_notifier' in sys.modules:
                    del sys.modules['feed_notifier']
                import feed_notifier
                feed_notifier.config_table = mock_boto3_resources['table']
                feed_notifier.sns_client = mock_boto3_resources['sns']
                result = feed_notifier.handler(event, mock_lambda_context)

        assert result['statusCode'] == 200
        mock_boto3_resources['sns'].publish.assert_called_once()

    def test_handler_always_sends_notification_on_failure(self, mock_boto3_resources, mock_lambda_context):
        """Test that handler always sends notification on feed failure."""
        mock_boto3_resources['table'].get_item.return_value = {
            'Item': {
                'config_key': 'EMAIL_NOTIFICATIONS',
                'value': json.dumps({
                    "email": "test@example.com",
                    "enabled": True,
                    "preferences": {"feedings": False, "failures": True, "pet_ate": False}
                })
            }
        }
        mock_boto3_resources['sns'].publish.return_value = {'MessageId': 'test-123'}

        event = {
            'Records': [{
                'eventName': 'MODIFY',
                'dynamodb': {
                    'NewImage': {
                        'feed_id': {'S': 'test-123'},
                        'status': {'S': 'failed'},
                        'event_type': {'S': 'manual_feed'},
                        'mode': {'S': 'manual'},
                        'requested_by': {'S': 'user'},
                        'timestamp': {'S': '2025-12-13T14:00:00Z'}
                    }
                }
            }]
        }

        with patch('boto3.resource') as mock_resource:
            mock_resource.return_value.Table.return_value = mock_boto3_resources['table']
            with patch('boto3.client', return_value=mock_boto3_resources['sns']):
                if 'feed_notifier' in sys.modules:
                    del sys.modules['feed_notifier']
                import feed_notifier
                feed_notifier.config_table = mock_boto3_resources['table']
                feed_notifier.sns_client = mock_boto3_resources['sns']
                result = feed_notifier.handler(event, mock_lambda_context)

        assert result['statusCode'] == 200
        mock_boto3_resources['sns'].publish.assert_called_once()
        call_args = mock_boto3_resources['sns'].publish.call_args
        assert 'Failed' in call_args[1]['Subject']

    def test_handler_skips_initiated_status(self, mock_boto3_resources, mock_lambda_context):
        """Test that handler skips events with initiated status."""
        mock_boto3_resources['table'].get_item.return_value = {
            'Item': {
                'config_key': 'EMAIL_NOTIFICATIONS',
                'value': json.dumps({"email": "test@example.com", "enabled": True})
            }
        }

        event = {
            'Records': [{
                'eventName': 'INSERT',
                'dynamodb': {
                    'NewImage': {
                        'feed_id': {'S': 'test-123'},
                        'status': {'S': 'initiated'}
                    }
                }
            }]
        }

        with patch('boto3.resource') as mock_resource:
            mock_resource.return_value.Table.return_value = mock_boto3_resources['table']
            with patch('boto3.client', return_value=mock_boto3_resources['sns']):
                if 'feed_notifier' in sys.modules:
                    del sys.modules['feed_notifier']
                import feed_notifier
                feed_notifier.config_table = mock_boto3_resources['table']
                feed_notifier.sns_client = mock_boto3_resources['sns']
                result = feed_notifier.handler(event, mock_lambda_context)

        assert result['statusCode'] == 200
        mock_boto3_resources['sns'].publish.assert_not_called()
