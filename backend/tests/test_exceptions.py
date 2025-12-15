"""Tests for custom exception classes."""
import pytest
from fastapi.testclient import TestClient

from app.core.exceptions import (
    SecurityException,
    ValidationException,
    sanitize_error,
    sanitize_aws_error
)


class TestSecurityException:
    """Tests for SecurityException class."""

    def test_security_exception_basic(self):
        """Test basic SecurityException creation."""
        exc = SecurityException("Access denied")
        assert exc.detail == "Access denied"
        assert exc.status_code == 403

    def test_security_exception_with_internal_detail(self):
        """Test SecurityException with internal detail for logging."""
        exc = SecurityException(
            detail="Access denied",
            internal_detail="User attempted to access admin endpoint without admin role",
            status_code=403
        )
        assert exc.detail == "Access denied"
        assert exc.status_code == 403

    def test_security_exception_custom_status_code(self):
        """Test SecurityException with custom status code."""
        exc = SecurityException("Unauthorized", status_code=401)
        assert exc.detail == "Unauthorized"
        assert exc.status_code == 401


class TestValidationException:
    """Tests for ValidationException class."""

    def test_validation_exception_basic(self):
        """Test basic ValidationException creation."""
        exc = ValidationException("Invalid input")
        assert exc.detail == "Invalid input"
        assert exc.field is None

    def test_validation_exception_with_field(self):
        """Test ValidationException with field name."""
        exc = ValidationException("Email is required", field="email")
        assert exc.detail == "Email is required"
        assert exc.field == "email"


class TestSanitizeError:
    """Tests for sanitize_error function."""

    def test_sanitize_error_basic(self):
        """Test basic error sanitization."""
        exc = Exception("Database connection failed")
        result = sanitize_error(exc)
        assert result == "An error occurred processing your request"

    def test_sanitize_error_with_context(self):
        """Test error sanitization with logging context."""
        exc = ValueError("Invalid parameter")
        result = sanitize_error(exc, {"path": "/api/v1/feeds", "user": "test@example.com"})
        assert result == "An error occurred processing your request"


class TestSanitizeAWSError:
    """Tests for sanitize_aws_error function."""

    def test_sanitize_aws_error(self):
        """Test AWS error sanitization."""
        exc = Exception("AccessDenied: User is not authorized to perform iot:Publish")
        result = sanitize_aws_error(exc)
        assert result == "An error occurred with the cloud service"


class TestExceptionHandlers:
    """Tests for FastAPI exception handlers."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        from app.main import app
        return TestClient(app)

    @pytest.mark.asyncio
    async def test_security_exception_handler(self, client):
        """Test that SecurityException handler returns proper response."""
        from app.main import security_exception_handler
        from app.core.exceptions import SecurityException
        from unittest.mock import MagicMock

        # Create a mock request
        mock_request = MagicMock()
        mock_request.url.path = "/api/v1/test"

        # Create a SecurityException
        exc = SecurityException("Access denied", status_code=403)

        # Call the handler directly
        response = await security_exception_handler(mock_request, exc)

        # Verify the response
        assert response.status_code == 403
        assert response.body == b'{"detail":"Access denied"}'

    @pytest.mark.asyncio
    async def test_global_exception_handler(self, client):
        """Test that global exception handler sanitizes errors."""
        from app.main import global_exception_handler
        from unittest.mock import MagicMock

        # Create a mock request
        mock_request = MagicMock()
        mock_request.url.path = "/api/v1/test"

        # Create an unexpected exception
        exc = RuntimeError("Database connection failed!")

        # Call the handler directly
        response = await global_exception_handler(mock_request, exc)

        # Verify the response
        assert response.status_code == 500
        assert response.body == b'{"detail":"An error occurred processing your request"}'
