"""
Tests for schedule_executor Lambda handler.
"""
import json
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch


class TestScheduleExecutor:
    """Test cases for schedule execution functionality."""

    def test_is_schedule_due_returns_true_when_due(self):
        """Test that is_schedule_due returns True when schedule is due."""
        from schedule_executor import is_schedule_due

        current_time = datetime(2025, 12, 13, 14, 0, 30)
        schedule_time = "2025-12-13T14:00:00Z"

        result = is_schedule_due(schedule_time, current_time, tolerance_minutes=1)

        assert result is True

    def test_is_schedule_due_returns_false_when_not_due(self):
        """Test that is_schedule_due returns False when schedule is not due."""
        from schedule_executor import is_schedule_due

        current_time = datetime(2025, 12, 13, 14, 0, 0)
        schedule_time = "2025-12-13T15:00:00Z"

        result = is_schedule_due(schedule_time, current_time, tolerance_minutes=1)

        assert result is False

    def test_is_schedule_due_returns_false_when_too_old(self):
        """Test that is_schedule_due returns False when schedule is more than max_overdue_minutes old."""
        from schedule_executor import is_schedule_due

        current_time = datetime(2025, 12, 13, 15, 30, 0)
        schedule_time = "2025-12-13T14:00:00Z"  # 90 minutes ago

        result = is_schedule_due(schedule_time, current_time)

        assert result is False

    def test_is_schedule_due_returns_true_when_overdue_within_limit(self):
        """Test that is_schedule_due returns True for overdue schedules within max_overdue_minutes."""
        from schedule_executor import is_schedule_due

        current_time = datetime(2025, 12, 13, 14, 30, 0)
        schedule_time = "2025-12-13T14:00:00Z"  # 30 minutes ago

        result = is_schedule_due(schedule_time, current_time)

        assert result is True

    def test_calculate_next_execution_daily(self):
        """Test that calculate_next_execution adds 1 day for daily recurrence."""
        from schedule_executor import calculate_next_execution

        schedule_time = "2025-12-13T14:00:00Z"
        result = calculate_next_execution(schedule_time, "daily")

        assert result == "2025-12-14T14:00:00Z"

    def test_calculate_next_execution_none(self):
        """Test that calculate_next_execution returns same time for no recurrence."""
        from schedule_executor import calculate_next_execution

        schedule_time = "2025-12-13T14:00:00Z"
        result = calculate_next_execution(schedule_time, "none")

        assert result == schedule_time

    def test_convert_decimal(self):
        """Test Decimal to int/float conversion for JSON serialization."""
        from schedule_executor import convert_decimal

        data = {
            'int_value': Decimal('10'),
            'float_value': Decimal('10.5'),
            'list': [Decimal('1'), Decimal('2.5')],
            'nested': {'value': Decimal('100')}
        }

        result = convert_decimal(data)

        assert result['int_value'] == 10
        assert result['float_value'] == 10.5
        assert result['list'] == [1, 2.5]
        assert result['nested']['value'] == 100

    @patch('schedule_executor.schedule_table')
    @patch('schedule_executor.trigger_scheduled_feed')
    @patch('schedule_executor.update_schedule_after_execution')
    def test_handler_executes_due_schedules(
        self, mock_update, mock_trigger, mock_table, sample_schedule, mock_lambda_context
    ):
        """Test that handler executes schedules that are due."""
        from schedule_executor import handler

        now = datetime.utcnow()
        sample_schedule['scheduled_time'] = now.strftime("%Y-%m-%dT%H:%M:%SZ")

        mock_table.scan = MagicMock(return_value={'Items': [sample_schedule]})
        mock_trigger.return_value = True
        mock_update.return_value = True

        result = handler({}, mock_lambda_context)

        assert result['statusCode'] == 200
        mock_trigger.assert_called_once()

    @patch('schedule_executor.schedule_table')
    def test_handler_skips_not_due_schedules(
        self, mock_table, sample_schedule, mock_lambda_context
    ):
        """Test that handler skips schedules that are not due."""
        from schedule_executor import handler

        future_time = (datetime.utcnow() + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
        sample_schedule['scheduled_time'] = future_time

        mock_table.scan = MagicMock(return_value={'Items': [sample_schedule]})

        result = handler({}, mock_lambda_context)

        assert result['statusCode'] == 200
        body = json.loads(result['body'])
        assert body['executed'] == 0

    @patch('schedule_executor.schedule_table')
    def test_handler_handles_empty_schedules(self, mock_table, mock_lambda_context):
        """Test that handler handles case with no enabled schedules."""
        from schedule_executor import handler

        mock_table.scan = MagicMock(return_value={'Items': []})

        result = handler({}, mock_lambda_context)

        assert result['statusCode'] == 200
        body = json.loads(result['body'])
        assert body['total_schedules'] == 0
