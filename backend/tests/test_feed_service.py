"""
Tests for feed service.
"""
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.feed import FeedRequest


class TestFeedService:
    """Test cases for feed service."""

    @patch('app.services.feed_service.get_hardware_adapter')
    @patch('app.services.feed_service.fetch_config_setting')
    @pytest.mark.asyncio
    async def test_process_feed_success(self, mock_fetch_config, mock_get_adapter):
        """Test successful feed processing."""
        mock_adapter = MagicMock()
        mock_adapter.get_device_status = AsyncMock(return_value={
            'current_weight_g': 200.0
        })
        mock_adapter.trigger_feed = AsyncMock(return_value={
            'status': 'sent'
        })
        mock_get_adapter.return_value = mock_adapter

        mock_fetch_config.return_value = {'value': Decimal('450')}

        from app.services.feed_service import process_feed
        request = FeedRequest(requested_by='test_user', mode='manual')
        result = await process_feed(request)

        assert result.status == 'sent'
        assert result.requested_by == 'test_user'

    @patch('app.services.feed_service.get_hardware_adapter')
    @patch('app.services.feed_service.fetch_config_setting')
    @pytest.mark.asyncio
    async def test_process_feed_weight_exceeded(self, mock_fetch_config, mock_get_adapter):
        """Test feed denied when weight exceeds threshold."""
        mock_adapter = MagicMock()
        mock_adapter.get_device_status = AsyncMock(return_value={
            'current_weight_g': 500.0
        })
        mock_get_adapter.return_value = mock_adapter

        mock_fetch_config.return_value = {'value': Decimal('450')}

        from app.services.feed_service import process_feed
        request = FeedRequest(requested_by='test_user', mode='manual')
        result = await process_feed(request)

        assert result.status == 'denied_weight_exceeded'

    @patch('app.services.feed_service.get_hardware_adapter')
    @patch('app.services.feed_service.fetch_config_setting')
    @pytest.mark.asyncio
    async def test_process_feed_no_device_status(self, mock_fetch_config, mock_get_adapter):
        """Test feed proceeds when device status unavailable."""
        mock_adapter = MagicMock()
        mock_adapter.get_device_status = AsyncMock(return_value=None)
        mock_adapter.trigger_feed = AsyncMock(return_value={
            'status': 'sent'
        })
        mock_get_adapter.return_value = mock_adapter

        from app.services.feed_service import process_feed
        request = FeedRequest(requested_by='test_user', mode='manual')
        result = await process_feed(request)

        assert result.status == 'sent'

    @patch('app.services.feed_service.get_hardware_adapter')
    @patch('app.services.feed_service.fetch_config_setting')
    @pytest.mark.asyncio
    async def test_process_feed_no_config(self, mock_fetch_config, mock_get_adapter):
        """Test feed uses default threshold when config unavailable."""
        mock_adapter = MagicMock()
        mock_adapter.get_device_status = AsyncMock(return_value={
            'current_weight_g': 200.0
        })
        mock_adapter.trigger_feed = AsyncMock(return_value={
            'status': 'sent'
        })
        mock_get_adapter.return_value = mock_adapter

        mock_fetch_config.return_value = None

        from app.services.feed_service import process_feed
        request = FeedRequest(requested_by='test_user', mode='manual')
        result = await process_feed(request)

        assert result.status == 'sent'

    @patch('app.services.feed_service.get_hardware_adapter')
    @patch('app.services.feed_service.fetch_config_setting')
    @pytest.mark.asyncio
    async def test_process_feed_weight_check_error(self, mock_fetch_config, mock_get_adapter):
        """Test feed proceeds when weight check fails."""
        mock_adapter = MagicMock()
        mock_adapter.get_device_status = AsyncMock(side_effect=Exception("Error"))
        mock_adapter.trigger_feed = AsyncMock(return_value={
            'status': 'sent'
        })
        mock_get_adapter.return_value = mock_adapter

        from app.services.feed_service import process_feed
        request = FeedRequest(requested_by='test_user', mode='manual')
        result = await process_feed(request)

        assert result.status == 'sent'

    @patch('app.services.feed_service.get_hardware_adapter')
    @patch('app.services.feed_service.fetch_config_setting')
    @pytest.mark.asyncio
    async def test_process_feed_failed(self, mock_fetch_config, mock_get_adapter):
        """Test feed returns failed status."""
        mock_adapter = MagicMock()
        mock_adapter.get_device_status = AsyncMock(return_value={
            'current_weight_g': 200.0
        })
        mock_adapter.trigger_feed = AsyncMock(return_value={
            'status': 'error'
        })
        mock_get_adapter.return_value = mock_adapter

        mock_fetch_config.return_value = {'value': Decimal('450')}

        from app.services.feed_service import process_feed
        request = FeedRequest(requested_by='test_user', mode='manual')
        result = await process_feed(request)

        assert result.status == 'failed'

    @patch('app.services.feed_service.get_hardware_adapter')
    @patch('app.services.feed_service.fetch_config_setting')
    @pytest.mark.asyncio
    async def test_process_feed_completed_status(self, mock_fetch_config, mock_get_adapter):
        """Test feed with completed status from adapter."""
        mock_adapter = MagicMock()
        mock_adapter.get_device_status = AsyncMock(return_value={
            'current_weight_g': 200.0
        })
        mock_adapter.trigger_feed = AsyncMock(return_value={
            'status': 'completed'
        })
        mock_get_adapter.return_value = mock_adapter

        mock_fetch_config.return_value = {'value': Decimal('450')}

        from app.services.feed_service import process_feed
        request = FeedRequest(requested_by='test_user', mode='manual')
        result = await process_feed(request)

        assert result.status == 'sent'

    @patch('app.services.feed_service.get_hardware_adapter')
    @patch('app.services.feed_service.fetch_config_setting')
    @pytest.mark.asyncio
    async def test_process_feed_simulated_status(self, mock_fetch_config, mock_get_adapter):
        """Test feed with simulated status from adapter."""
        mock_adapter = MagicMock()
        mock_adapter.get_device_status = AsyncMock(return_value={
            'current_weight_g': 200.0
        })
        mock_adapter.trigger_feed = AsyncMock(return_value={
            'status': 'simulated'
        })
        mock_get_adapter.return_value = mock_adapter

        mock_fetch_config.return_value = {'value': Decimal('450')}

        from app.services.feed_service import process_feed
        request = FeedRequest(requested_by='test_user', mode='manual')
        result = await process_feed(request)

        assert result.status == 'sent'

    @patch('app.services.feed_service.fetch_feed_events_from_db')
    @pytest.mark.asyncio
    async def test_get_feed_history_success(self, mock_fetch):
        """Test getting feed history."""
        mock_fetch.return_value = {
            'items': [
                {'feed_id': '1', 'timestamp': '2024-01-02T00:00:00Z'},
                {'feed_id': '2', 'timestamp': '2024-01-01T00:00:00Z'}
            ],
            'last_evaluated_key': None
        }

        from app.services.feed_service import get_feed_history
        result = await get_feed_history(page=1, limit=10)

        assert result['total_items'] == 2
        assert result['page'] == 1

    @patch('app.services.feed_service.fetch_feed_events_from_db')
    @pytest.mark.asyncio
    async def test_get_feed_history_pagination(self, mock_fetch):
        """Test feed history pagination."""
        mock_fetch.return_value = {
            'items': [
                {'feed_id': str(i), 'timestamp': f'2024-01-{i:02d}T00:00:00Z'}
                for i in range(1, 26)
            ],
            'last_evaluated_key': None
        }

        from app.services.feed_service import get_feed_history
        result = await get_feed_history(page=2, limit=10)

        assert result['page'] == 2
        assert len(result['items']) == 10
        assert result['total_pages'] == 3

    @patch('app.services.feed_service.fetch_feed_events_from_db')
    @pytest.mark.asyncio
    async def test_get_feed_history_with_time_filter(self, mock_fetch):
        """Test feed history with time filtering."""
        mock_fetch.return_value = {
            'items': [
                {'feed_id': '1', 'timestamp': '2024-01-15T00:00:00Z'},
                {'feed_id': '2', 'timestamp': '2024-01-10T00:00:00Z'},
                {'feed_id': '3', 'timestamp': '2024-01-05T00:00:00Z'},
            ],
            'last_evaluated_key': None
        }

        from app.services.feed_service import get_feed_history
        result = await get_feed_history(
            page=1,
            limit=10,
            start_time='2024-01-08T00:00:00Z',
            end_time='2024-01-20T00:00:00Z'
        )

        assert result['total_items'] == 2

    @patch('app.services.feed_service.fetch_feed_events_from_db')
    @pytest.mark.asyncio
    async def test_get_feed_history_start_time_only(self, mock_fetch):
        """Test feed history with start time filter only."""
        mock_fetch.return_value = {
            'items': [
                {'feed_id': '1', 'timestamp': '2024-01-15T00:00:00Z'},
                {'feed_id': '2', 'timestamp': '2024-01-05T00:00:00Z'},
            ],
            'last_evaluated_key': None
        }

        from app.services.feed_service import get_feed_history
        result = await get_feed_history(
            page=1,
            limit=10,
            start_time='2024-01-10T00:00:00Z'
        )

        assert result['total_items'] == 1

    @patch('app.services.feed_service.fetch_feed_events_from_db')
    @pytest.mark.asyncio
    async def test_get_feed_history_end_time_only(self, mock_fetch):
        """Test feed history with end time filter only."""
        mock_fetch.return_value = {
            'items': [
                {'feed_id': '1', 'timestamp': '2024-01-15T00:00:00Z'},
                {'feed_id': '2', 'timestamp': '2024-01-05T00:00:00Z'},
            ],
            'last_evaluated_key': None
        }

        from app.services.feed_service import get_feed_history
        result = await get_feed_history(
            page=1,
            limit=10,
            end_time='2024-01-10T00:00:00Z'
        )

        assert result['total_items'] == 1

    @patch('app.services.feed_service.fetch_feed_events_from_db')
    @pytest.mark.asyncio
    async def test_get_feed_history_empty_timestamp(self, mock_fetch):
        """Test feed history filters items without timestamp."""
        mock_fetch.return_value = {
            'items': [
                {'feed_id': '1', 'timestamp': '2024-01-15T00:00:00Z'},
                {'feed_id': '2'},
            ],
            'last_evaluated_key': None
        }

        from app.services.feed_service import get_feed_history
        result = await get_feed_history(
            page=1,
            limit=10,
            start_time='2024-01-01T00:00:00Z'
        )

        assert result['total_items'] == 1

    @patch('app.services.feed_service.fetch_feed_events_from_db')
    @pytest.mark.asyncio
    async def test_get_feed_history_with_pagination_key(self, mock_fetch):
        """Test feed history with multiple scan calls."""
        mock_fetch.side_effect = [
            {
                'items': [{'feed_id': '1', 'timestamp': '2024-01-01T00:00:00Z'}],
                'last_evaluated_key': {'feed_id': '1'}
            },
            {
                'items': [{'feed_id': '2', 'timestamp': '2024-01-02T00:00:00Z'}],
                'last_evaluated_key': None
            }
        ]

        from app.services.feed_service import get_feed_history
        result = await get_feed_history(page=1, limit=10)

        assert result['total_items'] == 2

    @patch('app.services.feed_service.fetch_feed_events_from_db')
    @pytest.mark.asyncio
    async def test_get_feed_history_decimal_conversion(self, mock_fetch):
        """Test feed history converts Decimal values."""
        mock_fetch.return_value = {
            'items': [
                {
                    'feed_id': '1',
                    'timestamp': '2024-01-01T00:00:00Z',
                    'weight_g': Decimal('350.5')
                }
            ],
            'last_evaluated_key': None
        }

        from app.services.feed_service import get_feed_history
        result = await get_feed_history(page=1, limit=10)

        assert result['items'][0]['weight_g'] == 350.5
