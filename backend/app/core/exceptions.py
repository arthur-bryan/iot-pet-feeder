"""
Custom exception classes for secure error handling.
Prevents information leakage through error messages.
"""
import logging
from typing import Any

logger = logging.getLogger(__name__)


class SecurityException(Exception):
    """Exception for security-related errors with sanitized messages."""

    def __init__(self, detail: str, internal_detail: str | None = None, status_code: int = 403):
        """
        Initialize security exception.

        Args:
            detail: Public error message (shown to client)
            internal_detail: Detailed error for logging only
            status_code: HTTP status code (default 403)
        """
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code

        if internal_detail:
            logger.error(f"Security error: {internal_detail}")


class ValidationException(Exception):
    """Exception for input validation errors."""

    def __init__(self, detail: str, field: str | None = None):
        """
        Initialize validation exception.

        Args:
            detail: Error message
            field: Field name that failed validation
        """
        super().__init__(detail)
        self.detail = detail
        self.field = field


def sanitize_error(exc: Exception, log_context: dict[str, Any] | None = None) -> str:
    """
    Sanitize exception for client response.

    Logs full error details internally, returns generic message to client.

    Args:
        exc: Exception to sanitize
        log_context: Additional context for logging

    Returns:
        Generic error message safe for client display
    """
    context_str = f" Context: {log_context}" if log_context else ""
    logger.error(f"Error occurred: {str(exc)}{context_str}", exc_info=True)

    return "An error occurred processing your request"


def sanitize_aws_error(exc: Exception) -> str:
    """
    Sanitize AWS SDK errors to prevent leaking resource details.

    Args:
        exc: AWS ClientError or other boto3 exception

    Returns:
        Generic error message
    """
    logger.error(f"AWS error: {str(exc)}", exc_info=True)

    return "An error occurred with the cloud service"
