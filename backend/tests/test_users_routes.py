"""
Tests for users API routes.
"""
import base64
import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


def create_mock_jwt(email: str) -> str:
    """Create a mock JWT token for testing."""
    header = base64.urlsafe_b64encode(b'{"alg":"RS256","typ":"JWT"}').decode().rstrip('=')
    payload_data = {"email": email, "sub": "test-sub"}
    payload = base64.urlsafe_b64encode(json.dumps(payload_data).encode()).decode().rstrip('=')
    signature = base64.urlsafe_b64encode(b'signature').decode().rstrip('=')
    return f"Bearer {header}.{payload}.{signature}"


class TestUsersRoutes:
    """Test cases for users API routes."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        from app.main import app
        return TestClient(app)

    def test_generate_temp_password(self):
        """Test temporary password generation."""
        from app.api.v1.routes.users import generate_temp_password
        password = generate_temp_password(12)

        assert len(password) == 12
        assert any(c.islower() for c in password)
        assert any(c.isupper() for c in password)
        assert any(c.isdigit() for c in password)

    def test_generate_temp_password_retry(self):
        """Test password generation retries when requirements not met."""
        import secrets

        from app.api.v1.routes.users import generate_temp_password

        original_choice = secrets.choice
        call_count = [0]

        def mock_choice(alphabet):
            call_count[0] += 1
            if call_count[0] <= 12:
                return 'a'
            elif call_count[0] <= 24:
                return 'A' if call_count[0] % 3 == 0 else ('1' if call_count[0] % 3 == 1 else 'b')
            return original_choice(alphabet)

        secrets.choice = mock_choice
        try:
            password = generate_temp_password(12)
            assert len(password) == 12
        finally:
            secrets.choice = original_choice

    def test_extract_email_from_token_valid(self):
        """Test extracting email from valid JWT."""
        from app.api.v1.routes.users import extract_email_from_token
        token = create_mock_jwt("test@example.com")
        email = extract_email_from_token(token)

        assert email == "test@example.com"

    def test_extract_email_from_token_no_bearer(self):
        """Test extracting email without Bearer prefix."""
        from app.api.v1.routes.users import extract_email_from_token
        email = extract_email_from_token("invalid-token")

        assert email is None

    def test_extract_email_from_token_none(self):
        """Test extracting email with None token."""
        from app.api.v1.routes.users import extract_email_from_token
        email = extract_email_from_token(None)

        assert email is None

    def test_extract_email_from_token_invalid_format(self):
        """Test extracting email from invalid JWT format."""
        from app.api.v1.routes.users import extract_email_from_token
        email = extract_email_from_token("Bearer invalid.token")

        assert email is None

    def test_extract_email_from_token_no_email(self):
        """Test extracting email when token has no email claim."""
        from app.api.v1.routes.users import extract_email_from_token
        header = base64.urlsafe_b64encode(b'{"alg":"RS256"}').decode().rstrip('=')
        payload = base64.urlsafe_b64encode(b'{"sub":"test"}').decode().rstrip('=')
        signature = base64.urlsafe_b64encode(b'sig').decode().rstrip('=')
        token = f"Bearer {header}.{payload}.{signature}"

        email = extract_email_from_token(token)
        assert email is None

    def test_extract_email_from_token_decode_error(self):
        """Test extracting email when base64 decode fails."""
        from app.api.v1.routes.users import extract_email_from_token
        token = "Bearer header.!!!invalid_base64!!!.signature"

        email = extract_email_from_token(token)
        assert email is None

    @patch('app.api.v1.routes.users.cognito')
    def test_is_admin_true(self, mock_cognito):
        """Test is_admin returns True for admin user."""
        mock_cognito.admin_list_groups_for_user.return_value = {
            'Groups': [{'GroupName': 'admin'}]
        }

        from app.api.v1.routes.users import is_admin
        result = is_admin("admin@example.com")

        assert result is True

    @patch('app.api.v1.routes.users.cognito')
    def test_is_admin_false(self, mock_cognito):
        """Test is_admin returns False for non-admin user."""
        mock_cognito.admin_list_groups_for_user.return_value = {
            'Groups': [{'GroupName': 'users'}]
        }

        from app.api.v1.routes.users import is_admin
        result = is_admin("user@example.com")

        assert result is False

    @patch('app.api.v1.routes.users.cognito')
    def test_is_admin_error(self, mock_cognito):
        """Test is_admin returns False on error."""
        mock_cognito.admin_list_groups_for_user.side_effect = Exception("Error")

        from app.api.v1.routes.users import is_admin
        result = is_admin("user@example.com")

        assert result is False

    @patch('app.api.v1.routes.users.PENDING_USERS_TABLE', None)
    def test_request_access_no_table(self, client):
        """Test request_access when table not configured."""
        response = client.post(
            "/api/v1/users/request-access",
            json={
                "email": "test@example.com",
                "full_name": "Test User"
            }
        )

        assert response.status_code == 500

    def test_request_access_user_exists(self, client):
        """Test request_access when user already exists."""
        class MockUserNotFoundError(Exception):
            pass

        with patch('app.api.v1.routes.users.PENDING_USERS_TABLE', 'test-table'), \
             patch('app.api.v1.routes.users.USER_POOL_ID', 'test-pool'), \
             patch('app.api.v1.routes.users.dynamodb'), \
             patch('app.api.v1.routes.users.cognito') as mock_cognito:

            mock_cognito.exceptions = MagicMock()
            mock_cognito.exceptions.UserNotFoundException = MockUserNotFoundError
            mock_cognito.admin_get_user.return_value = {'Username': 'existing@example.com'}

            response = client.post(
                "/api/v1/users/request-access",
                json={
                    "email": "existing@example.com",
                    "full_name": "Existing User"
                }
            )

            assert response.status_code == 400
            assert "already exists" in response.json()['detail']

    def test_request_access_pending_exists(self, client):
        """Test request_access when pending request exists."""
        class MockUserNotFoundError(Exception):
            pass

        with patch('app.api.v1.routes.users.PENDING_USERS_TABLE', 'test-table'), \
             patch('app.api.v1.routes.users.USER_POOL_ID', 'test-pool'), \
             patch('app.api.v1.routes.users.dynamodb') as mock_dynamodb, \
             patch('app.api.v1.routes.users.cognito') as mock_cognito:

            mock_cognito.exceptions = MagicMock()
            mock_cognito.exceptions.UserNotFoundException = MockUserNotFoundError
            mock_cognito.admin_get_user.side_effect = MockUserNotFoundError("User not found")

            mock_table = MagicMock()
            mock_table.scan.return_value = {'Items': [{'email': 'test@example.com'}]}
            mock_dynamodb.Table.return_value = mock_table

            response = client.post(
                "/api/v1/users/request-access",
                json={
                    "email": "test@example.com",
                    "full_name": "Test User"
                }
            )

            assert response.status_code == 400
            assert "already pending" in response.json()['detail']

    def test_request_access_success(self, client):
        """Test successful access request."""
        class MockUserNotFoundError(Exception):
            pass

        with patch('app.api.v1.routes.users.PENDING_USERS_TABLE', 'test-table'), \
             patch('app.api.v1.routes.users.USER_POOL_ID', 'test-pool'), \
             patch('app.api.v1.routes.users.dynamodb') as mock_dynamodb, \
             patch('app.api.v1.routes.users.cognito') as mock_cognito:

            mock_cognito.exceptions = MagicMock()
            mock_cognito.exceptions.UserNotFoundException = MockUserNotFoundError
            mock_cognito.admin_get_user.side_effect = MockUserNotFoundError("User not found")

            mock_table = MagicMock()
            mock_table.scan.return_value = {'Items': []}
            mock_table.put_item.return_value = {}
            mock_dynamodb.Table.return_value = mock_table

            response = client.post(
                "/api/v1/users/request-access",
                json={
                    "email": "new@example.com",
                    "full_name": "New User",
                    "reason": "Testing"
                }
            )

            assert response.status_code == 200
            assert 'request_id' in response.json()

    @patch('app.api.v1.routes.users.is_admin', return_value=False)
    @patch('app.api.v1.routes.users.extract_email_from_token', return_value="user@example.com")
    def test_list_pending_not_admin(self, mock_extract, mock_admin, client):
        """Test list pending requires admin."""
        response = client.get(
            "/api/v1/users/pending",
            headers={"Authorization": create_mock_jwt("user@example.com")}
        )

        assert response.status_code == 403

    @patch('app.api.v1.routes.users.PENDING_USERS_TABLE', 'test-table')
    @patch('app.api.v1.routes.users.is_admin', return_value=True)
    @patch('app.api.v1.routes.users.extract_email_from_token', return_value="admin@example.com")
    @patch('app.api.v1.routes.users.dynamodb')
    def test_list_pending_success(self, mock_dynamodb, mock_extract, mock_admin, client):
        """Test successful pending list."""
        mock_table = MagicMock()
        mock_table.scan.return_value = {'Items': [{'request_id': '123'}]}
        mock_dynamodb.Table.return_value = mock_table

        response = client.get(
            "/api/v1/users/pending",
            headers={"Authorization": create_mock_jwt("admin@example.com")}
        )

        assert response.status_code == 200
        assert 'requests' in response.json()

    @patch('app.api.v1.routes.users.PENDING_USERS_TABLE', 'test-table')
    @patch('app.api.v1.routes.users.is_admin', return_value=True)
    @patch('app.api.v1.routes.users.extract_email_from_token', return_value="admin@example.com")
    @patch('app.api.v1.routes.users.dynamodb')
    def test_approve_user_not_found(self, mock_dynamodb, mock_extract, mock_admin, client):
        """Test approve non-existent request."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}
        mock_dynamodb.Table.return_value = mock_table

        response = client.post(
            "/api/v1/users/approve/nonexistent",
            headers={"Authorization": create_mock_jwt("admin@example.com")}
        )

        assert response.status_code == 404

    @patch('app.api.v1.routes.users.PENDING_USERS_TABLE', 'test-table')
    @patch('app.api.v1.routes.users.is_admin', return_value=True)
    @patch('app.api.v1.routes.users.extract_email_from_token', return_value="admin@example.com")
    @patch('app.api.v1.routes.users.dynamodb')
    def test_approve_user_already_processed(self, mock_dynamodb, mock_extract, mock_admin, client):
        """Test approve already processed request."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {'Item': {'status': 'approved'}}
        mock_dynamodb.Table.return_value = mock_table

        response = client.post(
            "/api/v1/users/approve/test-123",
            headers={"Authorization": create_mock_jwt("admin@example.com")}
        )

        assert response.status_code == 400

    @patch('app.api.v1.routes.users.PENDING_USERS_TABLE', 'test-table')
    @patch('app.api.v1.routes.users.USER_POOL_ID', 'test-pool')
    @patch('app.api.v1.routes.users.is_admin', return_value=True)
    @patch('app.api.v1.routes.users.extract_email_from_token', return_value="admin@example.com")
    @patch('app.api.v1.routes.users.dynamodb')
    @patch('app.api.v1.routes.users.cognito')
    def test_approve_user_success(self, mock_cognito, mock_dynamodb, mock_extract, mock_admin, client):
        """Test successful user approval."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            'Item': {'status': 'pending', 'email': 'new@example.com'}
        }
        mock_dynamodb.Table.return_value = mock_table
        mock_cognito.admin_create_user.return_value = {}

        response = client.post(
            "/api/v1/users/approve/test-123",
            headers={"Authorization": create_mock_jwt("admin@example.com")},
            json={"temporary_password": "TempPass123!"}
        )

        assert response.status_code == 200
        assert 'email' in response.json()

    @patch('app.api.v1.routes.users.PENDING_USERS_TABLE', 'test-table')
    @patch('app.api.v1.routes.users.is_admin', return_value=True)
    @patch('app.api.v1.routes.users.extract_email_from_token', return_value="admin@example.com")
    @patch('app.api.v1.routes.users.dynamodb')
    def test_reject_user_success(self, mock_dynamodb, mock_extract, mock_admin, client):
        """Test successful user rejection."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            'Item': {'status': 'pending', 'email': 'reject@example.com'}
        }
        mock_dynamodb.Table.return_value = mock_table

        response = client.post(
            "/api/v1/users/reject/test-123",
            headers={"Authorization": create_mock_jwt("admin@example.com")}
        )

        assert response.status_code == 200

    @patch('app.api.v1.routes.users.USER_POOL_ID', 'test-pool')
    @patch('app.api.v1.routes.users.is_admin', return_value=True)
    @patch('app.api.v1.routes.users.extract_email_from_token', return_value="admin@example.com")
    def test_delete_user_self_deletion(self, mock_extract, mock_admin, client):
        """Test cannot delete own account."""
        response = client.delete(
            "/api/v1/users/admin@example.com",
            headers={"Authorization": create_mock_jwt("admin@example.com")}
        )

        assert response.status_code == 400
        assert "Cannot delete your own" in response.json()['detail']

    @patch('app.api.v1.routes.users.USER_POOL_ID', 'test-pool')
    @patch('app.api.v1.routes.users.is_admin', return_value=True)
    @patch('app.api.v1.routes.users.extract_email_from_token', return_value="admin@example.com")
    @patch('app.api.v1.routes.users.cognito')
    def test_delete_user_success(self, mock_cognito, mock_extract, mock_admin, client):
        """Test successful user deletion with full cleanup."""
        with patch('app.api.v1.routes.users.SNS_TOPIC_ARN', 'arn:aws:sns:us-east-1:123456789:test-topic'), \
             patch('app.api.v1.routes.users.PENDING_USERS_TABLE', 'pending-users'), \
             patch('app.api.v1.routes.users.sns_client') as mock_sns, \
             patch('app.api.v1.routes.users.dynamodb') as mock_dynamodb:

            mock_cognito.admin_delete_user.return_value = {}

            # Mock SNS subscription cleanup
            mock_sns.list_subscriptions_by_topic.return_value = {
                'Subscriptions': [
                    {'Endpoint': 'user@example.com', 'SubscriptionArn': 'arn:aws:sns:us-east-1:123456789:subscription1'}
                ]
            }

            # Mock DynamoDB pending requests cleanup
            mock_table = MagicMock()
            mock_table.scan.return_value = {
                'Items': [{'request_id': 'req-123', 'email': 'user@example.com'}]
            }
            mock_dynamodb.Table.return_value = mock_table

            response = client.delete(
                "/api/v1/users/user@example.com",
                headers={"Authorization": create_mock_jwt("admin@example.com")}
            )

            assert response.status_code == 200
            data = response.json()
            assert data['deleted']['cognito'] is True
            assert len(data['deleted']['sns_subscriptions']) == 1
            assert len(data['deleted']['pending_requests']) == 1

            # Verify SNS unsubscribe was called
            mock_sns.unsubscribe.assert_called_once_with(
                SubscriptionArn='arn:aws:sns:us-east-1:123456789:subscription1'
            )

            # Verify DynamoDB delete was called
            mock_table.delete_item.assert_called_once_with(Key={'request_id': 'req-123'})

    def test_delete_user_not_found(self, client):
        """Test delete non-existent user - still performs cleanup."""
        class MockUserNotFoundError(Exception):
            pass

        with patch('app.api.v1.routes.users.USER_POOL_ID', 'test-pool'), \
             patch('app.api.v1.routes.users.SNS_TOPIC_ARN', 'arn:aws:sns:us-east-1:123456789:test-topic'), \
             patch('app.api.v1.routes.users.PENDING_USERS_TABLE', 'pending-users'), \
             patch('app.api.v1.routes.users.is_admin', return_value=True), \
             patch('app.api.v1.routes.users.extract_email_from_token', return_value="admin@example.com"), \
             patch('app.api.v1.routes.users.cognito') as mock_cognito, \
             patch('app.api.v1.routes.users.sns_client') as mock_sns, \
             patch('app.api.v1.routes.users.dynamodb') as mock_dynamodb:

            mock_cognito.exceptions = MagicMock()
            mock_cognito.exceptions.UserNotFoundException = MockUserNotFoundError
            mock_cognito.admin_delete_user.side_effect = MockUserNotFoundError("User not found")

            # Mock SNS response - no subscriptions
            mock_sns.list_subscriptions_by_topic.return_value = {'Subscriptions': []}

            # Mock DynamoDB response - no pending requests
            mock_table = MagicMock()
            mock_table.scan.return_value = {'Items': []}
            mock_dynamodb.Table.return_value = mock_table

            response = client.delete(
                "/api/v1/users/nonexistent@example.com",
                headers={"Authorization": create_mock_jwt("admin@example.com")}
            )

            # Should succeed (200) even if Cognito user doesn't exist - cleanup continues
            assert response.status_code == 200
            data = response.json()
            assert data['deleted']['cognito'] is False  # Cognito deletion failed
            assert len(data['deleted']['sns_subscriptions']) == 0
            assert len(data['deleted']['pending_requests']) == 0

    @patch('app.api.v1.routes.users.USER_POOL_ID', 'test-pool')
    @patch('app.api.v1.routes.users.is_admin', return_value=True)
    @patch('app.api.v1.routes.users.extract_email_from_token', return_value="admin@example.com")
    @patch('app.api.v1.routes.users.cognito')
    def test_list_users_success(self, mock_cognito, mock_extract, mock_admin, client):
        """Test successful user list."""
        from datetime import datetime
        mock_paginator = MagicMock()
        mock_paginator.paginate.return_value = [
            {
                'Users': [
                    {
                        'Username': 'user1',
                        'UserStatus': 'CONFIRMED',
                        'Enabled': True,
                        'UserCreateDate': datetime.now(),
                        'UserLastModifiedDate': datetime.now(),
                        'Attributes': [{'Name': 'email', 'Value': 'user1@example.com'}]
                    }
                ]
            }
        ]
        mock_cognito.get_paginator.return_value = mock_paginator
        mock_cognito.admin_list_groups_for_user.return_value = {'Groups': []}

        response = client.get(
            "/api/v1/users",
            headers={"Authorization": create_mock_jwt("admin@example.com")}
        )

        assert response.status_code == 200
        assert 'users' in response.json()

    def test_request_access_generic_error(self, client):
        """Test request_access generic exception handling."""
        class MockUserNotFoundError(Exception):
            pass

        with patch('app.api.v1.routes.users.PENDING_USERS_TABLE', 'test-table'), \
             patch('app.api.v1.routes.users.USER_POOL_ID', 'test-pool'), \
             patch('app.api.v1.routes.users.dynamodb') as mock_dynamodb, \
             patch('app.api.v1.routes.users.cognito') as mock_cognito:

            mock_cognito.exceptions = MagicMock()
            mock_cognito.exceptions.UserNotFoundException = MockUserNotFoundError
            mock_cognito.admin_get_user.side_effect = MockUserNotFoundError("Not found")

            mock_table = MagicMock()
            mock_table.scan.return_value = {'Items': []}
            mock_table.put_item.side_effect = Exception("Database error")
            mock_dynamodb.Table.return_value = mock_table

            response = client.post(
                "/api/v1/users/request-access",
                json={
                    "email": "test@example.com",
                    "full_name": "Test User"
                }
            )

            assert response.status_code == 500

    def test_list_pending_generic_error(self, client):
        """Test list_pending generic exception handling."""
        with patch('app.api.v1.routes.users.PENDING_USERS_TABLE', 'test-table'), \
             patch('app.api.v1.routes.users.is_admin', return_value=True), \
             patch('app.api.v1.routes.users.extract_email_from_token', return_value="admin@example.com"), \
             patch('app.api.v1.routes.users.dynamodb') as mock_dynamodb:

            mock_table = MagicMock()
            mock_table.scan.side_effect = Exception("Database error")
            mock_dynamodb.Table.return_value = mock_table

            response = client.get(
                "/api/v1/users/pending",
                headers={"Authorization": create_mock_jwt("admin@example.com")}
            )

            assert response.status_code == 500

    def test_approve_user_not_admin(self, client):
        """Test approve_user when not admin."""
        with patch('app.api.v1.routes.users.is_admin', return_value=False), \
             patch('app.api.v1.routes.users.extract_email_from_token', return_value="user@example.com"):

            response = client.post(
                "/api/v1/users/approve/test-123",
                headers={"Authorization": create_mock_jwt("user@example.com")}
            )

            assert response.status_code == 403

    def test_approve_user_cognito_error(self, client):
        """Test approve_user when Cognito user exists."""
        class MockUsernameExistsError(Exception):
            pass

        with patch('app.api.v1.routes.users.PENDING_USERS_TABLE', 'test-table'), \
             patch('app.api.v1.routes.users.USER_POOL_ID', 'test-pool'), \
             patch('app.api.v1.routes.users.is_admin', return_value=True), \
             patch('app.api.v1.routes.users.extract_email_from_token', return_value="admin@example.com"), \
             patch('app.api.v1.routes.users.dynamodb') as mock_dynamodb, \
             patch('app.api.v1.routes.users.cognito') as mock_cognito:

            mock_table = MagicMock()
            mock_table.get_item.return_value = {
                'Item': {'status': 'pending', 'email': 'existing@example.com'}
            }
            mock_dynamodb.Table.return_value = mock_table

            mock_cognito.exceptions = MagicMock()
            mock_cognito.exceptions.UsernameExistsException = MockUsernameExistsError
            mock_cognito.admin_create_user.side_effect = MockUsernameExistsError("User exists")

            response = client.post(
                "/api/v1/users/approve/test-123",
                headers={"Authorization": create_mock_jwt("admin@example.com")},
                json={"temporary_password": "TempPass123!"}
            )

            assert response.status_code == 400
            assert "already exists" in response.json()['detail']

    def test_approve_user_generic_error(self, client):
        """Test approve_user generic exception handling."""
        class MockUsernameExistsError(Exception):
            pass

        with patch('app.api.v1.routes.users.PENDING_USERS_TABLE', 'test-table'), \
             patch('app.api.v1.routes.users.USER_POOL_ID', 'test-pool'), \
             patch('app.api.v1.routes.users.is_admin', return_value=True), \
             patch('app.api.v1.routes.users.extract_email_from_token', return_value="admin@example.com"), \
             patch('app.api.v1.routes.users.dynamodb') as mock_dynamodb, \
             patch('app.api.v1.routes.users.cognito') as mock_cognito:

            mock_table = MagicMock()
            mock_table.get_item.return_value = {
                'Item': {'status': 'pending', 'email': 'test@example.com'}
            }
            mock_dynamodb.Table.return_value = mock_table

            mock_cognito.exceptions = MagicMock()
            mock_cognito.exceptions.UsernameExistsException = MockUsernameExistsError
            mock_cognito.admin_create_user.side_effect = RuntimeError("Unknown error")

            response = client.post(
                "/api/v1/users/approve/test-123",
                headers={"Authorization": create_mock_jwt("admin@example.com")},
                json={"temporary_password": "TempPass123!"}
            )

            assert response.status_code == 500

    def test_reject_user_not_admin(self, client):
        """Test reject_user when not admin."""
        with patch('app.api.v1.routes.users.is_admin', return_value=False), \
             patch('app.api.v1.routes.users.extract_email_from_token', return_value="user@example.com"):

            response = client.post(
                "/api/v1/users/reject/test-123",
                headers={"Authorization": create_mock_jwt("user@example.com")}
            )

            assert response.status_code == 403

    def test_reject_user_not_found(self, client):
        """Test reject_user when request not found."""
        with patch('app.api.v1.routes.users.PENDING_USERS_TABLE', 'test-table'), \
             patch('app.api.v1.routes.users.is_admin', return_value=True), \
             patch('app.api.v1.routes.users.extract_email_from_token', return_value="admin@example.com"), \
             patch('app.api.v1.routes.users.dynamodb') as mock_dynamodb:

            mock_table = MagicMock()
            mock_table.get_item.return_value = {}
            mock_dynamodb.Table.return_value = mock_table

            response = client.post(
                "/api/v1/users/reject/nonexistent",
                headers={"Authorization": create_mock_jwt("admin@example.com")}
            )

            assert response.status_code == 404

    def test_reject_user_already_processed(self, client):
        """Test reject_user when request already processed."""
        with patch('app.api.v1.routes.users.PENDING_USERS_TABLE', 'test-table'), \
             patch('app.api.v1.routes.users.is_admin', return_value=True), \
             patch('app.api.v1.routes.users.extract_email_from_token', return_value="admin@example.com"), \
             patch('app.api.v1.routes.users.dynamodb') as mock_dynamodb:

            mock_table = MagicMock()
            mock_table.get_item.return_value = {'Item': {'status': 'approved'}}
            mock_dynamodb.Table.return_value = mock_table

            response = client.post(
                "/api/v1/users/reject/test-123",
                headers={"Authorization": create_mock_jwt("admin@example.com")}
            )

            assert response.status_code == 400

    def test_reject_user_generic_error(self, client):
        """Test reject_user generic exception handling."""
        with patch('app.api.v1.routes.users.PENDING_USERS_TABLE', 'test-table'), \
             patch('app.api.v1.routes.users.is_admin', return_value=True), \
             patch('app.api.v1.routes.users.extract_email_from_token', return_value="admin@example.com"), \
             patch('app.api.v1.routes.users.dynamodb') as mock_dynamodb:

            mock_table = MagicMock()
            mock_table.get_item.return_value = {'Item': {'status': 'pending', 'email': 'test@example.com'}}
            mock_table.update_item.side_effect = Exception("Database error")
            mock_dynamodb.Table.return_value = mock_table

            response = client.post(
                "/api/v1/users/reject/test-123",
                headers={"Authorization": create_mock_jwt("admin@example.com")}
            )

            assert response.status_code == 500

    def test_delete_user_not_admin(self, client):
        """Test delete_user when not admin."""
        with patch('app.api.v1.routes.users.is_admin', return_value=False), \
             patch('app.api.v1.routes.users.extract_email_from_token', return_value="user@example.com"):

            response = client.delete(
                "/api/v1/users/target@example.com",
                headers={"Authorization": create_mock_jwt("user@example.com")}
            )

            assert response.status_code == 403

    def test_delete_user_generic_error(self, client):
        """Test delete_user generic exception handling."""
        class MockUserNotFoundError(Exception):
            pass

        with patch('app.api.v1.routes.users.USER_POOL_ID', 'test-pool'), \
             patch('app.api.v1.routes.users.is_admin', return_value=True), \
             patch('app.api.v1.routes.users.extract_email_from_token', return_value="admin@example.com"), \
             patch('app.api.v1.routes.users.cognito') as mock_cognito:

            mock_cognito.exceptions = MagicMock()
            mock_cognito.exceptions.UserNotFoundException = MockUserNotFoundError
            mock_cognito.admin_delete_user.side_effect = RuntimeError("Unknown error")

            response = client.delete(
                "/api/v1/users/target@example.com",
                headers={"Authorization": create_mock_jwt("admin@example.com")}
            )

            assert response.status_code == 500

    def test_list_users_not_admin(self, client):
        """Test list_users when not admin."""
        with patch('app.api.v1.routes.users.is_admin', return_value=False), \
             patch('app.api.v1.routes.users.extract_email_from_token', return_value="user@example.com"):

            response = client.get(
                "/api/v1/users",
                headers={"Authorization": create_mock_jwt("user@example.com")}
            )

            assert response.status_code == 403

    @patch('app.api.v1.routes.users.USER_POOL_ID', 'test-pool')
    @patch('app.api.v1.routes.users.is_admin', return_value=True)
    @patch('app.api.v1.routes.users.extract_email_from_token', return_value="admin@example.com")
    @patch('app.api.v1.routes.users.cognito')
    def test_list_users_group_lookup_error(self, mock_cognito, mock_extract, mock_admin, client):
        """Test list_users when group lookup fails."""
        from datetime import datetime
        mock_paginator = MagicMock()
        mock_paginator.paginate.return_value = [
            {
                'Users': [
                    {
                        'Username': 'user1',
                        'UserStatus': 'CONFIRMED',
                        'Enabled': True,
                        'UserCreateDate': datetime.now(),
                        'UserLastModifiedDate': datetime.now(),
                        'Attributes': [{'Name': 'email', 'Value': 'user1@example.com'}]
                    }
                ]
            }
        ]
        mock_cognito.get_paginator.return_value = mock_paginator
        mock_cognito.admin_list_groups_for_user.side_effect = Exception("Group lookup error")

        response = client.get(
            "/api/v1/users",
            headers={"Authorization": create_mock_jwt("admin@example.com")}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['users'][0]['Groups'] == []

    def test_list_users_generic_error(self, client):
        """Test list_users generic exception handling."""
        with patch('app.api.v1.routes.users.USER_POOL_ID', 'test-pool'), \
             patch('app.api.v1.routes.users.is_admin', return_value=True), \
             patch('app.api.v1.routes.users.extract_email_from_token', return_value="admin@example.com"), \
             patch('app.api.v1.routes.users.cognito') as mock_cognito:

            mock_cognito.get_paginator.side_effect = Exception("Cognito error")

            response = client.get(
                "/api/v1/users",
                headers={"Authorization": create_mock_jwt("admin@example.com")}
            )

            assert response.status_code == 500

    def test_list_users_no_email_attribute(self, client):
        """Test list users when user has no email attribute."""
        from datetime import datetime

        with patch('app.api.v1.routes.users.USER_POOL_ID', 'test-pool'), \
             patch('app.api.v1.routes.users.is_admin', return_value=True), \
             patch('app.api.v1.routes.users.extract_email_from_token', return_value="admin@example.com"), \
             patch('app.api.v1.routes.users.cognito') as mock_cognito:

            mock_paginator = MagicMock()
            mock_paginator.paginate.return_value = [
                {
                    'Users': [
                        {
                            'Username': 'user-no-email',
                            'UserStatus': 'CONFIRMED',
                            'Enabled': True,
                            'UserCreateDate': datetime.now(),
                            'UserLastModifiedDate': datetime.now(),
                            'Attributes': [{'Name': 'sub', 'Value': 'some-sub-id'}]
                        }
                    ]
                }
            ]
            mock_cognito.get_paginator.return_value = mock_paginator
            mock_cognito.admin_list_groups_for_user.return_value = {'Groups': []}

            response = client.get(
                "/api/v1/users",
                headers={"Authorization": create_mock_jwt("admin@example.com")}
            )

            assert response.status_code == 200
            data = response.json()
            assert 'users' in data

    @patch('app.api.v1.routes.users.extract_email_from_token', return_value='admin@example.com')
    @patch('app.api.v1.routes.users.is_admin', return_value=True)
    @patch('app.api.v1.routes.users.cognito')
    def test_delete_user_sns_error(self, mock_cognito, mock_admin, mock_extract, client):
        """Test user deletion when SNS cleanup fails."""
        with patch('app.api.v1.routes.users.SNS_TOPIC_ARN', 'arn:aws:sns:us-east-1:123456789:test-topic'), \
             patch('app.api.v1.routes.users.PENDING_USERS_TABLE', 'pending-users'), \
             patch('app.api.v1.routes.users.sns_client') as mock_sns, \
             patch('app.api.v1.routes.users.dynamodb') as mock_dynamodb:

            mock_cognito.admin_delete_user.return_value = {}

            # Make SNS raise an exception
            mock_sns.list_subscriptions_by_topic.side_effect = Exception("SNS error")

            # Mock DynamoDB pending requests cleanup
            mock_table = MagicMock()
            mock_table.scan.return_value = {'Items': []}
            mock_dynamodb.Table.return_value = mock_table

            response = client.delete(
                "/api/v1/users/user@example.com",
                headers={"Authorization": create_mock_jwt("admin@example.com")}
            )

            # Should still succeed even if SNS cleanup fails
            assert response.status_code == 200

    @patch('app.api.v1.routes.users.extract_email_from_token', return_value='admin@example.com')
    @patch('app.api.v1.routes.users.is_admin', return_value=True)
    @patch('app.api.v1.routes.users.cognito')
    def test_delete_user_dynamodb_error(self, mock_cognito, mock_admin, mock_extract, client):
        """Test user deletion when DynamoDB cleanup fails."""
        with patch('app.api.v1.routes.users.SNS_TOPIC_ARN', 'arn:aws:sns:us-east-1:123456789:test-topic'), \
             patch('app.api.v1.routes.users.PENDING_USERS_TABLE', 'pending-users'), \
             patch('app.api.v1.routes.users.sns_client') as mock_sns, \
             patch('app.api.v1.routes.users.dynamodb') as mock_dynamodb:

            mock_cognito.admin_delete_user.return_value = {}

            # Mock SNS subscription cleanup
            mock_sns.list_subscriptions_by_topic.return_value = {'Subscriptions': []}

            # Make DynamoDB raise an exception
            mock_table = MagicMock()
            mock_table.scan.side_effect = Exception("DynamoDB error")
            mock_dynamodb.Table.return_value = mock_table

            response = client.delete(
                "/api/v1/users/user@example.com",
                headers={"Authorization": create_mock_jwt("admin@example.com")}
            )

            # Should still succeed even if DynamoDB cleanup fails
            assert response.status_code == 200
