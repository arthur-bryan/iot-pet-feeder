"""
Tests for IoT operations.
"""
from unittest.mock import patch

import pytest
from botocore.exceptions import ClientError


class TestIotOperations:
    """Test cases for IoT operations."""

    @patch('app.core.iot.iot_client')
    @patch('app.core.iot.settings')
    @pytest.mark.asyncio
    async def test_publish_feed_command_success(self, mock_settings, mock_client):
        """Test successful feed command publish."""
        mock_settings.IOT_ENDPOINT = 'test-endpoint.iot.aws'
        mock_settings.IOT_TOPIC_FEED = 'petfeeder/commands'
        mock_client.publish.return_value = {}

        from app.core.iot import publish_feed_command
        result = await publish_feed_command('FEED_NOW')

        assert result is True
        mock_client.publish.assert_called_once()

    @patch('app.core.iot.settings')
    @pytest.mark.asyncio
    async def test_publish_feed_command_no_endpoint(self, mock_settings):
        """Test feed command when endpoint not configured."""
        mock_settings.IOT_ENDPOINT = None

        from app.core.iot import publish_feed_command
        result = await publish_feed_command('FEED_NOW')

        assert result is False

    @patch('app.core.iot.iot_client')
    @patch('app.core.iot.settings')
    @pytest.mark.asyncio
    async def test_publish_feed_command_client_error(self, mock_settings, mock_client):
        """Test feed command with client error."""
        mock_settings.IOT_ENDPOINT = 'test-endpoint.iot.aws'
        mock_settings.IOT_TOPIC_FEED = 'petfeeder/commands'
        mock_client.publish.side_effect = ClientError(
            {'Error': {'Code': '500', 'Message': 'Test error'}},
            'Publish'
        )

        from app.core.iot import publish_feed_command
        result = await publish_feed_command('FEED_NOW')

        assert result is False

    @patch('app.core.iot.iot_client')
    @patch('app.core.iot.settings')
    @pytest.mark.asyncio
    async def test_publish_feed_command_unexpected_error(self, mock_settings, mock_client):
        """Test feed command with unexpected error."""
        mock_settings.IOT_ENDPOINT = 'test-endpoint.iot.aws'
        mock_settings.IOT_TOPIC_FEED = 'petfeeder/commands'
        mock_client.publish.side_effect = Exception("Unexpected error")

        from app.core.iot import publish_feed_command
        result = await publish_feed_command('FEED_NOW')

        assert result is False

    @patch('app.core.iot.iot_client')
    @patch('app.core.iot.settings')
    @pytest.mark.asyncio
    async def test_request_device_status_success(self, mock_settings, mock_client):
        """Test successful status request."""
        mock_settings.IOT_ENDPOINT = 'test-endpoint.iot.aws'
        mock_settings.IOT_TOPIC_FEED = 'petfeeder/commands'
        mock_client.publish.return_value = {}

        from app.core.iot import request_device_status
        result = await request_device_status()

        assert result is True
        mock_client.publish.assert_called_once()
        call_args = mock_client.publish.call_args
        assert call_args[1]['payload'] == 'GET_STATUS'

    @patch('app.core.iot.settings')
    @pytest.mark.asyncio
    async def test_request_device_status_no_endpoint(self, mock_settings):
        """Test status request when endpoint not configured."""
        mock_settings.IOT_ENDPOINT = None

        from app.core.iot import request_device_status
        result = await request_device_status()

        assert result is False

    @patch('app.core.iot.iot_client')
    @patch('app.core.iot.settings')
    @pytest.mark.asyncio
    async def test_request_device_status_client_error(self, mock_settings, mock_client):
        """Test status request with client error."""
        mock_settings.IOT_ENDPOINT = 'test-endpoint.iot.aws'
        mock_settings.IOT_TOPIC_FEED = 'petfeeder/commands'
        mock_client.publish.side_effect = ClientError(
            {'Error': {'Code': '500', 'Message': 'Test error'}},
            'Publish'
        )

        from app.core.iot import request_device_status
        result = await request_device_status()

        assert result is False

    @patch('app.core.iot.iot_client')
    @patch('app.core.iot.settings')
    @pytest.mark.asyncio
    async def test_request_device_status_unexpected_error(self, mock_settings, mock_client):
        """Test status request with unexpected error."""
        mock_settings.IOT_ENDPOINT = 'test-endpoint.iot.aws'
        mock_settings.IOT_TOPIC_FEED = 'petfeeder/commands'
        mock_client.publish.side_effect = Exception("Unexpected error")

        from app.core.iot import request_device_status
        result = await request_device_status()

        assert result is False

    @patch('app.core.iot.iot_client')
    @patch('app.core.iot.settings')
    @pytest.mark.asyncio
    async def test_publish_config_update_success(self, mock_settings, mock_client):
        """Test successful config update publish."""
        mock_settings.IOT_ENDPOINT = 'test-endpoint.iot.aws'
        mock_settings.IOT_TOPIC_CONFIG = 'petfeeder/config'
        mock_client.publish.return_value = {}

        from app.core.iot import publish_config_update
        result = await publish_config_update('SERVO_OPEN_HOLD_DURATION_MS', 3000)

        assert result is True
        mock_client.publish.assert_called_once()
        call_args = mock_client.publish.call_args
        assert call_args[1]['qos'] == 1

    @patch('app.core.iot.settings')
    @pytest.mark.asyncio
    async def test_publish_config_update_no_endpoint(self, mock_settings):
        """Test config update when endpoint not configured."""
        mock_settings.IOT_ENDPOINT = None

        from app.core.iot import publish_config_update
        result = await publish_config_update('SERVO_OPEN_HOLD_DURATION_MS', 3000)

        assert result is False

    @patch('app.core.iot.iot_client')
    @patch('app.core.iot.settings')
    @pytest.mark.asyncio
    async def test_publish_config_update_client_error(self, mock_settings, mock_client):
        """Test config update with client error."""
        mock_settings.IOT_ENDPOINT = 'test-endpoint.iot.aws'
        mock_settings.IOT_TOPIC_CONFIG = 'petfeeder/config'
        mock_client.publish.side_effect = ClientError(
            {'Error': {'Code': '500', 'Message': 'Test error'}},
            'Publish'
        )

        from app.core.iot import publish_config_update
        result = await publish_config_update('SERVO_OPEN_HOLD_DURATION_MS', 3000)

        assert result is False

    @patch('app.core.iot.iot_client')
    @patch('app.core.iot.settings')
    @pytest.mark.asyncio
    async def test_publish_config_update_unexpected_error(self, mock_settings, mock_client):
        """Test config update with unexpected error."""
        mock_settings.IOT_ENDPOINT = 'test-endpoint.iot.aws'
        mock_settings.IOT_TOPIC_CONFIG = 'petfeeder/config'
        mock_client.publish.side_effect = Exception("Unexpected error")

        from app.core.iot import publish_config_update
        result = await publish_config_update('SERVO_OPEN_HOLD_DURATION_MS', 3000)

        assert result is False
