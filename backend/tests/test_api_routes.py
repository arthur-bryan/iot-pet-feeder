"""
Tests for FastAPI API routes.
"""
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


class TestFeedRoutes:
    """Test cases for feed API routes."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        from app.main import app
        return TestClient(app)

    def test_health_check(self, client):
        """Test health check endpoint."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    @patch('app.api.v1.routes.feed.process_feed')
    def test_on_demand_feed_success(self, mock_process, client):
        """Test on-demand feed endpoint."""
        mock_process.return_value = {
            "feed_id": "test-123",
            "status": "sent",
            "requested_by": "test@example.com",
            "mode": "manual",
            "timestamp": "2025-12-13T14:00:00Z",
            "event_type": "manual_feed"
        }

        response = client.post(
            "/api/v1/feeds",
            json={"requested_by": "test@example.com", "mode": "manual"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["feed_id"] == "test-123"
        assert data["status"] == "sent"

    @patch('app.api.v1.routes.feed.get_feed_history')
    def test_get_feed_history(self, mock_history, client):
        """Test feed history endpoint."""
        mock_history.return_value = {
            "items": [],
            "total_items": 0,
            "page": 1,
            "limit": 10,
            "total_pages": 0
        }

        response = client.get("/api/v1/feed-events")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert data["page"] == 1

    @patch('app.api.v1.routes.feed.get_feed_history')
    def test_get_feed_history_with_pagination(self, mock_history, client):
        """Test feed history endpoint with pagination."""
        mock_history.return_value = {
            "items": [{"feed_id": "test-1"}],
            "total_items": 100,
            "page": 2,
            "limit": 10,
            "total_pages": 10
        }

        response = client.get("/api/v1/feed-events?page=2&limit=10")

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 2
        assert data["total_pages"] == 10


class TestScheduleRoutes:
    """Test cases for schedule API routes."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        from app.main import app
        return TestClient(app)

    @patch('app.api.v1.routes.schedule.create_schedule_db')
    def test_create_schedule(self, mock_create, client):
        """Test create schedule endpoint."""
        mock_create.return_value = {
            "schedule_id": "test-schedule-123",
            "scheduled_time": "2025-12-13T14:00:00Z",
            "recurrence": "daily",
            "feed_cycles": 1,
            "enabled": True,
            "requested_by": "test@example.com",
            "created_at": "2025-12-13T10:00:00Z",
            "updated_at": "2025-12-13T10:00:00Z"
        }

        response = client.post(
            "/api/v1/schedules",
            json={
                "scheduled_time": "2025-12-13T14:00:00Z",
                "recurrence": "daily",
                "feed_cycles": 1,
                "enabled": True,
                "requested_by": "test@example.com"
            }
        )

        assert response.status_code == 201
        data = response.json()
        assert data["schedule_id"] == "test-schedule-123"

    @patch('app.api.v1.routes.schedule.list_schedules_db')
    def test_list_schedules(self, mock_list, client):
        """Test list schedules endpoint."""
        mock_list.return_value = {
            "schedules": [],
            "total": 0,
            "page": 1,
            "page_size": 20,
            "has_next": False
        }

        response = client.get("/api/v1/schedules")

        assert response.status_code == 200
        data = response.json()
        assert "schedules" in data

    @patch('app.api.v1.routes.schedule.get_schedule_db')
    @patch('app.api.v1.routes.schedule.delete_schedule_db')
    def test_delete_schedule(self, mock_delete, mock_get, client):
        """Test delete schedule endpoint."""
        mock_get.return_value = {"schedule_id": "test-123"}
        mock_delete.return_value = None

        response = client.delete("/api/v1/schedules/test-123")

        assert response.status_code == 204

    @patch('app.api.v1.routes.schedule.get_schedule_db')
    def test_delete_schedule_not_found(self, mock_get, client):
        """Test delete schedule returns 404 when not found."""
        mock_get.return_value = None

        response = client.delete("/api/v1/schedules/nonexistent")

        assert response.status_code == 404
