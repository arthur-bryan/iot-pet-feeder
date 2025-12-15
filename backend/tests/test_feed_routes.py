"""
Tests for feed route helper functions.
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


class TestFeedHelpers:
    """Test cases for feed route helper functions."""

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

    def test_redact_email_standard(self):
        """Test email redaction for standard email."""
        from app.core.auth import redact_email
        assert redact_email('user@example.com') == 'u***@e***.com'

    def test_redact_email_short_local(self):
        """Test email redaction for short local part."""
        from app.core.auth import redact_email
        assert redact_email('u@example.com') == 'u@e***.com'

    def test_redact_email_short_domain(self):
        """Test email redaction for short domain."""
        from app.core.auth import redact_email
        assert redact_email('user@a.com') == 'u***@a.com'

    def test_redact_email_empty(self):
        """Test email redaction for empty string."""
        from app.core.auth import redact_email
        assert redact_email('') == ''

    def test_redact_email_none(self):
        """Test email redaction for None."""
        from app.core.auth import redact_email
        assert redact_email(None) is None

    def test_redact_email_no_at(self):
        """Test email redaction for string without @."""
        from app.core.auth import redact_email
        assert redact_email('not_an_email') == 'not_an_email'

    def test_redact_feed_history_admin(self):
        """Test feed history not redacted for admin."""
        from app.api.v1.routes.feed import redact_feed_history
        history = {
            'items': [
                {'requested_by': 'other@example.com'},
                {'requested_by': 'another@example.com'}
            ]
        }
        result = redact_feed_history(history, 'admin@example.com', is_admin_user=True)
        assert result['items'][0]['requested_by'] == 'other@example.com'
        assert result['items'][1]['requested_by'] == 'another@example.com'

    def test_redact_feed_history_non_admin_other_emails(self):
        """Test feed history redacts other users' emails for non-admin."""
        from app.api.v1.routes.feed import redact_feed_history
        history = {
            'items': [
                {'requested_by': 'other@example.com'},
                {'requested_by': 'user@example.com'},
                {'requested_by': 'another@example.com'}
            ]
        }
        result = redact_feed_history(history, 'user@example.com', is_admin_user=False)
        assert result['items'][0]['requested_by'] == 'o***@e***.com'
        assert result['items'][1]['requested_by'] == 'user@example.com'
        assert result['items'][2]['requested_by'] == 'a***@e***.com'

    def test_redact_feed_history_empty_items(self):
        """Test feed history with empty items list."""
        from app.api.v1.routes.feed import redact_feed_history
        history = {'items': []}
        result = redact_feed_history(history, 'user@example.com', is_admin_user=False)
        assert result['items'] == []

    def test_redact_feed_history_missing_requested_by(self):
        """Test feed history with missing requested_by field."""
        from app.api.v1.routes.feed import redact_feed_history
        history = {
            'items': [
                {'feed_id': '123'},
                {'requested_by': 'other@example.com'}
            ]
        }
        result = redact_feed_history(history, 'user@example.com', is_admin_user=False)
        assert 'requested_by' not in result['items'][0]
        assert result['items'][1]['requested_by'] == 'o***@e***.com'


class TestFeedRoutesWithRedaction:
    """Test cases for feed routes with redaction."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        from app.main import app
        return TestClient(app)

    @patch('app.api.v1.routes.feed.redact_feed_history')
    @patch('app.api.v1.routes.feed.is_admin')
    @patch('app.api.v1.routes.feed.extract_email_from_token')
    @patch('app.api.v1.routes.feed.get_feed_history')
    def test_feed_history_applies_redaction(
        self, mock_history, mock_extract, mock_is_admin, mock_redact, client
    ):
        """Test that feed history applies redaction."""
        mock_history.return_value = {
            'items': [{'requested_by': 'other@example.com'}],
            'total_items': 1,
            'page': 1,
            'limit': 10,
            'total_pages': 1
        }
        mock_extract.return_value = 'user@example.com'
        mock_is_admin.return_value = False
        mock_redact.return_value = {
            'items': [{'requested_by': 'o***@e***.com'}],
            'total_items': 1,
            'page': 1,
            'limit': 10,
            'total_pages': 1
        }

        response = client.get("/api/v1/feed-events")

        assert response.status_code == 200
        mock_redact.assert_called_once()

    @patch('app.api.v1.routes.feed.process_feed')
    def test_on_demand_error(self, mock_process, client):
        """Test on-demand feed error handling."""
        mock_process.side_effect = Exception("Feed error")

        response = client.post(
            "/api/v1/feeds",
            json={"requested_by": "test@example.com", "mode": "manual"}
        )

        assert response.status_code == 500
        assert "Feed error" in response.json()["detail"]

    @patch('app.api.v1.routes.feed.get_feed_history')
    def test_feed_history_error(self, mock_history, client):
        """Test feed history error handling."""
        mock_history.side_effect = Exception("History error")

        response = client.get("/api/v1/feed-events")

        assert response.status_code == 500
        assert "History error" in response.json()["detail"]

    @patch.dict('os.environ', {'ENVIRONMENT': 'dev'})
    @patch('app.api.v1.routes.feed.delete_all_feed_events')
    def test_delete_all_events_success(self, mock_delete, client):
        """Test delete all events success."""
        mock_delete.return_value = 5

        response = client.delete("/api/v1/feed-events")

        assert response.status_code == 200
        assert response.json()["deleted_count"] == 5

    @patch.dict('os.environ', {'ENVIRONMENT': 'dev'})
    @patch('app.api.v1.routes.feed.delete_all_feed_events')
    def test_delete_all_events_error(self, mock_delete, client):
        """Test delete all events error handling."""
        mock_delete.side_effect = Exception("Delete error")

        response = client.delete("/api/v1/feed-events")

        assert response.status_code == 500
        assert "Delete error" in response.json()["detail"]
