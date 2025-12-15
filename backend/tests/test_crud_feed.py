"""
Tests for feed CRUD operations.
"""
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError


class TestFeedCrud:
    """Test cases for feed CRUD operations."""

    @patch('app.crud.feed.get_feed_history_table')
    @pytest.mark.asyncio
    async def test_save_feed_event_success(self, mock_get_table):
        """Test saving a feed event."""
        mock_table = MagicMock()
        mock_table.put_item.return_value = {}
        mock_get_table.return_value = mock_table

        from app.crud.feed import save_feed_event
        await save_feed_event(
            feed_id='test-feed-123',
            timestamp='2024-01-01T00:00:00Z',
            mode='manual',
            status='completed',
            requested_by='test_user'
        )

        mock_table.put_item.assert_called_once()
        call_args = mock_table.put_item.call_args
        item = call_args[1]['Item']
        assert item['feed_id'] == 'test-feed-123'
        assert item['mode'] == 'manual'

    @patch('app.crud.feed.get_feed_history_table')
    @pytest.mark.asyncio
    async def test_fetch_feed_events_from_db_success(self, mock_get_table):
        """Test fetching feed events."""
        mock_table = MagicMock()
        mock_table.scan.return_value = {
            'Items': [
                {'feed_id': '1', 'timestamp': '2024-01-02T00:00:00Z'},
                {'feed_id': '2', 'timestamp': '2024-01-01T00:00:00Z'},
            ],
            'LastEvaluatedKey': None,
            'Count': 2,
            'ScannedCount': 2
        }
        mock_get_table.return_value = mock_table

        from app.crud.feed import fetch_feed_events_from_db
        result = await fetch_feed_events_from_db(limit=10)

        assert result['count'] == 2
        assert len(result['items']) == 2
        assert result['items'][0]['timestamp'] > result['items'][1]['timestamp']

    @patch('app.crud.feed.get_feed_history_table')
    @pytest.mark.asyncio
    async def test_fetch_feed_events_from_db_with_pagination(self, mock_get_table):
        """Test fetching feed events with pagination key."""
        mock_table = MagicMock()
        mock_table.scan.return_value = {
            'Items': [{'feed_id': '3', 'timestamp': '2024-01-03T00:00:00Z'}],
            'LastEvaluatedKey': {'feed_id': '3'},
            'Count': 1,
            'ScannedCount': 1
        }
        mock_get_table.return_value = mock_table

        from app.crud.feed import fetch_feed_events_from_db
        result = await fetch_feed_events_from_db(
            limit=10,
            exclusive_start_key={'feed_id': '2'}
        )

        assert result['last_evaluated_key'] == {'feed_id': '3'}
        mock_table.scan.assert_called_once()
        call_args = mock_table.scan.call_args[1]
        assert 'ExclusiveStartKey' in call_args

    @patch('app.crud.feed.get_feed_history_table')
    @pytest.mark.asyncio
    async def test_fetch_feed_events_from_db_client_error(self, mock_get_table):
        """Test error handling when fetching feed events."""
        mock_table = MagicMock()
        mock_table.scan.side_effect = ClientError(
            {'Error': {'Code': '500', 'Message': 'Test error'}},
            'Scan'
        )
        mock_get_table.return_value = mock_table

        from app.crud.feed import fetch_feed_events_from_db
        with pytest.raises(ClientError):
            await fetch_feed_events_from_db(limit=10)

    @patch('app.crud.feed.get_feed_history_table')
    @pytest.mark.asyncio
    async def test_fetch_feed_events_from_db_unexpected_error(self, mock_get_table):
        """Test unexpected error handling when fetching feed events."""
        mock_table = MagicMock()
        mock_table.scan.side_effect = Exception("Unexpected error")
        mock_get_table.return_value = mock_table

        from app.crud.feed import fetch_feed_events_from_db
        with pytest.raises(Exception, match="Unexpected error"):
            await fetch_feed_events_from_db(limit=10)

    def test_convert_decimal_to_number_int(self):
        """Test converting Decimal whole numbers to int."""
        from app.core.serialization import convert_decimal
        result = convert_decimal(Decimal('100'))
        assert result == 100
        assert isinstance(result, int)

    def test_convert_decimal_to_number_float(self):
        """Test converting Decimal fractions to float."""
        from app.core.serialization import convert_decimal
        result = convert_decimal(Decimal('100.5'))
        assert result == 100.5
        assert isinstance(result, float)

    def test_convert_decimal_to_number_list(self):
        """Test converting list with Decimals."""
        from app.core.serialization import convert_decimal
        result = convert_decimal([Decimal('1'), Decimal('2.5')])
        assert result == [1, 2.5]

    def test_convert_decimal_to_number_dict(self):
        """Test converting dict with Decimals."""
        from app.core.serialization import convert_decimal
        result = convert_decimal({'a': Decimal('10'), 'b': Decimal('20.5')})
        assert result == {'a': 10, 'b': 20.5}

    def test_convert_decimal_to_number_nested(self):
        """Test converting nested structure with Decimals."""
        from app.core.serialization import convert_decimal
        result = convert_decimal({
            'list': [Decimal('1'), {'nested': Decimal('2.5')}],
            'value': Decimal('100')
        })
        assert result == {'list': [1, {'nested': 2.5}], 'value': 100}

    def test_convert_decimal_to_number_passthrough(self):
        """Test that non-Decimal values pass through unchanged."""
        from app.core.serialization import convert_decimal
        result = convert_decimal("string value")
        assert result == "string value"

    @patch('app.core.config.settings')
    @patch('app.crud.feed.get_device_status_table')
    @pytest.mark.asyncio
    async def test_get_latest_device_status_found(self, mock_get_table, mock_settings):
        """Test getting device status when found."""
        mock_settings.IOT_THING_ID = 'test-thing'
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            'Item': {
                'thing_id': 'test-thing',
                'current_weight_g': Decimal('350'),
                'servo_state': 'closed'
            }
        }
        mock_get_table.return_value = mock_table

        from app.crud.feed import get_latest_device_status
        result = await get_latest_device_status()

        assert result is not None
        assert result['thing_id'] == 'test-thing'
        assert result['current_weight_g'] == 350

    @patch('app.core.config.settings')
    @patch('app.crud.feed.get_device_status_table')
    @pytest.mark.asyncio
    async def test_get_latest_device_status_not_found(self, mock_get_table, mock_settings):
        """Test getting device status when not found."""
        mock_settings.IOT_THING_ID = 'test-thing'
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}
        mock_get_table.return_value = mock_table

        from app.crud.feed import get_latest_device_status
        result = await get_latest_device_status()

        assert result is None

    @patch('app.core.config.settings')
    @patch('app.crud.feed.get_device_status_table')
    @pytest.mark.asyncio
    async def test_get_latest_device_status_client_error(self, mock_get_table, mock_settings):
        """Test error handling when getting device status."""
        mock_settings.IOT_THING_ID = 'test-thing'
        mock_table = MagicMock()
        mock_table.get_item.side_effect = ClientError(
            {'Error': {'Code': '500', 'Message': 'Test error'}},
            'GetItem'
        )
        mock_get_table.return_value = mock_table

        from app.crud.feed import get_latest_device_status
        with pytest.raises(ClientError):
            await get_latest_device_status()

    @patch('app.core.config.settings')
    @patch('app.crud.feed.get_device_status_table')
    @pytest.mark.asyncio
    async def test_get_latest_device_status_unexpected_error(self, mock_get_table, mock_settings):
        """Test unexpected error handling when getting device status."""
        mock_settings.IOT_THING_ID = 'test-thing'
        mock_table = MagicMock()
        mock_table.get_item.side_effect = Exception("Unexpected error")
        mock_get_table.return_value = mock_table

        from app.crud.feed import get_latest_device_status
        with pytest.raises(Exception, match="Unexpected error"):
            await get_latest_device_status()

    @patch('app.crud.feed.get_feed_history_table')
    @pytest.mark.asyncio
    async def test_delete_all_feed_events_success(self, mock_get_table):
        """Test deleting all feed events."""
        mock_table = MagicMock()
        mock_table.scan.return_value = {
            'Items': [
                {'feed_id': '1'},
                {'feed_id': '2'}
            ],
            'LastEvaluatedKey': None
        }
        mock_table.delete_item.return_value = {}
        mock_get_table.return_value = mock_table

        from app.crud.feed import delete_all_feed_events
        result = await delete_all_feed_events()

        assert result == 2
        assert mock_table.delete_item.call_count == 2

    @patch('app.crud.feed.get_feed_history_table')
    @pytest.mark.asyncio
    async def test_delete_all_feed_events_with_pagination(self, mock_get_table):
        """Test deleting all feed events with pagination."""
        mock_table = MagicMock()
        mock_table.scan.side_effect = [
            {
                'Items': [{'feed_id': '1'}],
                'LastEvaluatedKey': {'feed_id': '1'}
            },
            {
                'Items': [{'feed_id': '2'}],
                'LastEvaluatedKey': None
            }
        ]
        mock_table.delete_item.return_value = {}
        mock_get_table.return_value = mock_table

        from app.crud.feed import delete_all_feed_events
        result = await delete_all_feed_events()

        assert result == 2
        assert mock_table.scan.call_count == 2

    @patch('app.crud.feed.get_feed_history_table')
    @pytest.mark.asyncio
    async def test_delete_all_feed_events_empty(self, mock_get_table):
        """Test deleting when no feed events exist."""
        mock_table = MagicMock()
        mock_table.scan.return_value = {
            'Items': [],
            'LastEvaluatedKey': None
        }
        mock_get_table.return_value = mock_table

        from app.crud.feed import delete_all_feed_events
        result = await delete_all_feed_events()

        assert result == 0
        mock_table.delete_item.assert_not_called()

    @patch('app.crud.feed.get_feed_history_table')
    @pytest.mark.asyncio
    async def test_delete_all_feed_events_client_error(self, mock_get_table):
        """Test error handling when deleting feed events."""
        mock_table = MagicMock()
        mock_table.scan.side_effect = ClientError(
            {'Error': {'Code': '500', 'Message': 'Test error'}},
            'Scan'
        )
        mock_get_table.return_value = mock_table

        from app.crud.feed import delete_all_feed_events
        with pytest.raises(ClientError):
            await delete_all_feed_events()

    @patch('app.crud.feed.get_feed_history_table')
    @pytest.mark.asyncio
    async def test_delete_all_feed_events_unexpected_error(self, mock_get_table):
        """Test unexpected error handling when deleting feed events."""
        mock_table = MagicMock()
        mock_table.scan.side_effect = Exception("Unexpected error")
        mock_get_table.return_value = mock_table

        from app.crud.feed import delete_all_feed_events
        with pytest.raises(Exception, match="Unexpected error"):
            await delete_all_feed_events()

    @patch('app.crud.feed.get_feed_history_table')
    @pytest.mark.asyncio
    async def test_delete_all_feed_events_item_without_feed_id(self, mock_get_table):
        """Test deleting feed events when item has no feed_id."""
        mock_table = MagicMock()
        mock_table.scan.return_value = {
            'Items': [
                {'feed_id': '1'},
                {'some_other_field': 'value'},
                {'feed_id': '2'}
            ],
            'LastEvaluatedKey': None
        }
        mock_table.delete_item.return_value = {}
        mock_get_table.return_value = mock_table

        from app.crud.feed import delete_all_feed_events
        result = await delete_all_feed_events()

        assert result == 2
        assert mock_table.delete_item.call_count == 2
