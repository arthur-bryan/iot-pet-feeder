"""JWT signature verification using Cognito public keys."""

import json
import logging
import os
import time
from typing import Dict, Optional
from urllib.request import urlopen

import jwt
from jwt.exceptions import (
    DecodeError,
    ExpiredSignatureError,
    InvalidAlgorithmError,
    InvalidAudienceError,
    InvalidIssuerError,
    InvalidKeyError,
    InvalidSignatureError,
    InvalidTokenError,
)

logger = logging.getLogger(__name__)

_jwks_cache: Optional[Dict] = None
_jwks_cache_timestamp: float = 0
JWKS_CACHE_TTL = 3600  # 1 hour


def _get_jwks() -> Dict:
    """Fetch JWKS from Cognito with caching."""
    global _jwks_cache, _jwks_cache_timestamp

    current_time = time.time()
    if _jwks_cache and (current_time - _jwks_cache_timestamp) < JWKS_CACHE_TTL:
        return _jwks_cache

    cognito_region = os.environ.get('AWS_REGION', 'us-east-2')
    cognito_user_pool_id = os.environ.get('COGNITO_USER_POOL_ID')

    jwks_url = f'https://cognito-idp.{cognito_region}.amazonaws.com/{cognito_user_pool_id}/.well-known/jwks.json'
    try:
        with urlopen(jwks_url, timeout=5) as response:
            _jwks_cache = json.loads(response.read())
            _jwks_cache_timestamp = current_time
            logger.info("JWKS fetched and cached successfully")
            return _jwks_cache
    except Exception as e:
        logger.error(f"Failed to fetch JWKS: {str(e)}")
        if _jwks_cache:
            logger.warning("Using stale JWKS cache due to fetch failure")
            return _jwks_cache
        raise


def _get_public_key(token: str):
    """Extract public key from JWKS based on token's kid."""
    try:
        headers = jwt.get_unverified_header(token)
        kid = headers.get('kid')
        if not kid:
            raise InvalidTokenError("Token missing 'kid' in header")

        jwks = _get_jwks()
        for key in jwks.get('keys', []):
            if key.get('kid') == kid:
                from jwt.algorithms import RSAAlgorithm
                return RSAAlgorithm.from_jwk(json.dumps(key))

        raise InvalidKeyError(f"Public key not found for kid: {kid}")
    except Exception as e:
        logger.error(f"Failed to get public key: {str(e)}")
        raise


def verify_jwt_token(token: str) -> Optional[Dict]:
    """Verify JWT token signature and claims.

    Args:
        token: JWT token string (without 'Bearer ' prefix)

    Returns:
        Decoded token payload if valid, None if invalid

    Raises:
        InvalidTokenError: If token format is invalid
        ExpiredSignatureError: If token has expired
        InvalidSignatureError: If signature verification fails
    """
    cognito_region = os.environ.get('AWS_REGION', 'us-east-2')
    cognito_user_pool_id = os.environ.get('COGNITO_USER_POOL_ID')
    cognito_app_client_id = os.environ.get('COGNITO_APP_CLIENT_ID')

    if not token or not cognito_user_pool_id or not cognito_app_client_id:
        logger.warning("JWT verification skipped: missing token or configuration")
        return None

    try:
        public_key = _get_public_key(token)

        payload = jwt.decode(
            token,
            public_key,
            algorithms=['RS256'],
            audience=cognito_app_client_id,
            issuer=f'https://cognito-idp.{cognito_region}.amazonaws.com/{cognito_user_pool_id}',
            options={
                'verify_signature': True,
                'verify_exp': True,
                'verify_aud': True,
                'verify_iss': True,
            }
        )

        logger.debug(f"JWT token verified successfully for user: {payload.get('email', 'unknown')}")
        return payload

    except ExpiredSignatureError:
        logger.warning("JWT token has expired")
        raise
    except (InvalidSignatureError, InvalidKeyError):
        logger.error("JWT signature verification failed")
        raise
    except (InvalidAudienceError, InvalidIssuerError):
        logger.error("JWT token has invalid audience or issuer")
        raise
    except (DecodeError, InvalidAlgorithmError, InvalidTokenError) as e:
        logger.error(f"JWT token decode error: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected JWT verification error: {str(e)}")
        raise InvalidTokenError(f"Token verification failed: {str(e)}")
