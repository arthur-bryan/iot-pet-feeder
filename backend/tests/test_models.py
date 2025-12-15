"""
Tests for Pydantic models.
"""
import pytest
from pydantic import ValidationError


class TestScheduleModels:
    """Test cases for schedule models."""

    def test_schedule_request_valid(self):
        """Test valid ScheduleRequest."""
        from app.models.schedule import ScheduleRequest
        request = ScheduleRequest(
            requested_by='test@example.com',
            scheduled_time='2025-10-18T14:30:00Z',
            feed_cycles=1,
            recurrence='daily',
            enabled=True
        )

        assert request.requested_by == 'test@example.com'
        assert request.scheduled_time == '2025-10-18T14:30:00Z'

    def test_schedule_request_invalid_time_format(self):
        """Test ScheduleRequest with invalid time format."""
        from app.models.schedule import ScheduleRequest
        with pytest.raises(ValidationError) as exc_info:
            ScheduleRequest(
                requested_by='test@example.com',
                scheduled_time='08:00',
                feed_cycles=1
            )

        assert 'ISO 8601' in str(exc_info.value)

    def test_schedule_request_invalid_time_value(self):
        """Test ScheduleRequest with invalid datetime value."""
        from app.models.schedule import ScheduleRequest
        with pytest.raises(ValidationError) as exc_info:
            ScheduleRequest(
                requested_by='test@example.com',
                scheduled_time='not-a-datetime',
                feed_cycles=1
            )

        assert 'ISO 8601' in str(exc_info.value)

    def test_schedule_update_valid(self):
        """Test valid ScheduleUpdate."""
        from app.models.schedule import ScheduleUpdate
        update = ScheduleUpdate(
            scheduled_time='2025-10-18T10:00:00Z',
            feed_cycles=2,
            recurrence='daily',
            enabled=False
        )

        assert update.scheduled_time == '2025-10-18T10:00:00Z'
        assert update.feed_cycles == 2

    def test_schedule_update_all_optional(self):
        """Test ScheduleUpdate with no fields."""
        from app.models.schedule import ScheduleUpdate
        update = ScheduleUpdate()

        assert update.scheduled_time is None
        assert update.feed_cycles is None

    def test_schedule_response_valid(self):
        """Test valid ScheduleResponse."""
        from app.models.schedule import ScheduleResponse
        response = ScheduleResponse(
            schedule_id='test-123',
            requested_by='test@example.com',
            scheduled_time='2025-10-18T14:30:00Z',
            feed_cycles=1,
            recurrence='daily',
            enabled=True,
            created_at='2025-01-01T00:00:00Z'
        )

        assert response.schedule_id == 'test-123'
        assert response.requested_by == 'test@example.com'
