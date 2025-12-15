"""
Tests for schedule models including timezone validation.
"""
import pytest
from pydantic import ValidationError


class TestScheduleModels:
    """Test cases for schedule models."""

    def test_schedule_request_valid_timezone(self):
        """Test schedule request with valid timezone."""
        from app.models.schedule import ScheduleRequest
        request = ScheduleRequest(
            requested_by='test@example.com',
            scheduled_time='2025-10-18T08:00:00Z',
            timezone='America/New_York'
        )
        assert request.timezone == 'America/New_York'

    def test_schedule_request_default_timezone(self):
        """Test schedule request with default timezone."""
        from app.models.schedule import ScheduleRequest
        request = ScheduleRequest(
            requested_by='test@example.com',
            scheduled_time='2025-10-18T08:00:00Z'
        )
        assert request.timezone == 'UTC'

    def test_schedule_request_invalid_timezone(self):
        """Test schedule request with invalid timezone."""
        from app.models.schedule import ScheduleRequest
        with pytest.raises(ValidationError) as exc_info:
            ScheduleRequest(
                requested_by='test@example.com',
                scheduled_time='2025-10-18T08:00:00Z',
                timezone='Invalid/Timezone'
            )
        assert 'Invalid timezone' in str(exc_info.value)

    def test_schedule_request_valid_scheduled_time(self):
        """Test schedule request with valid scheduled time."""
        from app.models.schedule import ScheduleRequest
        request = ScheduleRequest(
            requested_by='test@example.com',
            scheduled_time='2025-10-18T08:00:00Z'
        )
        assert request.scheduled_time == '2025-10-18T08:00:00Z'

    def test_schedule_request_invalid_scheduled_time(self):
        """Test schedule request with invalid scheduled time."""
        from app.models.schedule import ScheduleRequest
        with pytest.raises(ValidationError) as exc_info:
            ScheduleRequest(
                requested_by='test@example.com',
                scheduled_time='invalid-time'
            )
        assert 'ISO 8601' in str(exc_info.value)

    def test_schedule_update_valid_timezone(self):
        """Test schedule update with valid timezone."""
        from app.models.schedule import ScheduleUpdate
        update = ScheduleUpdate(timezone='Europe/London')
        assert update.timezone == 'Europe/London'

    def test_schedule_update_none_timezone(self):
        """Test schedule update with None timezone."""
        from app.models.schedule import ScheduleUpdate
        update = ScheduleUpdate(timezone=None)
        assert update.timezone is None

    def test_schedule_update_invalid_timezone(self):
        """Test schedule update with invalid timezone."""
        from app.models.schedule import ScheduleUpdate
        with pytest.raises(ValidationError) as exc_info:
            ScheduleUpdate(timezone='Invalid/Zone')
        assert 'Invalid timezone' in str(exc_info.value)

    def test_schedule_response_with_timezone(self):
        """Test schedule response includes timezone."""
        from app.models.schedule import ScheduleResponse
        response = ScheduleResponse(
            schedule_id='test-123',
            requested_by='test@example.com',
            scheduled_time='2025-10-18T08:00:00Z',
            feed_cycles=1,
            recurrence='daily',
            enabled=True,
            created_at='2024-01-01T00:00:00Z',
            timezone='Asia/Tokyo'
        )
        assert response.timezone == 'Asia/Tokyo'

    def test_schedule_response_default_timezone(self):
        """Test schedule response default timezone."""
        from app.models.schedule import ScheduleResponse
        response = ScheduleResponse(
            schedule_id='test-123',
            requested_by='test@example.com',
            scheduled_time='2025-10-18T08:00:00Z',
            feed_cycles=1,
            recurrence='daily',
            enabled=True,
            created_at='2024-01-01T00:00:00Z'
        )
        assert response.timezone == 'UTC'
