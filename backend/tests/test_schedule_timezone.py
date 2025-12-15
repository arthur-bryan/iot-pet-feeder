"""
Tests for schedule timezone conversion functionality.
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.crud.schedule import convert_to_utc
from app.models.schedule import ScheduleRequest


class TestTimezoneConversion:
    """Test timezone conversion in schedule creation."""

    def test_convert_to_utc_from_new_york(self):
        """Test converting New York time to UTC."""
        # 2:00 PM EST (UTC-5) -> 7:00 PM UTC
        ny_time = "2025-12-14T14:00:00"
        utc_time = convert_to_utc(ny_time, "America/New_York")

        # Parse both times
        utc_dt = datetime.fromisoformat(utc_time.replace('Z', '+00:00'))

        # Verify conversion
        assert utc_dt.hour == 19  # 14:00 EST + 5 hours = 19:00 UTC

    def test_convert_to_utc_from_sao_paulo(self):
        """Test converting Sao Paulo time to UTC."""
        # 11:00 AM BRT (UTC-3) -> 2:00 PM UTC
        sp_time = "2025-12-14T11:00:00"
        utc_time = convert_to_utc(sp_time, "America/Sao_Paulo")

        utc_dt = datetime.fromisoformat(utc_time.replace('Z', '+00:00'))

        # Verify conversion
        assert utc_dt.hour == 14  # 11:00 BRT + 3 hours = 14:00 UTC

    def test_convert_to_utc_already_utc(self):
        """Test converting UTC time (no change)."""
        utc_time = "2025-12-14T14:00:00Z"
        result = convert_to_utc(utc_time, "UTC")

        assert "2025-12-14T14:00:00Z" == result

    def test_convert_to_utc_from_tokyo(self):
        """Test converting Tokyo time to UTC."""
        # 11:00 PM JST (UTC+9) -> 2:00 PM UTC
        tokyo_time = "2025-12-14T23:00:00"
        utc_time = convert_to_utc(tokyo_time, "Asia/Tokyo")

        utc_dt = datetime.fromisoformat(utc_time.replace('Z', '+00:00'))

        # Verify conversion
        assert utc_dt.hour == 14  # 23:00 JST - 9 hours = 14:00 UTC


class TestScheduleValidation:
    """Test schedule validation including future time check."""

    def test_schedule_validation_future_time_valid(self):
        """Test that future times are accepted."""
        future_dt = datetime.utcnow() + timedelta(hours=1)
        future_time = future_dt.strftime('%Y-%m-%dT%H:%M:%S')

        request = ScheduleRequest(
            requested_by="test@example.com",
            scheduled_time=future_time,
            feed_cycles=1,
            recurrence="none",
            timezone="America/New_York"
        )

        assert request.scheduled_time == future_time

    def test_schedule_validation_future_time_in_production(self):
        """Test that future times pass validation in production mode."""
        import os

        # Temporarily set to production mode to test validation
        old_env = os.environ.get('ENVIRONMENT')
        try:
            os.environ['ENVIRONMENT'] = 'production'

            future_time = (datetime.utcnow() + timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%S')

            # This should NOT raise an error
            request = ScheduleRequest(
                requested_by="test@example.com",
                scheduled_time=future_time,
                feed_cycles=1,
                recurrence="none",
                timezone="UTC"
            )

            assert request.scheduled_time == future_time
        finally:
            # Restore original environment
            if old_env:
                os.environ['ENVIRONMENT'] = old_env
            else:
                del os.environ['ENVIRONMENT']

    def test_schedule_validation_past_time_rejected(self):
        """Test that past times are rejected in production mode."""
        import os

        # Temporarily set to production mode to test validation
        old_env = os.environ.get('ENVIRONMENT')
        try:
            os.environ['ENVIRONMENT'] = 'production'

            past_time = (datetime.utcnow() - timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M:%S')

            with pytest.raises(ValueError, match="scheduled_time must be in the future"):
                ScheduleRequest(
                    requested_by="test@example.com",
                    scheduled_time=past_time,
                    feed_cycles=1,
                    recurrence="none",
                    timezone="UTC"
                )
        finally:
            # Restore original environment
            if old_env:
                os.environ['ENVIRONMENT'] = old_env
            else:
                del os.environ['ENVIRONMENT']

    def test_schedule_validation_invalid_timezone(self):
        """Test that invalid timezones are rejected."""
        future_time = (datetime.now() + timedelta(hours=1)).isoformat()

        with pytest.raises(ValueError, match="Invalid timezone"):
            ScheduleRequest(
                requested_by="test@example.com",
                scheduled_time=future_time,
                feed_cycles=1,
                recurrence="none",
                timezone="Invalid/Timezone"
            )


class TestRecurrencePatterns:
    """Test recurrence pattern calculations."""

    def test_daily_recurrence(self):
        """Test daily recurrence calculation."""
        import sys
        import os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
        from schedule_executor import calculate_next_execution

        scheduled_time = "2025-12-14T14:00:00Z"
        next_time = calculate_next_execution(scheduled_time, "daily")

        assert next_time == "2025-12-15T14:00:00Z"

    def test_weekly_recurrence(self):
        """Test weekly recurrence calculation."""
        import sys
        import os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
        from schedule_executor import calculate_next_execution

        scheduled_time = "2025-12-14T14:00:00Z"
        next_time = calculate_next_execution(scheduled_time, "weekly")

        assert next_time == "2025-12-21T14:00:00Z"

    def test_monthly_recurrence(self):
        """Test monthly recurrence calculation."""
        import sys
        import os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
        from schedule_executor import calculate_next_execution

        scheduled_time = "2025-12-14T14:00:00Z"
        next_time = calculate_next_execution(scheduled_time, "monthly")

        # Should be Jan 14, 2026
        assert next_time == "2026-01-14T14:00:00Z"

    def test_monthly_recurrence_edge_case(self):
        """Test monthly recurrence with day that doesn't exist in next month."""
        import sys
        import os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
        from schedule_executor import calculate_next_execution

        # Jan 31 -> Feb 28 (2025 is not a leap year)
        scheduled_time = "2025-01-31T14:00:00Z"
        next_time = calculate_next_execution(scheduled_time, "monthly")

        assert next_time == "2025-02-28T14:00:00Z"

    def test_none_recurrence(self):
        """Test that 'none' recurrence doesn't change time."""
        import sys
        import os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
        from schedule_executor import calculate_next_execution

        scheduled_time = "2025-12-14T14:00:00Z"
        next_time = calculate_next_execution(scheduled_time, "none")

        assert next_time == scheduled_time


class TestNewRecurrenceOptions:
    """Test that new recurrence options are accepted by the model."""

    def test_weekly_recurrence_in_model(self):
        """Test that weekly recurrence is accepted."""
        future_time = (datetime.utcnow() + timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M:%S')

        request = ScheduleRequest(
            requested_by="test@example.com",
            scheduled_time=future_time,
            feed_cycles=1,
            recurrence="weekly",
            timezone="UTC"
        )

        assert request.recurrence == "weekly"

    def test_monthly_recurrence_in_model(self):
        """Test that monthly recurrence is accepted."""
        future_time = (datetime.utcnow() + timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M:%S')

        request = ScheduleRequest(
            requested_by="test@example.com",
            scheduled_time=future_time,
            feed_cycles=1,
            recurrence="monthly",
            timezone="UTC"
        )

        assert request.recurrence == "monthly"
