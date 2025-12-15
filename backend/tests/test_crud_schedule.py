"""
Tests for schedule CRUD operations.
"""
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from app.models.schedule import ScheduleRequest, ScheduleUpdate


class TestScheduleCrud:
    """Test cases for schedule CRUD operations."""

    def test_convert_decimal_int(self):
        """Test converting Decimal whole numbers to int."""
        from app.crud.schedule import convert_decimal
        result = convert_decimal(Decimal('100'))
        assert result == 100
        assert isinstance(result, int)

    def test_convert_decimal_float(self):
        """Test converting Decimal fractions to float."""
        from app.crud.schedule import convert_decimal
        result = convert_decimal(Decimal('100.5'))
        assert result == 100.5
        assert isinstance(result, float)

    def test_convert_decimal_list(self):
        """Test converting list with Decimals."""
        from app.crud.schedule import convert_decimal
        result = convert_decimal([Decimal('1'), Decimal('2.5')])
        assert result == [1, 2.5]

    def test_convert_decimal_dict(self):
        """Test converting dict with Decimals."""
        from app.crud.schedule import convert_decimal
        result = convert_decimal({'a': Decimal('10'), 'b': Decimal('20.5')})
        assert result == {'a': 10, 'b': 20.5}

    def test_convert_decimal_passthrough(self):
        """Test that non-Decimal values pass through unchanged."""
        from app.crud.schedule import convert_decimal
        result = convert_decimal("string value")
        assert result == "string value"

    @patch('app.crud.schedule.get_feed_schedule_table')
    def test_create_schedule_success(self, mock_get_table):
        """Test creating a schedule."""
        mock_table = MagicMock()
        mock_table.put_item.return_value = {}
        mock_get_table.return_value = mock_table

        from app.crud.schedule import create_schedule
        request = ScheduleRequest(
            requested_by='test_user',
            scheduled_time='2025-10-18T14:30:00Z',
            feed_cycles=1,
            recurrence='daily',
            enabled=True
        )
        result = create_schedule(request)

        assert 'schedule_id' in result
        assert result['requested_by'] == 'test_user'
        assert result['scheduled_time'] == '2025-10-18T14:30:00Z'
        assert result['recurrence'] == 'daily'
        mock_table.put_item.assert_called_once()

    @patch('app.crud.schedule.get_feed_schedule_table')
    def test_create_schedule_error(self, mock_get_table):
        """Test error handling when creating schedule."""
        mock_table = MagicMock()
        mock_table.put_item.side_effect = ClientError(
            {'Error': {'Code': '500', 'Message': 'Test error'}},
            'PutItem'
        )
        mock_get_table.return_value = mock_table

        from app.crud.schedule import create_schedule
        request = ScheduleRequest(
            requested_by='test_user',
            scheduled_time='2025-10-18T14:30:00Z'
        )
        with pytest.raises(ClientError):
            create_schedule(request)

    @patch('app.crud.schedule.get_feed_schedule_table')
    def test_get_schedule_found(self, mock_get_table):
        """Test getting a schedule that exists."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            'Item': {
                'schedule_id': 'test-123',
                'scheduled_time': '08:00',
                'feed_cycles': Decimal('1')
            }
        }
        mock_get_table.return_value = mock_table

        from app.crud.schedule import get_schedule
        result = get_schedule('test-123')

        assert result is not None
        assert result['schedule_id'] == 'test-123'
        assert result['feed_cycles'] == 1

    @patch('app.crud.schedule.get_feed_schedule_table')
    def test_get_schedule_not_found(self, mock_get_table):
        """Test getting a schedule that doesn't exist."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}
        mock_get_table.return_value = mock_table

        from app.crud.schedule import get_schedule
        result = get_schedule('nonexistent')

        assert result is None

    @patch('app.crud.schedule.get_feed_schedule_table')
    def test_get_schedule_error(self, mock_get_table):
        """Test error handling when getting schedule."""
        mock_table = MagicMock()
        mock_table.get_item.side_effect = ClientError(
            {'Error': {'Code': '500', 'Message': 'Test error'}},
            'GetItem'
        )
        mock_get_table.return_value = mock_table

        from app.crud.schedule import get_schedule
        with pytest.raises(ClientError):
            get_schedule('test-123')

    @patch('app.crud.schedule.get_feed_schedule_table')
    def test_list_schedules_success(self, mock_get_table):
        """Test listing schedules."""
        mock_table = MagicMock()
        mock_table.scan.return_value = {
            'Items': [
                {'schedule_id': '1', 'created_at': '2024-01-02T00:00:00Z'},
                {'schedule_id': '2', 'created_at': '2024-01-01T00:00:00Z'},
            ]
        }
        mock_get_table.return_value = mock_table

        from app.crud.schedule import list_schedules
        result = list_schedules(page=1, page_size=10)

        assert result['total'] == 2
        assert len(result['schedules']) == 2
        assert result['page'] == 1
        assert result['has_next'] is False

    @patch('app.crud.schedule.get_feed_schedule_table')
    def test_list_schedules_with_filter(self, mock_get_table):
        """Test listing schedules with user filter."""
        mock_table = MagicMock()
        mock_table.scan.return_value = {
            'Items': [
                {'schedule_id': '1', 'requested_by': 'user1', 'created_at': '2024-01-01T00:00:00Z'}
            ]
        }
        mock_get_table.return_value = mock_table

        from app.crud.schedule import list_schedules
        result = list_schedules(page=1, page_size=10, requested_by='user1')

        assert result['total'] == 1
        call_args = mock_table.scan.call_args[1]
        assert 'FilterExpression' in call_args

    @patch('app.crud.schedule.get_feed_schedule_table')
    def test_list_schedules_pagination(self, mock_get_table):
        """Test listing schedules with pagination."""
        mock_table = MagicMock()
        mock_table.scan.return_value = {
            'Items': [
                {'schedule_id': str(i), 'created_at': f'2024-01-{i:02d}T00:00:00Z'}
                for i in range(1, 26)
            ]
        }
        mock_get_table.return_value = mock_table

        from app.crud.schedule import list_schedules
        result = list_schedules(page=1, page_size=10)

        assert result['total'] == 25
        assert len(result['schedules']) == 10
        assert result['has_next'] is True

    @patch('app.crud.schedule.get_feed_schedule_table')
    def test_list_schedules_error(self, mock_get_table):
        """Test error handling when listing schedules."""
        mock_table = MagicMock()
        mock_table.scan.side_effect = ClientError(
            {'Error': {'Code': '500', 'Message': 'Test error'}},
            'Scan'
        )
        mock_get_table.return_value = mock_table

        from app.crud.schedule import list_schedules
        with pytest.raises(ClientError):
            list_schedules()

    @patch('app.crud.schedule.get_feed_schedule_table')
    def test_update_schedule_success(self, mock_get_table):
        """Test updating a schedule."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            'Item': {
                'schedule_id': 'test-123',
                'timezone': 'UTC',
                'scheduled_time': '08:00'
            }
        }
        mock_table.update_item.return_value = {
            'Attributes': {
                'schedule_id': 'test-123',
                'scheduled_time': '2025-12-15T09:00:00Z',
                'feed_cycles': Decimal('2'),
                'timezone': 'UTC'
            }
        }
        mock_get_table.return_value = mock_table

        from app.crud.schedule import update_schedule
        update = ScheduleUpdate(scheduled_time='2025-12-15T09:00:00', feed_cycles=2)
        result = update_schedule('test-123', update)

        assert 'scheduled_time' in result
        assert result['feed_cycles'] == 2

    @patch('app.crud.schedule.get_feed_schedule_table')
    def test_update_schedule_with_timezone(self, mock_get_table):
        """Test updating schedule with timezone."""
        mock_table = MagicMock()
        mock_table.update_item.return_value = {
            'Attributes': {
                'schedule_id': 'test-123',
                'scheduled_time': '09:00',
                'timezone': 'America/New_York'
            }
        }
        mock_get_table.return_value = mock_table

        from app.crud.schedule import update_schedule
        update = ScheduleUpdate(timezone='America/New_York')
        result = update_schedule('test-123', update)

        assert result['timezone'] == 'America/New_York'
        call_args = mock_table.update_item.call_args
        assert ':tz' in call_args[1]['ExpressionAttributeValues']

    @patch('app.crud.schedule.get_feed_schedule_table')
    def test_update_schedule_all_fields(self, mock_get_table):
        """Test updating all schedule fields."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            'Item': {
                'schedule_id': 'test-123',
                'timezone': 'America/New_York',
                'scheduled_time': '08:00'
            }
        }
        mock_table.update_item.return_value = {
            'Attributes': {
                'schedule_id': 'test-123',
                'scheduled_time': '2025-10-18T14:00:00Z',
                'feed_cycles': Decimal('3'),
                'recurrence': 'daily',
                'enabled': False,
                'timezone': 'America/New_York'
            }
        }
        mock_get_table.return_value = mock_table

        from app.crud.schedule import update_schedule
        update = ScheduleUpdate(
            scheduled_time='2025-10-18T10:00:00',
            feed_cycles=3,
            recurrence='daily',
            enabled=False,
            timezone='America/New_York'
        )
        result = update_schedule('test-123', update)

        assert 'scheduled_time' in result
        assert result['recurrence'] == 'daily'
        assert result['enabled'] is False

    @patch('app.crud.schedule.get_feed_schedule_table')
    def test_update_schedule_only_updated_at(self, mock_get_table):
        """Test updating schedule with only updated_at changes."""
        mock_table = MagicMock()
        mock_table.update_item.return_value = {
            'Attributes': {
                'schedule_id': 'test-123',
                'scheduled_time': '2025-10-18T08:00:00Z',
                'updated_at': '2025-01-01T00:00:00Z'
            }
        }
        mock_get_table.return_value = mock_table

        from app.crud.schedule import update_schedule
        update = ScheduleUpdate()
        result = update_schedule('test-123', update)

        assert result['schedule_id'] == 'test-123'
        mock_table.update_item.assert_called_once()

    @patch('app.crud.schedule.get_feed_schedule_table')
    def test_update_schedule_not_found(self, mock_get_table):
        """Test updating a non-existent schedule returns None."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {'Item': None}
        mock_get_table.return_value = mock_table

        from app.crud.schedule import update_schedule
        update = ScheduleUpdate(scheduled_time='2025-12-15T09:00:00')
        result = update_schedule('nonexistent-id', update)

        assert result is None

    @patch('app.crud.schedule.get_feed_schedule_table')
    def test_update_schedule_error(self, mock_get_table):
        """Test error handling when updating schedule."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            'Item': {
                'schedule_id': 'test-123',
                'timezone': 'UTC',
                'scheduled_time': '08:00'
            }
        }
        mock_table.update_item.side_effect = ClientError(
            {'Error': {'Code': '500', 'Message': 'Test error'}},
            'UpdateItem'
        )
        mock_get_table.return_value = mock_table

        from app.crud.schedule import update_schedule
        update = ScheduleUpdate(scheduled_time='2025-12-15T09:00:00')
        with pytest.raises(ClientError):
            update_schedule('test-123', update)

    @patch('app.crud.schedule.get_feed_schedule_table')
    def test_delete_schedule_success(self, mock_get_table):
        """Test deleting a schedule."""
        mock_table = MagicMock()
        mock_table.delete_item.return_value = {}
        mock_get_table.return_value = mock_table

        from app.crud.schedule import delete_schedule
        result = delete_schedule('test-123')

        assert result is True
        mock_table.delete_item.assert_called_once_with(Key={'schedule_id': 'test-123'})

    @patch('app.crud.schedule.get_feed_schedule_table')
    def test_delete_schedule_error(self, mock_get_table):
        """Test error handling when deleting schedule."""
        mock_table = MagicMock()
        mock_table.delete_item.side_effect = ClientError(
            {'Error': {'Code': '500', 'Message': 'Test error'}},
            'DeleteItem'
        )
        mock_get_table.return_value = mock_table

        from app.crud.schedule import delete_schedule
        with pytest.raises(ClientError):
            delete_schedule('test-123')

    @patch('app.crud.schedule.get_feed_schedule_table')
    def test_toggle_schedule_enable(self, mock_get_table):
        """Test enabling a schedule."""
        mock_table = MagicMock()
        mock_table.update_item.return_value = {
            'Attributes': {
                'schedule_id': 'test-123',
                'enabled': True
            }
        }
        mock_get_table.return_value = mock_table

        from app.crud.schedule import toggle_schedule
        result = toggle_schedule('test-123', True)

        assert result['enabled'] is True

    @patch('app.crud.schedule.get_feed_schedule_table')
    def test_toggle_schedule_disable(self, mock_get_table):
        """Test disabling a schedule."""
        mock_table = MagicMock()
        mock_table.update_item.return_value = {
            'Attributes': {
                'schedule_id': 'test-123',
                'enabled': False
            }
        }
        mock_get_table.return_value = mock_table

        from app.crud.schedule import toggle_schedule
        result = toggle_schedule('test-123', False)

        assert result['enabled'] is False

    @patch('app.crud.schedule.get_feed_schedule_table')
    def test_toggle_schedule_error(self, mock_get_table):
        """Test error handling when toggling schedule."""
        mock_table = MagicMock()
        mock_table.update_item.side_effect = ClientError(
            {'Error': {'Code': '500', 'Message': 'Test error'}},
            'UpdateItem'
        )
        mock_get_table.return_value = mock_table

        from app.crud.schedule import toggle_schedule
        with pytest.raises(ClientError):
            toggle_schedule('test-123', True)
