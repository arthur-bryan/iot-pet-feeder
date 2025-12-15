"""
Tests for config API routes.
"""
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient


class TestConfigRoutes:
    """Test cases for configuration API routes."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        from app.main import app
        return TestClient(app)

    @patch('app.api.v1.routes.config.fetch_config_setting')
    def test_get_config_setting_servo_duration(self, mock_fetch, client):
        """Test getting servo duration config."""
        mock_fetch.return_value = {
            'config_key': 'SERVO_OPEN_HOLD_DURATION_MS',
            'value': Decimal('3000')
        }

        response = client.get("/api/v1/config/SERVO_OPEN_HOLD_DURATION_MS")

        assert response.status_code == 200
        data = response.json()
        assert data['config_key'] == 'SERVO_OPEN_HOLD_DURATION_MS'
        assert data['value'] == 3000

    @patch('app.api.v1.routes.config.fetch_config_setting')
    def test_get_config_setting_weight_threshold(self, mock_fetch, client):
        """Test getting weight threshold config."""
        mock_fetch.return_value = {
            'config_key': 'WEIGHT_THRESHOLD_G',
            'value': Decimal('450')
        }

        response = client.get("/api/v1/config/WEIGHT_THRESHOLD_G")

        assert response.status_code == 200
        data = response.json()
        assert data['config_key'] == 'WEIGHT_THRESHOLD_G'
        assert data['value'] == 450

    @patch('app.api.v1.routes.config.fetch_config_setting')
    def test_get_config_setting_fallback_servo_duration(self, mock_fetch, client):
        """Test fallback for servo duration when not in DB."""
        mock_fetch.return_value = None

        response = client.get("/api/v1/config/SERVO_OPEN_HOLD_DURATION_MS")

        assert response.status_code == 200
        data = response.json()
        assert data['config_key'] == 'SERVO_OPEN_HOLD_DURATION_MS'
        assert data['value'] == 3000  # Default value

    @patch('app.api.v1.routes.config.fetch_config_setting')
    def test_get_config_setting_fallback_weight_threshold(self, mock_fetch, client):
        """Test fallback for weight threshold when not in DB."""
        mock_fetch.return_value = None

        response = client.get("/api/v1/config/WEIGHT_THRESHOLD_G")

        assert response.status_code == 200
        data = response.json()
        assert data['config_key'] == 'WEIGHT_THRESHOLD_G'
        assert data['value'] == 450  # Default value

    @patch('app.api.v1.routes.config.fetch_config_setting')
    def test_get_config_setting_fallback_email_notifications(self, mock_fetch, client):
        """Test fallback for email notifications when not in DB."""
        mock_fetch.return_value = None

        response = client.get("/api/v1/config/EMAIL_NOTIFICATIONS")

        assert response.status_code == 200
        data = response.json()
        assert data['config_key'] == 'EMAIL_NOTIFICATIONS'
        assert 'enabled' in data['value']

    @patch('app.api.v1.routes.config.fetch_config_setting')
    def test_get_config_setting_not_found(self, mock_fetch, client):
        """Test 404 for unknown config key."""
        mock_fetch.return_value = None

        response = client.get("/api/v1/config/UNKNOWN_KEY")

        assert response.status_code == 404

    @patch('app.api.v1.routes.config.publish_config_update')
    @patch('app.api.v1.routes.config.update_config_setting')
    def test_set_config_setting_servo_duration_valid(self, mock_update, mock_publish, client):
        """Test updating servo duration with valid value."""
        mock_update.return_value = {
            'config_key': 'SERVO_OPEN_HOLD_DURATION_MS',
            'value': 2500
        }
        mock_publish.return_value = True

        response = client.put(
            "/api/v1/config/SERVO_OPEN_HOLD_DURATION_MS",
            json={"value": "2500"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['value'] == 2500

    @patch('app.api.v1.routes.config.update_config_setting')
    def test_set_config_setting_servo_duration_too_low(self, mock_update, client):
        """Test error when servo duration is too low."""
        response = client.put(
            "/api/v1/config/SERVO_OPEN_HOLD_DURATION_MS",
            json={"value": "500"}
        )

        assert response.status_code == 400
        assert "1000 ms" in response.json()['detail']

    @patch('app.api.v1.routes.config.update_config_setting')
    def test_set_config_setting_servo_duration_too_high(self, mock_update, client):
        """Test error when servo duration is too high."""
        response = client.put(
            "/api/v1/config/SERVO_OPEN_HOLD_DURATION_MS",
            json={"value": "10000"}
        )

        assert response.status_code == 400
        assert "5000 ms" in response.json()['detail']

    @patch('app.api.v1.routes.config.update_config_setting')
    def test_set_config_setting_servo_duration_invalid(self, mock_update, client):
        """Test error when servo duration is not a number."""
        response = client.put(
            "/api/v1/config/SERVO_OPEN_HOLD_DURATION_MS",
            json={"value": "not_a_number"}
        )

        assert response.status_code == 400
        assert "valid integer" in response.json()['detail']

    @patch('app.api.v1.routes.config.publish_config_update')
    @patch('app.api.v1.routes.config.update_config_setting')
    def test_set_config_setting_weight_threshold_valid(self, mock_update, mock_publish, client):
        """Test updating weight threshold with valid value."""
        mock_update.return_value = {
            'config_key': 'WEIGHT_THRESHOLD_G',
            'value': 500
        }
        mock_publish.return_value = True

        response = client.put(
            "/api/v1/config/WEIGHT_THRESHOLD_G",
            json={"value": "500"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['value'] == 500

    @patch('app.api.v1.routes.config.update_config_setting')
    def test_set_config_setting_weight_threshold_too_low(self, mock_update, client):
        """Test error when weight threshold is too low."""
        response = client.put(
            "/api/v1/config/WEIGHT_THRESHOLD_G",
            json={"value": "50"}
        )

        assert response.status_code == 400
        assert "100g" in response.json()['detail']

    @patch('app.api.v1.routes.config.update_config_setting')
    def test_set_config_setting_weight_threshold_too_high(self, mock_update, client):
        """Test error when weight threshold is too high."""
        response = client.put(
            "/api/v1/config/WEIGHT_THRESHOLD_G",
            json={"value": "2000"}
        )

        assert response.status_code == 400
        assert "1000g" in response.json()['detail']

    @patch('app.api.v1.routes.config.update_config_setting')
    def test_set_config_setting_email_notifications(self, mock_update, client):
        """Test updating email notifications config."""
        email_config = '{"email":"test@example.com","enabled":true}'
        mock_update.return_value = {
            'config_key': 'EMAIL_NOTIFICATIONS',
            'value': email_config
        }

        response = client.put(
            "/api/v1/config/EMAIL_NOTIFICATIONS",
            json={"value": email_config}
        )

        assert response.status_code == 200

    @patch('app.api.v1.routes.config.update_config_setting')
    def test_set_config_setting_generic_key(self, mock_update, client):
        """Test updating a generic config key."""
        mock_update.return_value = {
            'config_key': 'CUSTOM_KEY',
            'value': 'custom_value'
        }

        response = client.put(
            "/api/v1/config/CUSTOM_KEY",
            json={"value": "custom_value"}
        )

        assert response.status_code == 200

    def test_set_config_mqtt_publish_failure(self, client):
        """Test that config is still updated even if MQTT publish fails."""
        with patch('app.api.v1.routes.config.update_config_setting', new_callable=AsyncMock) as mock_update, \
             patch('app.api.v1.routes.config.publish_config_update', new_callable=AsyncMock) as mock_publish:
            mock_update.return_value = {
                'config_key': 'SERVO_OPEN_HOLD_DURATION_MS',
                'value': 2500
            }
            mock_publish.return_value = False

            response = client.put(
                "/api/v1/config/SERVO_OPEN_HOLD_DURATION_MS",
                json={"value": "2500"}
            )

            assert response.status_code == 200

    def test_set_config_weight_threshold_mqtt_failure(self, client):
        """Test weight threshold config update when MQTT publish fails."""
        with patch('app.api.v1.routes.config.update_config_setting', new_callable=AsyncMock) as mock_update, \
             patch('app.api.v1.routes.config.publish_config_update', new_callable=AsyncMock) as mock_publish:
            mock_update.return_value = {
                'config_key': 'WEIGHT_THRESHOLD_G',
                'value': 500
            }
            mock_publish.return_value = False

            response = client.put(
                "/api/v1/config/WEIGHT_THRESHOLD_G",
                json={"value": "500"}
            )

            assert response.status_code == 200

    def test_set_config_weight_threshold_invalid(self, client):
        """Test error when weight threshold is not a valid number."""
        response = client.put(
            "/api/v1/config/WEIGHT_THRESHOLD_G",
            json={"value": "not_a_number"}
        )

        assert response.status_code == 400
        assert "valid integer" in response.json()['detail']

    @patch('app.api.v1.routes.config.fetch_config_setting')
    def test_get_config_setting_non_decimal_value(self, mock_fetch, client):
        """Test getting config when value is already int (not Decimal)."""
        mock_fetch.return_value = {
            'config_key': 'SERVO_OPEN_HOLD_DURATION_MS',
            'value': 3000
        }

        response = client.get("/api/v1/config/SERVO_OPEN_HOLD_DURATION_MS")

        assert response.status_code == 200
        data = response.json()
        assert data['value'] == 3000
