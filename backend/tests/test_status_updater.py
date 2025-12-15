"""
Tests for status_updater Lambda handler.
"""
import json
from decimal import Decimal
from unittest.mock import MagicMock, patch


class TestStatusUpdater:
    """Test cases for device status update functionality."""

    @patch('status_updater.table')
    def test_handler_updates_device_status(
        self, mock_table, sample_status_event, mock_lambda_context
    ):
        """Test that handler updates device status in DynamoDB."""
        from status_updater import handler

        mock_table.put_item = MagicMock(return_value={})

        result = handler(sample_status_event, mock_lambda_context)

        assert result['statusCode'] == 200
        mock_table.put_item.assert_called_once()
        call_args = mock_table.put_item.call_args
        item = call_args[1]['Item']
        assert item['feeder_state'] == 'CLOSED'
        assert item['network_status'] == 'ONLINE'
        assert item['current_weight_g'] == Decimal('350.0')

    @patch('status_updater.table')
    def test_handler_handles_string_event(
        self, mock_table, sample_status_event, mock_lambda_context
    ):
        """Test that handler handles JSON string event."""
        from status_updater import handler

        mock_table.put_item = MagicMock(return_value={})
        json_event = json.dumps(sample_status_event)

        result = handler(json_event, mock_lambda_context)

        assert result['statusCode'] == 200

    @patch('status_updater.table')
    def test_handler_uses_default_values_for_missing_fields(
        self, mock_table, mock_lambda_context
    ):
        """Test that handler uses default values for missing fields."""
        from status_updater import handler

        mock_table.put_item = MagicMock(return_value={})
        minimal_event = {}

        result = handler(minimal_event, mock_lambda_context)

        assert result['statusCode'] == 200
        call_args = mock_table.put_item.call_args
        item = call_args[1]['Item']
        assert item['feeder_state'] == 'unknown'
        assert item['network_status'] == 'unknown'

    def test_handler_returns_400_on_invalid_json(self, mock_lambda_context):
        """Test that handler returns 400 for invalid JSON string."""
        from status_updater import handler

        result = handler("{invalid json", mock_lambda_context)

        assert result['statusCode'] == 400

    def test_handler_returns_400_on_invalid_event_type(self, mock_lambda_context):
        """Test that handler returns 400 for unexpected event type."""
        from status_updater import handler

        result = handler(12345, mock_lambda_context)

        assert result['statusCode'] == 400
