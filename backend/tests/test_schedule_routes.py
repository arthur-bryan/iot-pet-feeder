"""
Tests for schedule API routes.
"""
import base64
import json
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


def create_test_token(email: str) -> str:
    """Create a test JWT token with email claim."""
    header = base64.urlsafe_b64encode(b'{"alg":"RS256"}').decode().rstrip('=')
    payload = base64.urlsafe_b64encode(json.dumps({'email': email}).encode()).decode().rstrip('=')
    signature = base64.urlsafe_b64encode(b'testsig').decode().rstrip('=')
    return f"Bearer {header}.{payload}.{signature}"


class TestScheduleHelpers:
    """Test cases for schedule helper functions."""

    @patch('app.core.auth.verify_jwt_token')
    def test_extract_email_from_token_valid(self, mock_verify):
        """Test extracting email from valid token."""
        from app.core.auth import extract_email_from_token
        mock_verify.return_value = {'email': 'test@example.com'}
        token = create_test_token('test@example.com')
        assert extract_email_from_token(token) == 'test@example.com'

    def test_extract_email_from_token_no_bearer(self):
        """Test extracting email without Bearer prefix."""
        from app.core.auth import extract_email_from_token
        assert extract_email_from_token('invalid') is None

    def test_extract_email_from_token_none(self):
        """Test extracting email from None."""
        from app.core.auth import extract_email_from_token
        assert extract_email_from_token(None) is None

    def test_extract_email_from_token_invalid_format(self):
        """Test extracting email from invalid token format."""
        from app.core.auth import extract_email_from_token
        assert extract_email_from_token('Bearer invalid') is None

    def test_extract_email_from_token_decode_error(self):
        """Test extracting email with decode error."""
        from app.core.auth import extract_email_from_token
        assert extract_email_from_token('Bearer a.!!!.c') is None

    @patch('app.core.auth.ENVIRONMENT', 'demo')
    def test_is_admin_demo_mode(self):
        """Test is_admin returns True in demo mode."""
        from app.core.auth import is_admin
        assert is_admin('test@example.com') is True

    @patch('app.core.auth.ENVIRONMENT', 'dev')
    @patch('app.core.auth.USER_POOL_ID', None)
    def test_is_admin_no_pool(self):
        """Test is_admin returns True when no pool configured."""
        from app.core.auth import is_admin
        assert is_admin('test@example.com') is True

    @patch('app.core.auth.ENVIRONMENT', 'dev')
    @patch('app.core.auth.USER_POOL_ID', 'pool-123')
    @patch('app.core.auth._get_cognito_client')
    def test_is_admin_true(self, mock_get_client):
        """Test is_admin returns True for admin user."""
        from app.core.auth import is_admin
        mock_client = mock_get_client.return_value
        mock_client.admin_list_groups_for_user.return_value = {
            'Groups': [{'GroupName': 'admin'}]
        }
        assert is_admin('admin@example.com') is True

    @patch('app.core.auth.ENVIRONMENT', 'dev')
    @patch('app.core.auth.USER_POOL_ID', 'pool-123')
    @patch('app.core.auth._get_cognito_client')
    def test_is_admin_false(self, mock_get_client):
        """Test is_admin returns False for non-admin user."""
        from app.core.auth import is_admin
        mock_client = mock_get_client.return_value
        mock_client.admin_list_groups_for_user.return_value = {
            'Groups': [{'GroupName': 'users'}]
        }
        assert is_admin('user@example.com') is False

    @patch('app.core.auth.ENVIRONMENT', 'dev')
    @patch('app.core.auth.USER_POOL_ID', 'pool-123')
    @patch('app.core.auth._get_cognito_client')
    def test_is_admin_error(self, mock_get_client):
        """Test is_admin returns False on error."""
        from botocore.exceptions import ClientError

        from app.core.auth import is_admin
        mock_client = mock_get_client.return_value
        mock_client.admin_list_groups_for_user.side_effect = ClientError(
            {'Error': {'Code': 'TestError', 'Message': 'Test error'}}, 'test'
        )
        assert is_admin('test@example.com') is False

    @patch('app.api.v1.routes.schedule.is_admin')
    def test_verify_schedule_ownership_admin(self, mock_is_admin):
        """Test admin can access any schedule."""
        from app.api.v1.routes.schedule import verify_schedule_ownership
        mock_is_admin.return_value = True
        schedule = {'requested_by': 'other@example.com'}
        assert verify_schedule_ownership(schedule, 'admin@example.com') is True

    @patch('app.api.v1.routes.schedule.is_admin')
    def test_verify_schedule_ownership_owner(self, mock_is_admin):
        """Test owner can access their schedule."""
        from app.api.v1.routes.schedule import verify_schedule_ownership
        mock_is_admin.return_value = False
        schedule = {'requested_by': 'user@example.com'}
        assert verify_schedule_ownership(schedule, 'user@example.com') is True

    @patch('app.api.v1.routes.schedule.is_admin')
    def test_verify_schedule_ownership_not_owner(self, mock_is_admin):
        """Test non-owner cannot access schedule."""
        from app.api.v1.routes.schedule import verify_schedule_ownership
        mock_is_admin.return_value = False
        schedule = {'requested_by': 'other@example.com'}
        assert verify_schedule_ownership(schedule, 'user@example.com') is False


class TestScheduleRoutes:
    """Test cases for schedule API routes."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        from app.main import app
        return TestClient(app)

    @patch('app.api.v1.routes.schedule.create_schedule_db')
    def test_create_schedule_success(self, mock_create, client):
        """Test successful schedule creation."""
        from datetime import datetime, timedelta

        future_time = (datetime.utcnow() + timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%S') + 'Z'

        mock_create.return_value = {
            'schedule_id': 'test-123',
            'requested_by': 'test_user',
            'scheduled_time': future_time,
            'feed_cycles': 1,
            'recurrence': 'daily',
            'enabled': True,
            'created_at': '2024-01-01T00:00:00Z',
            'updated_at': '2024-01-01T00:00:00Z'
        }

        response = client.post(
            "/api/v1/schedules",
            json={
                "requested_by": "test_user",
                "scheduled_time": future_time,
                "feed_cycles": 1,
                "recurrence": "daily",
                "enabled": True
            }
        )

        assert response.status_code == 201
        data = response.json()
        assert data['schedule_id'] == 'test-123'

    @patch('app.api.v1.routes.schedule.create_schedule_db')
    def test_create_schedule_error(self, mock_create, client):
        """Test schedule creation error handling."""
        from datetime import datetime, timedelta

        future_time = (datetime.utcnow() + timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%S') + 'Z'

        mock_create.side_effect = Exception("Database error")

        response = client.post(
            "/api/v1/schedules",
            json={
                "requested_by": "test_user",
                "scheduled_time": future_time
            }
        )

        assert response.status_code == 500

    @patch('app.api.v1.routes.schedule.list_schedules_db')
    def test_list_schedules_success(self, mock_list, client):
        """Test listing schedules."""
        mock_list.return_value = {
            'schedules': [
                {
                    'schedule_id': 'test-123',
                    'requested_by': 'test_user',
                    'scheduled_time': '08:00',
                    'feed_cycles': 1,
                    'recurrence': 'daily',
                    'enabled': True,
                    'created_at': '2024-01-01T00:00:00Z',
                    'updated_at': '2024-01-01T00:00:00Z'
                }
            ],
            'total': 1,
            'page': 1,
            'page_size': 20,
            'has_next': False
        }

        response = client.get("/api/v1/schedules")

        assert response.status_code == 200
        data = response.json()
        assert data['total'] == 1
        assert len(data['schedules']) == 1

    @patch('app.api.v1.routes.schedule.list_schedules_db')
    def test_list_schedules_with_filter(self, mock_list, client):
        """Test listing schedules with user filter."""
        mock_list.return_value = {
            'schedules': [],
            'total': 0,
            'page': 1,
            'page_size': 20,
            'has_next': False
        }

        response = client.get("/api/v1/schedules?requested_by=test_user")

        assert response.status_code == 200
        mock_list.assert_called_once_with(page=1, page_size=20, requested_by='test_user')

    @patch('app.api.v1.routes.schedule.list_schedules_db')
    def test_list_schedules_error(self, mock_list, client):
        """Test listing schedules error handling."""
        mock_list.side_effect = Exception("Database error")

        response = client.get("/api/v1/schedules")

        assert response.status_code == 500

    @patch('app.api.v1.routes.schedule.get_schedule_db')
    def test_get_schedule_success(self, mock_get, client):
        """Test getting a single schedule."""
        mock_get.return_value = {
            'schedule_id': 'test-123',
            'requested_by': 'test_user',
            'scheduled_time': '08:00',
            'feed_cycles': 1,
            'recurrence': 'daily',
            'enabled': True,
            'created_at': '2024-01-01T00:00:00Z',
            'updated_at': '2024-01-01T00:00:00Z'
        }

        response = client.get("/api/v1/schedules/test-123")

        assert response.status_code == 200
        data = response.json()
        assert data['schedule_id'] == 'test-123'

    @patch('app.api.v1.routes.schedule.get_schedule_db')
    def test_get_schedule_not_found(self, mock_get, client):
        """Test getting non-existent schedule."""
        mock_get.return_value = None

        response = client.get("/api/v1/schedules/nonexistent")

        assert response.status_code == 404

    @patch('app.api.v1.routes.schedule.get_schedule_db')
    def test_get_schedule_error(self, mock_get, client):
        """Test getting schedule error handling."""
        mock_get.side_effect = Exception("Database error")

        response = client.get("/api/v1/schedules/test-123")

        assert response.status_code == 500

    @patch('app.api.v1.routes.schedule.update_schedule_db')
    @patch('app.api.v1.routes.schedule.get_schedule_db')
    def test_update_schedule_success(self, mock_get, mock_update, client):
        """Test updating a schedule."""
        mock_get.return_value = {
            'schedule_id': 'test-123',
            'scheduled_time': '08:00'
        }
        mock_update.return_value = {
            'schedule_id': 'test-123',
            'requested_by': 'test_user',
            'scheduled_time': '09:00',
            'feed_cycles': 1,
            'recurrence': 'daily',
            'enabled': True,
            'created_at': '2024-01-01T00:00:00Z',
            'updated_at': '2024-01-01T00:00:00Z'
        }

        response = client.put(
            "/api/v1/schedules/test-123",
            json={"scheduled_time": "09:00"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['scheduled_time'] == '09:00'

    @patch('app.api.v1.routes.schedule.get_schedule_db')
    def test_update_schedule_not_found(self, mock_get, client):
        """Test updating non-existent schedule."""
        mock_get.return_value = None

        response = client.put(
            "/api/v1/schedules/nonexistent",
            json={"scheduled_time": "09:00"}
        )

        assert response.status_code == 404

    @patch('app.api.v1.routes.schedule.update_schedule_db')
    @patch('app.api.v1.routes.schedule.get_schedule_db')
    def test_update_schedule_error(self, mock_get, mock_update, client):
        """Test updating schedule error handling."""
        mock_get.return_value = {'schedule_id': 'test-123'}
        mock_update.side_effect = Exception("Database error")

        response = client.put(
            "/api/v1/schedules/test-123",
            json={"scheduled_time": "09:00"}
        )

        assert response.status_code == 500

    @patch('app.api.v1.routes.schedule.delete_schedule_db')
    @patch('app.api.v1.routes.schedule.get_schedule_db')
    def test_delete_schedule_success(self, mock_get, mock_delete, client):
        """Test deleting a schedule."""
        mock_get.return_value = {'schedule_id': 'test-123'}
        mock_delete.return_value = True

        response = client.delete("/api/v1/schedules/test-123")

        assert response.status_code == 204

    @patch('app.api.v1.routes.schedule.get_schedule_db')
    def test_delete_schedule_not_found(self, mock_get, client):
        """Test deleting non-existent schedule."""
        mock_get.return_value = None

        response = client.delete("/api/v1/schedules/nonexistent")

        assert response.status_code == 404

    @patch('app.api.v1.routes.schedule.delete_schedule_db')
    @patch('app.api.v1.routes.schedule.get_schedule_db')
    def test_delete_schedule_error(self, mock_get, mock_delete, client):
        """Test deleting schedule error handling."""
        mock_get.return_value = {'schedule_id': 'test-123'}
        mock_delete.side_effect = Exception("Database error")

        response = client.delete("/api/v1/schedules/test-123")

        assert response.status_code == 500

    @patch('app.api.v1.routes.schedule.toggle_schedule_db')
    @patch('app.api.v1.routes.schedule.get_schedule_db')
    def test_toggle_schedule_enable(self, mock_get, mock_toggle, client):
        """Test enabling a schedule."""
        mock_get.return_value = {'schedule_id': 'test-123'}
        mock_toggle.return_value = {
            'schedule_id': 'test-123',
            'requested_by': 'test_user',
            'scheduled_time': '08:00',
            'feed_cycles': 1,
            'recurrence': 'daily',
            'enabled': True,
            'created_at': '2024-01-01T00:00:00Z',
            'updated_at': '2024-01-01T00:00:00Z'
        }

        response = client.patch("/api/v1/schedules/test-123/toggle?enabled=true")

        assert response.status_code == 200
        data = response.json()
        assert data['enabled'] is True

    @patch('app.api.v1.routes.schedule.toggle_schedule_db')
    @patch('app.api.v1.routes.schedule.get_schedule_db')
    def test_toggle_schedule_disable(self, mock_get, mock_toggle, client):
        """Test disabling a schedule."""
        mock_get.return_value = {'schedule_id': 'test-123'}
        mock_toggle.return_value = {
            'schedule_id': 'test-123',
            'requested_by': 'test_user',
            'scheduled_time': '08:00',
            'feed_cycles': 1,
            'recurrence': 'daily',
            'enabled': False,
            'created_at': '2024-01-01T00:00:00Z',
            'updated_at': '2024-01-01T00:00:00Z'
        }

        response = client.patch("/api/v1/schedules/test-123/toggle?enabled=false")

        assert response.status_code == 200
        data = response.json()
        assert data['enabled'] is False

    @patch('app.api.v1.routes.schedule.get_schedule_db')
    def test_toggle_schedule_not_found(self, mock_get, client):
        """Test toggling non-existent schedule."""
        mock_get.return_value = None

        response = client.patch("/api/v1/schedules/nonexistent/toggle?enabled=true")

        assert response.status_code == 404

    @patch('app.api.v1.routes.schedule.toggle_schedule_db')
    @patch('app.api.v1.routes.schedule.get_schedule_db')
    def test_toggle_schedule_error(self, mock_get, mock_toggle, client):
        """Test toggling schedule error handling."""
        mock_get.return_value = {'schedule_id': 'test-123'}
        mock_toggle.side_effect = Exception("Database error")

        response = client.patch("/api/v1/schedules/test-123/toggle?enabled=true")

        assert response.status_code == 500

    @patch('app.api.v1.routes.schedule.verify_schedule_ownership')
    @patch('app.api.v1.routes.schedule.extract_email_from_token')
    @patch('app.api.v1.routes.schedule.get_schedule_db')
    def test_get_schedule_forbidden(self, mock_get, mock_extract, mock_verify, client):
        """Test getting schedule without ownership."""
        mock_get.return_value = {'schedule_id': 'test-123', 'requested_by': 'other@example.com'}
        mock_extract.return_value = 'user@example.com'
        mock_verify.return_value = False

        response = client.get("/api/v1/schedules/test-123")

        assert response.status_code == 403

    @patch('app.api.v1.routes.schedule.verify_schedule_ownership')
    @patch('app.api.v1.routes.schedule.extract_email_from_token')
    @patch('app.api.v1.routes.schedule.get_schedule_db')
    def test_update_schedule_forbidden(self, mock_get, mock_extract, mock_verify, client):
        """Test updating schedule without ownership."""
        mock_get.return_value = {'schedule_id': 'test-123', 'requested_by': 'other@example.com'}
        mock_extract.return_value = 'user@example.com'
        mock_verify.return_value = False

        response = client.put(
            "/api/v1/schedules/test-123",
            json={"scheduled_time": "09:00"}
        )

        assert response.status_code == 403

    @patch('app.api.v1.routes.schedule.verify_schedule_ownership')
    @patch('app.api.v1.routes.schedule.extract_email_from_token')
    @patch('app.api.v1.routes.schedule.get_schedule_db')
    def test_delete_schedule_forbidden(self, mock_get, mock_extract, mock_verify, client):
        """Test deleting schedule without ownership."""
        mock_get.return_value = {'schedule_id': 'test-123', 'requested_by': 'other@example.com'}
        mock_extract.return_value = 'user@example.com'
        mock_verify.return_value = False

        response = client.delete("/api/v1/schedules/test-123")

        assert response.status_code == 403

    @patch('app.api.v1.routes.schedule.verify_schedule_ownership')
    @patch('app.api.v1.routes.schedule.extract_email_from_token')
    @patch('app.api.v1.routes.schedule.get_schedule_db')
    def test_toggle_schedule_forbidden(self, mock_get, mock_extract, mock_verify, client):
        """Test toggling schedule without ownership."""
        mock_get.return_value = {'schedule_id': 'test-123', 'requested_by': 'other@example.com'}
        mock_extract.return_value = 'user@example.com'
        mock_verify.return_value = False

        response = client.patch("/api/v1/schedules/test-123/toggle?enabled=true")

        assert response.status_code == 403

    @patch('app.api.v1.routes.schedule.is_admin')
    @patch('app.api.v1.routes.schedule.extract_email_from_token')
    @patch('app.api.v1.routes.schedule.list_schedules_db')
    def test_list_schedules_non_admin_filters(self, mock_list, mock_extract, mock_is_admin, client):
        """Test non-admin users only see their own schedules."""
        mock_extract.return_value = 'user@example.com'
        mock_is_admin.return_value = False
        mock_list.return_value = {
            'schedules': [],
            'total': 0,
            'page': 1,
            'page_size': 20,
            'has_next': False
        }

        response = client.get("/api/v1/schedules")

        assert response.status_code == 200
        mock_list.assert_called_once_with(page=1, page_size=20, requested_by='user@example.com')

    @patch('app.api.v1.routes.schedule.extract_email_from_token')
    @patch('app.api.v1.routes.schedule.create_schedule_db')
    def test_create_schedule_sets_user_email(self, mock_create, mock_extract, client):
        """Test create schedule uses token email when no requested_by."""
        from datetime import datetime, timedelta

        future_time = (datetime.utcnow() + timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%S') + 'Z'

        mock_extract.return_value = 'token@example.com'
        mock_create.return_value = {
            'schedule_id': 'test-123',
            'requested_by': 'token@example.com',
            'scheduled_time': future_time,
            'feed_cycles': 1,
            'recurrence': 'none',
            'enabled': True,
            'timezone': 'UTC',
            'created_at': '2024-01-01T00:00:00Z',
            'updated_at': '2024-01-01T00:00:00Z'
        }

        response = client.post(
            "/api/v1/schedules",
            json={
                "requested_by": "",
                "scheduled_time": future_time
            }
        )

        assert response.status_code == 201
