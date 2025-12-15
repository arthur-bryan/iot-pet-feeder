"""
Tests for hardware adapter.
"""
import os
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestProductionHardwareAdapter:
    """Test cases for ProductionHardwareAdapter."""

    @patch.dict(os.environ, {
        'IOT_ENDPOINT': 'test-endpoint.iot.aws',
        'IOT_THING_ID': 'test-thing',
        'IOT_PUBLISH_TOPIC': 'petfeeder/commands'
    })
    @patch('app.core.hardware_adapter.boto3')
    def test_init(self, mock_boto3):
        """Test ProductionHardwareAdapter initialization."""
        from app.core.hardware_adapter import ProductionHardwareAdapter
        adapter = ProductionHardwareAdapter()

        assert adapter.iot_endpoint == 'test-endpoint.iot.aws'
        assert adapter.thing_id == 'test-thing'
        mock_boto3.client.assert_called_with('iot-data')

    @patch.dict(os.environ, {
        'IOT_ENDPOINT': 'test-endpoint.iot.aws',
        'IOT_THING_ID': 'test-thing',
        'IOT_PUBLISH_TOPIC': 'petfeeder/commands'
    })
    @patch('app.core.hardware_adapter.boto3')
    @pytest.mark.asyncio
    async def test_trigger_feed(self, mock_boto3):
        """Test trigger_feed publishes MQTT command."""
        mock_client = MagicMock()
        mock_boto3.client.return_value = mock_client

        from app.core.hardware_adapter import ProductionHardwareAdapter
        adapter = ProductionHardwareAdapter()
        result = await adapter.trigger_feed('test_user', 'manual')

        assert result['status'] == 'sent'
        mock_client.publish.assert_called_once()

    @patch.dict(os.environ, {
        'IOT_ENDPOINT': 'test-endpoint.iot.aws',
        'IOT_THING_ID': 'test-thing'
    })
    @patch('app.core.hardware_adapter.boto3')
    @patch('app.crud.feed.get_latest_device_status')
    @pytest.mark.asyncio
    async def test_get_device_status(self, mock_get_status, mock_boto3):
        """Test get_device_status retrieves from DynamoDB."""
        mock_get_status.return_value = {
            'thing_id': 'test-thing',
            'current_weight_g': 350
        }

        from app.core.hardware_adapter import ProductionHardwareAdapter
        adapter = ProductionHardwareAdapter()
        result = await adapter.get_device_status()

        assert result['thing_id'] == 'test-thing'
        mock_get_status.assert_called_once()

    @patch.dict(os.environ, {
        'IOT_ENDPOINT': 'test-endpoint.iot.aws',
        'IOT_THING_ID': 'test-thing'
    })
    @patch('app.core.hardware_adapter.boto3')
    @patch('app.core.iot.request_device_status')
    @pytest.mark.asyncio
    async def test_request_status_update(self, mock_request_status, mock_boto3):
        """Test request_status_update calls IoT function."""
        mock_request_status.return_value = True

        from app.core.hardware_adapter import ProductionHardwareAdapter
        adapter = ProductionHardwareAdapter()
        result = await adapter.request_status_update()

        assert result is True
        mock_request_status.assert_called_once()

    @patch.dict(os.environ, {
        'IOT_ENDPOINT': 'test-endpoint.iot.aws',
        'IOT_THING_ID': 'test-thing',
        'IOT_CONFIG_TOPIC': 'petfeeder/config'
    })
    @patch('app.core.hardware_adapter.boto3')
    @pytest.mark.asyncio
    async def test_update_config(self, mock_boto3):
        """Test update_config publishes to config topic."""
        mock_client = MagicMock()
        mock_boto3.client.return_value = mock_client

        from app.core.hardware_adapter import ProductionHardwareAdapter
        adapter = ProductionHardwareAdapter()
        result = await adapter.update_config('SERVO_OPEN_HOLD_DURATION_MS', 3000)

        assert result is True
        mock_client.publish.assert_called_once()


class TestGetHardwareAdapter:
    """Test cases for get_hardware_adapter factory function."""

    @patch.dict(os.environ, {'ENVIRONMENT': 'prd'})
    @patch('app.core.hardware_adapter.boto3')
    def test_returns_production_adapter(self, mock_boto3):
        """Test returns ProductionHardwareAdapter in production."""
        os.environ['IOT_ENDPOINT'] = 'test-endpoint'
        os.environ['IOT_THING_ID'] = 'test-thing'

        from app.core.hardware_adapter import ProductionHardwareAdapter, get_hardware_adapter
        adapter = get_hardware_adapter()

        assert isinstance(adapter, ProductionHardwareAdapter)

    @patch.dict(os.environ, {}, clear=True)
    @patch('app.core.hardware_adapter.boto3')
    def test_defaults_to_production(self, mock_boto3):
        """Test defaults to production when ENVIRONMENT not set."""
        os.environ['IOT_ENDPOINT'] = 'test-endpoint'
        os.environ['IOT_THING_ID'] = 'test-thing'

        from app.core.hardware_adapter import ProductionHardwareAdapter, get_hardware_adapter
        adapter = get_hardware_adapter()

        assert isinstance(adapter, ProductionHardwareAdapter)
