"""Tests for JWT signature verification."""

import json
import time
from unittest.mock import MagicMock, patch

import jwt
import pytest
from jwt.exceptions import (
    DecodeError,
    ExpiredSignatureError,
    InvalidAudienceError,
    InvalidIssuerError,
    InvalidKeyError,
    InvalidSignatureError,
    InvalidTokenError,
)

from app.core import jwt_verifier


class TestGetJWKS:
    """Tests for _get_jwks function."""

    @patch('app.core.jwt_verifier.urlopen')
    def test_fetches_jwks_on_first_call(self, mock_urlopen):
        """Should fetch JWKS from Cognito on first call."""
        jwt_verifier._jwks_cache = None
        jwt_verifier._jwks_cache_timestamp = 0

        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({'keys': [{'kid': 'test-kid'}]}).encode()
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        result = jwt_verifier._get_jwks()

        assert result == {'keys': [{'kid': 'test-kid'}]}
        mock_urlopen.assert_called_once()

    @patch('app.core.jwt_verifier.urlopen')
    def test_uses_cached_jwks_within_ttl(self, mock_urlopen):
        """Should use cached JWKS if within TTL."""
        cached_jwks = {'keys': [{'kid': 'cached-kid'}]}
        jwt_verifier._jwks_cache = cached_jwks
        jwt_verifier._jwks_cache_timestamp = time.time()

        result = jwt_verifier._get_jwks()

        assert result == cached_jwks
        mock_urlopen.assert_not_called()

    @patch('app.core.jwt_verifier.urlopen')
    def test_refetches_jwks_after_ttl_expires(self, mock_urlopen):
        """Should refetch JWKS after TTL expires."""
        jwt_verifier._jwks_cache = {'keys': [{'kid': 'old-kid'}]}
        jwt_verifier._jwks_cache_timestamp = time.time() - 3700  # Expired

        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({'keys': [{'kid': 'new-kid'}]}).encode()
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        result = jwt_verifier._get_jwks()

        assert result == {'keys': [{'kid': 'new-kid'}]}
        mock_urlopen.assert_called_once()

    @patch('app.core.jwt_verifier.urlopen')
    def test_uses_stale_cache_on_fetch_failure(self, mock_urlopen):
        """Should use stale cache if fetch fails."""
        cached_jwks = {'keys': [{'kid': 'stale-kid'}]}
        jwt_verifier._jwks_cache = cached_jwks
        jwt_verifier._jwks_cache_timestamp = time.time() - 3700  # Expired

        mock_urlopen.side_effect = Exception("Network error")

        result = jwt_verifier._get_jwks()

        assert result == cached_jwks

    @patch('app.core.jwt_verifier.urlopen')
    def test_raises_error_if_no_cache_and_fetch_fails(self, mock_urlopen):
        """Should raise error if no cache and fetch fails."""
        jwt_verifier._jwks_cache = None
        jwt_verifier._jwks_cache_timestamp = 0

        mock_urlopen.side_effect = Exception("Network error")

        with pytest.raises(Exception, match="Network error"):
            jwt_verifier._get_jwks()


class TestGetPublicKey:
    """Tests for _get_public_key function."""

    @patch('app.core.jwt_verifier._get_jwks')
    @patch('app.core.jwt_verifier.jwt.get_unverified_header')
    def test_extracts_public_key_for_valid_kid(self, mock_get_header, mock_get_jwks):
        """Should extract public key for valid kid."""
        mock_get_header.return_value = {'kid': 'test-kid', 'alg': 'RS256'}
        mock_get_jwks.return_value = {
            'keys': [
                {
                    'kid': 'test-kid',
                    'kty': 'RSA',
                    'use': 'sig',
                    'n': 'test-n',
                    'e': 'AQAB'
                }
            ]
        }

        with patch('jwt.algorithms.RSAAlgorithm.from_jwk') as mock_from_jwk:
            mock_from_jwk.return_value = MagicMock()
            result = jwt_verifier._get_public_key('test.token.here')
            assert result is not None

    @patch('app.core.jwt_verifier._get_jwks')
    @patch('app.core.jwt_verifier.jwt.get_unverified_header')
    def test_raises_error_for_missing_kid_in_header(self, mock_get_header, mock_get_jwks):
        """Should raise error if kid is missing in token header."""
        mock_get_header.return_value = {'alg': 'RS256'}

        with pytest.raises(InvalidTokenError, match="Token missing 'kid' in header"):
            jwt_verifier._get_public_key('test.token.here')

    @patch('app.core.jwt_verifier._get_jwks')
    @patch('app.core.jwt_verifier.jwt.get_unverified_header')
    def test_raises_error_for_kid_not_in_jwks(self, mock_get_header, mock_get_jwks):
        """Should raise error if kid not found in JWKS."""
        mock_get_header.return_value = {'kid': 'unknown-kid', 'alg': 'RS256'}
        mock_get_jwks.return_value = {
            'keys': [
                {
                    'kid': 'different-kid',
                    'kty': 'RSA',
                    'use': 'sig',
                    'n': 'test-n',
                    'e': 'AQAB'
                }
            ]
        }

        with pytest.raises(InvalidKeyError, match="Public key not found for kid: unknown-kid"):
            jwt_verifier._get_public_key('test.token.here')


class TestVerifyJWTToken:
    """Tests for verify_jwt_token function."""

    @patch('app.core.jwt_verifier._get_public_key')
    @patch('app.core.jwt_verifier.jwt.decode')
    def test_verifies_valid_token(self, mock_decode, mock_get_key):
        """Should verify valid JWT token and return payload."""
        mock_get_key.return_value = MagicMock()
        mock_decode.return_value = {
            'email': 'test@example.com',
            'sub': 'user-123',
            'aud': 'test-client-id',
            'iss': 'https://cognito-idp.us-east-2.amazonaws.com/us-east-2_test'
        }

        with patch.dict('os.environ', {
            'COGNITO_USER_POOL_ID': 'us-east-2_test',
            'COGNITO_APP_CLIENT_ID': 'test-client-id',
            'AWS_REGION': 'us-east-2'
        }):
            result = jwt_verifier.verify_jwt_token('valid.jwt.token')

        assert result['email'] == 'test@example.com'
        mock_decode.assert_called_once()

    @patch('app.core.jwt_verifier._get_public_key')
    @patch('app.core.jwt_verifier.jwt.decode')
    def test_raises_error_for_expired_token(self, mock_decode, mock_get_key):
        """Should raise ExpiredSignatureError for expired token."""
        mock_get_key.return_value = MagicMock()
        mock_decode.side_effect = ExpiredSignatureError("Token expired")

        with patch.dict('os.environ', {
            'COGNITO_USER_POOL_ID': 'us-east-2_test',
            'COGNITO_APP_CLIENT_ID': 'test-client-id',
            'AWS_REGION': 'us-east-2'
        }):
            with pytest.raises(ExpiredSignatureError):
                jwt_verifier.verify_jwt_token('expired.jwt.token')

    @patch('app.core.jwt_verifier._get_public_key')
    @patch('app.core.jwt_verifier.jwt.decode')
    def test_raises_error_for_invalid_signature(self, mock_decode, mock_get_key):
        """Should raise InvalidSignatureError for invalid signature."""
        mock_get_key.return_value = MagicMock()
        mock_decode.side_effect = InvalidSignatureError("Signature verification failed")

        with patch.dict('os.environ', {
            'COGNITO_USER_POOL_ID': 'us-east-2_test',
            'COGNITO_APP_CLIENT_ID': 'test-client-id',
            'AWS_REGION': 'us-east-2'
        }):
            with pytest.raises(InvalidSignatureError):
                jwt_verifier.verify_jwt_token('tampered.jwt.token')

    @patch('app.core.jwt_verifier._get_public_key')
    @patch('app.core.jwt_verifier.jwt.decode')
    def test_raises_error_for_invalid_audience(self, mock_decode, mock_get_key):
        """Should raise InvalidAudienceError for wrong audience."""
        mock_get_key.return_value = MagicMock()
        mock_decode.side_effect = InvalidAudienceError("Invalid audience")

        with patch.dict('os.environ', {
            'COGNITO_USER_POOL_ID': 'us-east-2_test',
            'COGNITO_APP_CLIENT_ID': 'test-client-id',
            'AWS_REGION': 'us-east-2'
        }):
            with pytest.raises(InvalidAudienceError):
                jwt_verifier.verify_jwt_token('wrong.audience.token')

    @patch('app.core.jwt_verifier._get_public_key')
    @patch('app.core.jwt_verifier.jwt.decode')
    def test_raises_error_for_invalid_issuer(self, mock_decode, mock_get_key):
        """Should raise InvalidIssuerError for wrong issuer."""
        mock_get_key.return_value = MagicMock()
        mock_decode.side_effect = InvalidIssuerError("Invalid issuer")

        with patch.dict('os.environ', {
            'COGNITO_USER_POOL_ID': 'us-east-2_test',
            'COGNITO_APP_CLIENT_ID': 'test-client-id',
            'AWS_REGION': 'us-east-2'
        }):
            with pytest.raises(InvalidIssuerError):
                jwt_verifier.verify_jwt_token('wrong.issuer.token')

    def test_returns_none_for_missing_token(self):
        """Should return None if token is empty."""
        with patch.dict('os.environ', {
            'COGNITO_USER_POOL_ID': 'us-east-2_test',
            'COGNITO_APP_CLIENT_ID': 'test-client-id',
            'AWS_REGION': 'us-east-2'
        }):
            result = jwt_verifier.verify_jwt_token('')
        assert result is None

    def test_returns_none_for_missing_config(self):
        """Should return None if required config is missing."""
        with patch.dict('os.environ', {}, clear=True):
            result = jwt_verifier.verify_jwt_token('some.jwt.token')
        assert result is None

    @patch('app.core.jwt_verifier._get_public_key')
    @patch('app.core.jwt_verifier.jwt.decode')
    def test_wraps_unexpected_errors(self, mock_decode, mock_get_key):
        """Should wrap unexpected errors in InvalidTokenError."""
        mock_get_key.return_value = MagicMock()
        mock_decode.side_effect = Exception("Unexpected error")

        with patch.dict('os.environ', {
            'COGNITO_USER_POOL_ID': 'us-east-2_test',
            'COGNITO_APP_CLIENT_ID': 'test-client-id',
            'AWS_REGION': 'us-east-2'
        }):
            with pytest.raises(InvalidTokenError, match="Token verification failed"):
                jwt_verifier.verify_jwt_token('bad.jwt.token')

    @patch('app.core.jwt_verifier._get_public_key')
    @patch('app.core.jwt_verifier.jwt.decode')
    def test_raises_error_for_decode_error(self, mock_decode, mock_get_key):
        """Should raise DecodeError for malformed token."""
        mock_get_key.return_value = MagicMock()
        mock_decode.side_effect = DecodeError("Token is malformed")

        with patch.dict('os.environ', {
            'COGNITO_USER_POOL_ID': 'us-east-2_test',
            'COGNITO_APP_CLIENT_ID': 'test-client-id',
            'AWS_REGION': 'us-east-2'
        }):
            with pytest.raises(DecodeError):
                jwt_verifier.verify_jwt_token('malformed.jwt.token')

    @patch('app.core.jwt_verifier._get_public_key')
    @patch('app.core.jwt_verifier.jwt.decode')
    def test_raises_error_for_invalid_algorithm(self, mock_decode, mock_get_key):
        """Should raise InvalidAlgorithmError for wrong algorithm."""
        from jwt.exceptions import InvalidAlgorithmError
        mock_get_key.return_value = MagicMock()
        mock_decode.side_effect = InvalidAlgorithmError("Algorithm not allowed")

        with patch.dict('os.environ', {
            'COGNITO_USER_POOL_ID': 'us-east-2_test',
            'COGNITO_APP_CLIENT_ID': 'test-client-id',
            'AWS_REGION': 'us-east-2'
        }):
            with pytest.raises(InvalidAlgorithmError):
                jwt_verifier.verify_jwt_token('wrong.algorithm.token')

    @patch('app.core.jwt_verifier._get_public_key')
    def test_raises_error_for_invalid_key_from_get_public_key(self, mock_get_key):
        """Should propagate InvalidKeyError from _get_public_key."""
        mock_get_key.side_effect = InvalidKeyError("Invalid key")

        with patch.dict('os.environ', {
            'COGNITO_USER_POOL_ID': 'us-east-2_test',
            'COGNITO_APP_CLIENT_ID': 'test-client-id',
            'AWS_REGION': 'us-east-2'
        }):
            with pytest.raises(InvalidKeyError):
                jwt_verifier.verify_jwt_token('invalid.key.token')

    @patch('app.core.jwt_verifier._get_jwks')
    @patch('app.core.jwt_verifier.jwt.get_unverified_header')
    def test_get_public_key_handles_exceptions(self, mock_get_header, mock_get_jwks):
        """Should handle exceptions in _get_public_key."""
        mock_get_header.side_effect = Exception("Header extraction failed")

        with pytest.raises(Exception, match="Header extraction failed"):
            jwt_verifier._get_public_key('test.token.here')
