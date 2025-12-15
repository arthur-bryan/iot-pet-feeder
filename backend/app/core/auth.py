"""Shared authentication utilities."""

import base64
import json
import logging
import os

import boto3
from botocore.exceptions import ClientError
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError, InvalidSignatureError

from app.core.jwt_verifier import verify_jwt_token

logger = logging.getLogger(__name__)

ENVIRONMENT = os.environ.get('ENVIRONMENT', 'prd').lower()
USER_POOL_ID = os.environ.get('COGNITO_USER_POOL_ID')

_cognito_client = None


def _get_cognito_client():
    """Lazy-load Cognito client for Lambda cold start optimization."""
    global _cognito_client
    if _cognito_client is None:
        _cognito_client = boto3.client('cognito-idp', region_name=os.environ.get('AWS_REGION', 'us-east-2'))
    return _cognito_client


def extract_email_from_token(authorization: str | None) -> str | None:
    """Extract email from JWT token with signature verification.

    Args:
        authorization: Authorization header value (e.g., 'Bearer <token>')

    Returns:
        Email address if token is valid, None otherwise

    Raises:
        InvalidTokenError: If token format is invalid
        ExpiredSignatureError: If token has expired
        InvalidSignatureError: If signature verification fails
    """
    if not authorization or not authorization.startswith('Bearer '):
        return None

    token = authorization.replace('Bearer ', '')

    # Verify JWT signature and extract email
    try:
        payload = verify_jwt_token(token)
        if payload:
            return payload.get('email')
        return None
    except (InvalidTokenError, ExpiredSignatureError, InvalidSignatureError) as e:
        logger.warning(f"JWT verification failed: {str(e)}")
        raise


def is_admin(email: str | None) -> bool:
    """Check if user is in admin group."""
    if not email:
        return False
    if ENVIRONMENT == 'demo' or not USER_POOL_ID:
        return True
    try:
        response = _get_cognito_client().admin_list_groups_for_user(
            Username=email,
            UserPoolId=USER_POOL_ID
        )
        groups = [group['GroupName'] for group in response.get('Groups', [])]
        return 'admin' in groups
    except ClientError as e:
        logger.warning("Failed to check admin status for %s: %s", email, e.response['Error']['Message'])
        return False


def redact_email(email: str) -> str:
    """Redact email address for privacy (e.g., user@example.com -> u***@e***.com)."""
    if not email or '@' not in email:
        return email
    local, domain = email.split('@', 1)
    domain_parts = domain.rsplit('.', 1)
    redacted_local = local[0] + '***' if len(local) > 1 else local
    redacted_domain = domain_parts[0][0] + '***' if len(domain_parts[0]) > 1 else domain_parts[0]
    tld = '.' + domain_parts[1] if len(domain_parts) > 1 else ''
    return f"{redacted_local}@{redacted_domain}{tld}"
