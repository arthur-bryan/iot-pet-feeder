"""
Tests for notifications API routes.
"""
from unittest.mock import patch

import pytest
from botocore.exceptions import ClientError
from fastapi.testclient import TestClient


class TestNotificationsRoutes:
    """Test cases for notifications API routes."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        from app.main import app
        return TestClient(app)

    @patch('app.api.v1.routes.notifications.sns_client')
    def test_subscribe_success(self, mock_sns, client):
        """Test successful subscription."""
        mock_sns.subscribe.return_value = {
            'SubscriptionArn': 'arn:aws:sns:us-east-1:123456789:topic:sub-123'
        }

        response = client.post(
            "/api/v1/notifications/subscribe",
            json={"email": "test@example.com"}
        )

        assert response.status_code == 200
        data = response.json()
        assert 'subscription_arn' in data
        assert data['status'] == 'confirmed'

    @patch('app.api.v1.routes.notifications.sns_client')
    def test_subscribe_pending_confirmation(self, mock_sns, client):
        """Test subscription pending confirmation."""
        mock_sns.subscribe.return_value = {
            'SubscriptionArn': 'pending confirmation'
        }

        response = client.post(
            "/api/v1/notifications/subscribe",
            json={"email": "test@example.com"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'pending_confirmation'

    @patch('app.api.v1.routes.notifications.sns_client')
    def test_subscribe_error(self, mock_sns, client):
        """Test subscription error handling."""
        mock_sns.subscribe.side_effect = ClientError(
            {'Error': {'Code': '500', 'Message': 'Test error'}},
            'Subscribe'
        )

        response = client.post(
            "/api/v1/notifications/subscribe",
            json={"email": "test@example.com"}
        )

        assert response.status_code == 500
        assert 'Failed to subscribe' in response.json()['detail']

    def test_subscribe_invalid_email(self, client):
        """Test subscription with invalid email."""
        response = client.post(
            "/api/v1/notifications/subscribe",
            json={"email": "not-an-email"}
        )

        assert response.status_code == 422

    @patch('app.api.v1.routes.notifications.sns_client')
    def test_unsubscribe_success(self, mock_sns, client):
        """Test successful unsubscription."""
        mock_sns.unsubscribe.return_value = {}

        response = client.post(
            "/api/v1/notifications/unsubscribe",
            json={"subscription_arn": "arn:aws:sns:us-east-1:123456789:topic:sub-123"}
        )

        assert response.status_code == 200
        assert 'Successfully unsubscribed' in response.json()['message']

    @patch('app.api.v1.routes.notifications.sns_client')
    def test_unsubscribe_error(self, mock_sns, client):
        """Test unsubscription error handling."""
        mock_sns.unsubscribe.side_effect = ClientError(
            {'Error': {'Code': '500', 'Message': 'Test error'}},
            'Unsubscribe'
        )

        response = client.post(
            "/api/v1/notifications/unsubscribe",
            json={"subscription_arn": "arn:aws:sns:us-east-1:123456789:topic:sub-123"}
        )

        assert response.status_code == 500
        assert 'Failed to unsubscribe' in response.json()['detail']

    @patch('app.api.v1.routes.notifications.sns_client')
    def test_get_subscription_status_subscribed(self, mock_sns, client):
        """Test getting subscription status when subscribed."""
        mock_sns.list_subscriptions_by_topic.return_value = {
            'Subscriptions': [
                {
                    'Endpoint': 'test@example.com',
                    'SubscriptionArn': 'arn:aws:sns:us-east-1:123456789:topic:sub-123'
                }
            ]
        }

        response = client.get("/api/v1/notifications/subscriptions/test@example.com")

        assert response.status_code == 200
        data = response.json()
        assert data['subscribed'] is True
        assert data['status'] == 'confirmed'

    @patch('app.api.v1.routes.notifications.sns_client')
    def test_get_subscription_status_pending(self, mock_sns, client):
        """Test getting subscription status when pending confirmation."""
        mock_sns.list_subscriptions_by_topic.return_value = {
            'Subscriptions': [
                {
                    'Endpoint': 'test@example.com',
                    'SubscriptionArn': 'PendingConfirmation'
                }
            ]
        }

        response = client.get("/api/v1/notifications/subscriptions/test@example.com")

        assert response.status_code == 200
        data = response.json()
        assert data['subscribed'] is True
        assert data['status'] == 'pending_confirmation'

    @patch('app.api.v1.routes.notifications.sns_client')
    def test_get_subscription_status_not_subscribed(self, mock_sns, client):
        """Test getting subscription status when not subscribed."""
        mock_sns.list_subscriptions_by_topic.return_value = {
            'Subscriptions': []
        }

        response = client.get("/api/v1/notifications/subscriptions/test@example.com")

        assert response.status_code == 200
        data = response.json()
        assert data['subscribed'] is False
        assert data['status'] == 'not_subscribed'

    @patch('app.api.v1.routes.notifications.sns_client')
    def test_get_subscription_status_error(self, mock_sns, client):
        """Test getting subscription status error handling."""
        mock_sns.list_subscriptions_by_topic.side_effect = ClientError(
            {'Error': {'Code': '500', 'Message': 'Test error'}},
            'ListSubscriptionsByTopic'
        )

        response = client.get("/api/v1/notifications/subscriptions/test@example.com")

        assert response.status_code == 500
        assert 'Failed to check subscription' in response.json()['detail']

    @patch('app.api.v1.routes.notifications.sns_client')
    def test_get_subscription_status_not_found_in_list(self, mock_sns, client):
        """Test subscription status when email not in subscription list."""
        mock_sns.list_subscriptions_by_topic.return_value = {
            'Subscriptions': [
                {
                    'Endpoint': 'other@example.com',
                    'SubscriptionArn': 'arn:aws:sns:us-east-1:123456789:topic:sub-456'
                },
                {
                    'Endpoint': 'another@example.com',
                    'SubscriptionArn': 'arn:aws:sns:us-east-1:123456789:topic:sub-789'
                }
            ]
        }

        response = client.get("/api/v1/notifications/subscriptions/test@example.com")

        assert response.status_code == 200
        data = response.json()
        assert data['subscribed'] is False
        assert data['status'] == 'not_subscribed'
