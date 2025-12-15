"""
Tests for feed_event_logger Lambda handler.
"""
import json
from decimal import Decimal
from unittest.mock import MagicMock, patch


class TestFeedEventLogger:
    """Test cases for feed event logging functionality."""

    @patch('feed_event_logger.table')
    def test_handler_creates_new_event_with_initiated_status(
        self, mock_table, sample_feed_event, mock_lambda_context
    ):
        """Test that handler creates a new feed event with initiated status."""
        from feed_event_logger import handler

        mock_table.put_item = MagicMock(return_value={})

        result = handler(sample_feed_event, mock_lambda_context)

        assert result['statusCode'] == 200
        mock_table.put_item.assert_called_once()
        call_args = mock_table.put_item.call_args
        item = call_args[1]['Item']
        assert item['feed_id'] == 'test-feed-123'
        assert item['status'] == 'initiated'
        assert item['mode'] == 'manual'

    @patch('feed_event_logger.table')
    def test_handler_updates_existing_event_on_completed(
        self, mock_table, sample_feed_event_completed, mock_lambda_context
    ):
        """Test that handler updates existing event when status is completed."""
        from feed_event_logger import handler

        mock_table.get_item = MagicMock(return_value={
            'Item': {
                'feed_id': 'test-feed-123',
                'status': 'initiated',
                'weight_before_g': Decimal('250.5')
            }
        })
        mock_table.update_item = MagicMock(return_value={})

        result = handler(sample_feed_event_completed, mock_lambda_context)

        assert result['statusCode'] == 200
        mock_table.update_item.assert_called_once()

    @patch('feed_event_logger.table')
    def test_handler_generates_feed_id_if_missing(
        self, mock_table, mock_lambda_context
    ):
        """Test that handler generates UUID if feed_id is missing."""
        from feed_event_logger import handler

        event_without_id = {"status": "initiated", "mode": "manual"}
        mock_table.put_item = MagicMock(return_value={})

        result = handler(event_without_id, mock_lambda_context)

        assert result['statusCode'] == 200
        call_args = mock_table.put_item.call_args
        item = call_args[1]['Item']
        assert 'feed_id' in item
        assert len(item['feed_id']) == 36

    @patch('feed_event_logger.table')
    def test_handler_calculates_weight_delta(
        self, mock_table, mock_lambda_context
    ):
        """Test that handler calculates weight delta correctly."""
        from feed_event_logger import handler

        mock_table.get_item = MagicMock(return_value={
            'Item': {
                'feed_id': 'test-feed-123',
                'status': 'initiated',
                'weight_before_g': Decimal('250.0')
            }
        })
        mock_table.update_item = MagicMock(return_value={})

        event = {"feed_id": "test-feed-123", "status": "completed", "weight_after_g": 275.0}
        result = handler(event, mock_lambda_context)

        assert result['statusCode'] == 200
        call_args = mock_table.update_item.call_args
        expression_values = call_args[1]['ExpressionAttributeValues']
        assert ':weight_delta' in expression_values
        assert expression_values[':weight_delta'] == Decimal('25.0')

    @patch('feed_event_logger.table')
    def test_handler_handles_race_condition(
        self, mock_table, sample_feed_event_completed, mock_lambda_context
    ):
        """Test that handler creates item if completed arrives before initiated."""
        from feed_event_logger import handler

        mock_table.get_item = MagicMock(return_value={'Item': None})
        mock_table.put_item = MagicMock(return_value={})

        result = handler(sample_feed_event_completed, mock_lambda_context)

        assert result['statusCode'] == 200
        mock_table.put_item.assert_called_once()

    def test_handler_returns_400_on_invalid_json(self, mock_lambda_context):
        """Test that handler returns 400 for invalid JSON."""
        from feed_event_logger import handler

        result = handler("invalid json {", mock_lambda_context)

        assert result['statusCode'] == 400
        assert 'Invalid JSON' in result['body']

    @patch('feed_event_logger.table')
    def test_handler_handles_string_event(
        self, mock_table, sample_feed_event, mock_lambda_context
    ):
        """Test that handler handles JSON string event."""
        from feed_event_logger import handler

        mock_table.put_item = MagicMock(return_value={})
        json_event = json.dumps(sample_feed_event)

        result = handler(json_event, mock_lambda_context)

        assert result['statusCode'] == 200
