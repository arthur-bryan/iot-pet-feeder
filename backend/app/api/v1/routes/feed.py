import os
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query

from app.core.auth import extract_email_from_token, is_admin, redact_email
from app.crud.feed import delete_all_feed_events
from app.models.feed import FeedRequest, FeedResponse
from app.services.feed_service import get_feed_history, process_feed

router = APIRouter()


def redact_feed_history(history_data: dict, user_email: str, is_admin_user: bool) -> dict:
    """Redact emails in feed history for non-admin users."""
    if is_admin_user:
        return history_data

    items = history_data.get('items', [])
    for item in items:
        requested_by = item.get('requested_by', '')
        if requested_by and requested_by != user_email:
            item['requested_by'] = redact_email(requested_by)

    return history_data


@router.post(
    "/feeds",
    response_model=FeedResponse,
    summary="Trigger on-demand feeding",
    description="""
    Triggers an immediate feeding event.

    Publishes MQTT command to ESP32 device via AWS IoT Core.
    The device will dispense food for the configured duration (default 3000ms).
    Feed events are logged to DynamoDB with timestamp and attribution.
    """,
    responses={
        200: {
            "description": "Feed command sent successfully",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "message": "Feed command sent to device",
                        "timestamp": "2025-12-14T10:30:00Z"
                    }
                }
            }
        },
        500: {
            "description": "Server error (MQTT publish failure, DynamoDB error)",
            "content": {
                "application/json": {
                    "example": {"detail": "Failed to publish feed command"}
                }
            }
        }
    }
)
async def on_demand(request: FeedRequest):
    try:
        result = await process_feed(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get(
    "/feed-events",
    response_model=dict[str, Any],
    summary="Get feeding history",
    description="""
    Retrieves paginated feeding event history from DynamoDB.

    **Access Control**:
    - **Admin users**: See all feed events with full email addresses
    - **Regular users**: See all events but other users' emails are redacted (e.g., u***@example.com)

    **Pagination**: Results are returned newest-first with pagination support.

    **Time filtering**: Optional ISO 8601 timestamp range for filtering events.
    """,
    responses={
        200: {
            "description": "Paginated feed history",
            "content": {
                "application/json": {
                    "example": {
                        "items": [
                            {
                                "timestamp": "2025-12-14T10:30:00Z",
                                "requested_by": "user@example.com",
                                "event_type": "on_demand",
                                "success": True
                            }
                        ],
                        "total": 42,
                        "page": 1,
                        "limit": 10,
                        "has_next": True
                    }
                }
            }
        },
        500: {
            "description": "Server error (DynamoDB query failure)",
            "content": {
                "application/json": {
                    "example": {"detail": "Failed to query feed history"}
                }
            }
        }
    }
)
async def read_feed_history(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(10, ge=1, le=1000, description="Items per page (max 1000)"),
    start_time: str = Query(None, description="Filter start time (ISO 8601 format)"),
    end_time: str = Query(None, description="Filter end time (ISO 8601 format)"),
    authorization: str | None = Header(None)
):
    try:
        history_data = await get_feed_history(
            page=page,
            limit=limit,
            start_time=start_time,
            end_time=end_time
        )

        user_email = extract_email_from_token(authorization)
        is_admin_user = is_admin(user_email) if user_email else False

        return redact_feed_history(history_data, user_email or '', is_admin_user)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete(
    "/feed-events",
    response_model=dict[str, Any],
    summary="Delete all feeding events",
    description="""
    Permanently deletes all feeding event records from DynamoDB.

    **⚠️ Warning**: This action is irreversible.

    Use this for testing/maintenance or to clear historical data.
    """,
    responses={
        200: {
            "description": "All events deleted successfully",
            "content": {
                "application/json": {
                    "example": {
                        "message": "All feed history events deleted successfully",
                        "deleted_count": 156
                    }
                }
            }
        },
        500: {
            "description": "Server error (DynamoDB deletion failure)",
            "content": {
                "application/json": {
                    "example": {"detail": "Failed to delete events"}
                }
            }
        }
    }
)
async def delete_all_events():
    try:
        deleted_count = await delete_all_feed_events()
        return {
            "message": "All feed history events deleted successfully",
            "deleted_count": deleted_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
