"""
Tests for database client.
"""
from unittest.mock import MagicMock, patch


class TestDbClient:
    """Test cases for database client functions."""

    @patch('app.db.client.boto3')
    @patch('app.db.client.settings')
    def test_get_dynamodb_resource(self, mock_settings, mock_boto3):
        """Test getting DynamoDB resource."""
        mock_settings.AWS_REGION = 'us-east-1'
        mock_resource = MagicMock()
        mock_boto3.resource.return_value = mock_resource

        from app.db.client import get_dynamodb_resource
        result = get_dynamodb_resource()

        mock_boto3.resource.assert_called_once_with("dynamodb", region_name='us-east-1')
        assert result == mock_resource

    @patch('app.db.client.get_dynamodb_resource')
    @patch('app.db.client.settings')
    def test_get_feed_history_table(self, mock_settings, mock_get_resource):
        """Test getting feed history table."""
        mock_settings.DYNAMO_FEED_HISTORY_TABLE = 'test-feed-history'
        mock_resource = MagicMock()
        mock_table = MagicMock()
        mock_resource.Table.return_value = mock_table
        mock_get_resource.return_value = mock_resource

        from app.db.client import get_feed_history_table
        result = get_feed_history_table()

        mock_resource.Table.assert_called_once_with('test-feed-history')
        assert result == mock_table

    @patch('app.db.client.get_dynamodb_resource')
    @patch('app.db.client.settings')
    def test_get_feed_schedule_table(self, mock_settings, mock_get_resource):
        """Test getting feed schedule table."""
        mock_settings.DYNAMO_FEED_SCHEDULE_TABLE = 'test-feed-schedule'
        mock_resource = MagicMock()
        mock_table = MagicMock()
        mock_resource.Table.return_value = mock_table
        mock_get_resource.return_value = mock_resource

        from app.db.client import get_feed_schedule_table
        result = get_feed_schedule_table()

        mock_resource.Table.assert_called_once_with('test-feed-schedule')
        assert result == mock_table

    @patch('app.db.client.get_dynamodb_resource')
    @patch('app.db.client.settings')
    def test_get_device_status_table(self, mock_settings, mock_get_resource):
        """Test getting device status table."""
        mock_settings.DEVICE_STATUS_TABLE_NAME = 'test-device-status'
        mock_resource = MagicMock()
        mock_table = MagicMock()
        mock_resource.Table.return_value = mock_table
        mock_get_resource.return_value = mock_resource

        from app.db.client import get_device_status_table
        result = get_device_status_table()

        mock_resource.Table.assert_called_once_with('test-device-status')
        assert result == mock_table

    @patch('app.db.client.get_dynamodb_resource')
    @patch('app.db.client.settings')
    def test_get_config_table(self, mock_settings, mock_get_resource):
        """Test getting config table."""
        mock_settings.DYNAMO_FEED_CONFIG_TABLE_NAME = 'test-config'
        mock_resource = MagicMock()
        mock_table = MagicMock()
        mock_resource.Table.return_value = mock_table
        mock_get_resource.return_value = mock_resource

        from app.db.client import get_config_table
        result = get_config_table()

        mock_resource.Table.assert_called_once_with('test-config')
        assert result == mock_table
