"""Tests for authentication utilities."""

from unittest.mock import MagicMock, patch

import pytest
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError

from app.core import auth


class TestGetCognitoClient:
    """Tests for _get_cognito_client."""

    def test_creates_client_on_first_call(self):
        """Should create boto3 client on first call."""
        auth._cognito_client = None
        with patch('app.core.auth.boto3.client') as mock_client:
            mock_client.return_value = MagicMock()
            client = auth._get_cognito_client()
            mock_client.assert_called_once()
            assert client is not None

    def test_reuses_existing_client(self):
        """Should reuse existing client on subsequent calls."""
        mock_client = MagicMock()
        auth._cognito_client = mock_client
        client = auth._get_cognito_client()
        assert client is mock_client
        auth._cognito_client = None


class TestExtractEmailFromToken:
    """Tests for extract_email_from_token with JWT verification."""

    def test_returns_none_for_missing_authorization(self):
        """Should return None when authorization is None."""
        assert auth.extract_email_from_token(None) is None

    def test_returns_none_for_malformed_authorization(self):
        """Should return None when authorization doesn't start with 'Bearer '."""
        assert auth.extract_email_from_token('InvalidHeader') is None

    @patch('app.core.auth.verify_jwt_token')
    def test_extracts_email_from_valid_token(self, mock_verify):
        """Should extract email from valid JWT token."""
        mock_verify.return_value = {
            'email': 'test@example.com',
            'sub': 'user-123'
        }
        result = auth.extract_email_from_token('Bearer valid.jwt.token')
        assert result == 'test@example.com'
        mock_verify.assert_called_once_with('valid.jwt.token')

    @patch('app.core.auth.verify_jwt_token')
    def test_returns_none_when_verification_returns_none(self, mock_verify):
        """Should return None when JWT verification returns None."""
        mock_verify.return_value = None
        result = auth.extract_email_from_token('Bearer invalid.jwt.token')
        assert result is None

    @patch('app.core.auth.verify_jwt_token')
    def test_raises_error_for_expired_token(self, mock_verify):
        """Should raise ExpiredSignatureError for expired token."""
        mock_verify.side_effect = ExpiredSignatureError("Token expired")
        with pytest.raises(ExpiredSignatureError):
            auth.extract_email_from_token('Bearer expired.jwt.token')

    @patch('app.core.auth.verify_jwt_token')
    def test_raises_error_for_invalid_signature(self, mock_verify):
        """Should raise InvalidTokenError for invalid signature."""
        mock_verify.side_effect = InvalidTokenError("Invalid signature")
        with pytest.raises(InvalidTokenError):
            auth.extract_email_from_token('Bearer tampered.jwt.token')


class TestIsAdmin:
    """Tests for is_admin."""

    def test_returns_false_for_none_email(self):
        """Should return False when email is None."""
        assert auth.is_admin(None) is False

    def test_returns_false_for_empty_email(self):
        """Should return False when email is empty string."""
        assert auth.is_admin('') is False
