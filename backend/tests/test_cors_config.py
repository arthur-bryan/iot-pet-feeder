"""Tests for CORS configuration."""

import pytest
from unittest.mock import patch

from app.core.config import Settings


class TestCORSConfig:
    """Tests for CORS configuration."""

    def test_default_cors_origins(self):
        """Should use default Amplify URL when env var not set."""
        with patch.dict('os.environ', {}, clear=True):
            settings = Settings(
                AWS_REGION='us-east-2',
                DYNAMO_FEED_HISTORY_TABLE='test',
                DYNAMO_FEED_SCHEDULE_TABLE='test',
                DEVICE_STATUS_TABLE_NAME='test',
                DYNAMO_FEED_CONFIG_TABLE_NAME='test',
                IOT_THING_ID='test'
            )
            origins = settings.cors_origins_list
            assert len(origins) == 1
            assert 'https://dev.dz84jq4nwmr81.amplifyapp.com' in origins

    def test_single_custom_origin(self):
        """Should parse single custom origin from env var."""
        with patch.dict('os.environ', {
            'CORS_ALLOWED_ORIGINS': 'https://example.com'
        }):
            settings = Settings(
                AWS_REGION='us-east-2',
                DYNAMO_FEED_HISTORY_TABLE='test',
                DYNAMO_FEED_SCHEDULE_TABLE='test',
                DEVICE_STATUS_TABLE_NAME='test',
                DYNAMO_FEED_CONFIG_TABLE_NAME='test',
                IOT_THING_ID='test'
            )
            origins = settings.cors_origins_list
            assert len(origins) == 1
            assert 'https://example.com' in origins

    def test_multiple_custom_origins(self):
        """Should parse multiple custom origins from comma-separated env var."""
        with patch.dict('os.environ', {
            'CORS_ALLOWED_ORIGINS': 'https://example.com,https://app.example.com,https://staging.example.com'
        }):
            settings = Settings(
                AWS_REGION='us-east-2',
                DYNAMO_FEED_HISTORY_TABLE='test',
                DYNAMO_FEED_SCHEDULE_TABLE='test',
                DEVICE_STATUS_TABLE_NAME='test',
                DYNAMO_FEED_CONFIG_TABLE_NAME='test',
                IOT_THING_ID='test'
            )
            origins = settings.cors_origins_list
            assert len(origins) == 3
            assert 'https://example.com' in origins
            assert 'https://app.example.com' in origins
            assert 'https://staging.example.com' in origins

    def test_origins_with_whitespace(self):
        """Should trim whitespace from origins."""
        with patch.dict('os.environ', {
            'CORS_ALLOWED_ORIGINS': '  https://example.com  , https://app.example.com , https://staging.example.com  '
        }):
            settings = Settings(
                AWS_REGION='us-east-2',
                DYNAMO_FEED_HISTORY_TABLE='test',
                DYNAMO_FEED_SCHEDULE_TABLE='test',
                DEVICE_STATUS_TABLE_NAME='test',
                DYNAMO_FEED_CONFIG_TABLE_NAME='test',
                IOT_THING_ID='test'
            )
            origins = settings.cors_origins_list
            assert len(origins) == 3
            assert all('  ' not in origin for origin in origins)

    def test_empty_origins_filtered(self):
        """Should filter out empty strings from origins list."""
        with patch.dict('os.environ', {
            'CORS_ALLOWED_ORIGINS': 'https://example.com,,https://app.example.com'
        }):
            settings = Settings(
                AWS_REGION='us-east-2',
                DYNAMO_FEED_HISTORY_TABLE='test',
                DYNAMO_FEED_SCHEDULE_TABLE='test',
                DEVICE_STATUS_TABLE_NAME='test',
                DYNAMO_FEED_CONFIG_TABLE_NAME='test',
                IOT_THING_ID='test'
            )
            origins = settings.cors_origins_list
            assert len(origins) == 2
            assert '' not in origins

    def test_no_wildcard_or_regex_patterns(self):
        """Should not accept wildcard or regex patterns (explicit whitelist only)."""
        with patch.dict('os.environ', {
            'CORS_ALLOWED_ORIGINS': 'https://dev.dz84jq4nwmr81.amplifyapp.com'
        }):
            settings = Settings(
                AWS_REGION='us-east-2',
                DYNAMO_FEED_HISTORY_TABLE='test',
                DYNAMO_FEED_SCHEDULE_TABLE='test',
                DEVICE_STATUS_TABLE_NAME='test',
                DYNAMO_FEED_CONFIG_TABLE_NAME='test',
                IOT_THING_ID='test'
            )
            origins = settings.cors_origins_list

            # Verify no wildcards or regex patterns
            for origin in origins:
                assert '*' not in origin
                assert '.*' not in origin
                assert '|' not in origin
                assert origin.startswith('https://')
