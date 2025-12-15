from fastapi import APIRouter, Header, HTTPException, Query

from app.core.auth import extract_email_from_token, is_admin
from app.crud.schedule import create_schedule as create_schedule_db
from app.crud.schedule import delete_schedule as delete_schedule_db
from app.crud.schedule import get_schedule as get_schedule_db
from app.crud.schedule import list_schedules as list_schedules_db
from app.crud.schedule import toggle_schedule as toggle_schedule_db
from app.crud.schedule import update_schedule as update_schedule_db
from app.models.schedule import ScheduleListResponse, ScheduleRequest, ScheduleResponse, ScheduleUpdate

router = APIRouter()


def verify_schedule_ownership(schedule: dict, user_email: str) -> bool:
    """Verify that user owns the schedule or is admin."""
    if is_admin(user_email):
        return True
    return schedule.get('requested_by') == user_email


@router.post(
    "/schedules",
    response_model=ScheduleResponse,
    status_code=201,
    summary="Create feeding schedule",
    description="""
    Creates a new recurring or one-time feeding schedule.

    **Schedule types**:
    - **Recurring**: Cron-based (e.g., "0 8,18 * * *" for 8 AM and 6 PM daily)
    - **One-time**: Single execution at specified time

    **Ownership**: Schedule is automatically attributed to authenticated user.

    **Activation**: New schedules are enabled by default unless `enabled: false` is specified.
    """,
    responses={
        201: {
            "description": "Schedule created successfully",
            "content": {
                "application/json": {
                    "example": {
                        "schedule_id": "sched_123abc",
                        "cron_expression": "0 8,18 * * *",
                        "enabled": True,
                        "requested_by": "user@example.com",
                        "created_at": "2025-12-14T10:30:00Z"
                    }
                }
            }
        },
        500: {
            "description": "Server error (DynamoDB write failure, invalid cron expression)",
            "content": {
                "application/json": {
                    "example": {"detail": "Failed to create schedule"}
                }
            }
        }
    }
)
async def create_schedule(
    request: ScheduleRequest,
    authorization: str | None = Header(None)
):
    try:
        user_email = extract_email_from_token(authorization)
        if user_email and not request.requested_by:
            request.requested_by = user_email

        schedule = create_schedule_db(request)
        return ScheduleResponse(**schedule)
    except Exception as e:
        print(f"Error creating schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get(
    "/schedules",
    response_model=ScheduleListResponse,
    summary="List feeding schedules",
    description="""
    Retrieves paginated list of feeding schedules.

    **Access Control**:
    - **Admin users**: Can see all schedules, optionally filter by user
    - **Regular users**: Only see their own schedules (filter is ignored)

    **Pagination**: Default 20 items per page, max 100.

    **Sorting**: Results ordered by creation time (newest first).
    """,
    responses={
        200: {
            "description": "Paginated schedule list",
            "content": {
                "application/json": {
                    "example": {
                        "schedules": [
                            {
                                "schedule_id": "sched_123abc",
                                "cron_expression": "0 8 * * *",
                                "enabled": True,
                                "requested_by": "user@example.com"
                            }
                        ],
                        "total": 5,
                        "page": 1,
                        "page_size": 20,
                        "has_next": False
                    }
                }
            }
        },
        500: {
            "description": "Server error (DynamoDB query failure)",
            "content": {
                "application/json": {
                    "example": {"detail": "Failed to list schedules"}
                }
            }
        }
    }
)
async def list_schedules(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page (max 100)"),
    requested_by: str | None = Query(None, description="Filter by user email (admin only)"),
    authorization: str | None = Header(None)
):
    try:
        user_email = extract_email_from_token(authorization)

        filter_by = requested_by
        if user_email and not is_admin(user_email) and not requested_by:
            filter_by = user_email

        result = list_schedules_db(page=page, page_size=page_size, requested_by=filter_by)

        schedules = [ScheduleResponse(**schedule) for schedule in result["schedules"]]

        return ScheduleListResponse(
            schedules=schedules,
            total=result["total"],
            page=result["page"],
            page_size=result["page_size"],
            has_next=result["has_next"]
        )
    except Exception as e:
        print(f"Error listing schedules: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get(
    "/schedules/{schedule_id}",
    response_model=ScheduleResponse,
    summary="Get schedule details",
    description="""
    Retrieves a single feeding schedule by ID.

    **Access Control**: Users can only view their own schedules (admins can view any).

    **Use case**: Get full schedule details including metadata and execution history.
    """,
    responses={
        200: {
            "description": "Schedule details",
            "content": {
                "application/json": {
                    "example": {
                        "schedule_id": "sched_123abc",
                        "cron_expression": "0 8,18 * * *",
                        "enabled": True,
                        "requested_by": "user@example.com",
                        "created_at": "2025-12-14T10:30:00Z"
                    }
                }
            }
        },
        403: {
            "description": "Forbidden (not schedule owner)",
            "content": {
                "application/json": {
                    "example": {"detail": "You can only view your own schedules"}
                }
            }
        },
        404: {
            "description": "Schedule not found",
            "content": {
                "application/json": {
                    "example": {"detail": "Schedule not found"}
                }
            }
        },
        500: {
            "description": "Server error",
            "content": {
                "application/json": {
                    "example": {"detail": "Failed to retrieve schedule"}
                }
            }
        }
    }
)
async def get_schedule(
    schedule_id: str,
    authorization: str | None = Header(None)
):
    try:
        schedule = get_schedule_db(schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")

        user_email = extract_email_from_token(authorization)
        if user_email and not verify_schedule_ownership(schedule, user_email):
            raise HTTPException(status_code=403, detail="You can only view your own schedules")

        return ScheduleResponse(**schedule)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put(
    "/schedules/{schedule_id}",
    response_model=ScheduleResponse,
    summary="Update feeding schedule",
    description="""
    Updates an existing feeding schedule.

    **Access Control**: Users can only modify their own schedules (admins can modify any).

    **Updatable fields**: Cron expression, enabled status, description, etc.

    **Partial updates**: Only provided fields are updated (omitted fields remain unchanged).
    """,
    responses={
        200: {
            "description": "Schedule updated successfully",
            "content": {
                "application/json": {
                    "example": {
                        "schedule_id": "sched_123abc",
                        "cron_expression": "0 9,19 * * *",
                        "enabled": True,
                        "updated_at": "2025-12-14T11:00:00Z"
                    }
                }
            }
        },
        403: {
            "description": "Forbidden (not schedule owner)",
            "content": {
                "application/json": {
                    "example": {"detail": "You can only update your own schedules"}
                }
            }
        },
        404: {
            "description": "Schedule not found",
            "content": {
                "application/json": {
                    "example": {"detail": "Schedule not found"}
                }
            }
        },
        500: {
            "description": "Server error",
            "content": {
                "application/json": {
                    "example": {"detail": "Failed to update schedule"}
                }
            }
        }
    }
)
async def update_schedule(
    schedule_id: str,
    update: ScheduleUpdate,
    authorization: str | None = Header(None)
):
    try:
        existing = get_schedule_db(schedule_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Schedule not found")

        user_email = extract_email_from_token(authorization)
        if user_email and not verify_schedule_ownership(existing, user_email):
            raise HTTPException(status_code=403, detail="You can only update your own schedules")

        updated_schedule = update_schedule_db(schedule_id, update)
        return ScheduleResponse(**updated_schedule)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete(
    "/schedules/{schedule_id}",
    status_code=204,
    summary="Delete feeding schedule",
    description="""
    Permanently deletes a feeding schedule.

    **Access Control**: Users can only delete their own schedules (admins can delete any).

    **⚠️ Warning**: This action is irreversible. Consider disabling instead of deleting.

    **Effect**: Schedule is removed from DynamoDB and will never execute again.
    """,
    responses={
        204: {"description": "Schedule deleted successfully (no content)"},
        403: {
            "description": "Forbidden (not schedule owner)",
            "content": {
                "application/json": {
                    "example": {"detail": "You can only delete your own schedules"}
                }
            }
        },
        404: {
            "description": "Schedule not found",
            "content": {
                "application/json": {
                    "example": {"detail": "Schedule not found"}
                }
            }
        },
        500: {
            "description": "Server error",
            "content": {
                "application/json": {
                    "example": {"detail": "Failed to delete schedule"}
                }
            }
        }
    }
)
async def delete_schedule(
    schedule_id: str,
    authorization: str | None = Header(None)
):
    try:
        existing = get_schedule_db(schedule_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Schedule not found")

        user_email = extract_email_from_token(authorization)
        if user_email and not verify_schedule_ownership(existing, user_email):
            raise HTTPException(status_code=403, detail="You can only delete your own schedules")

        delete_schedule_db(schedule_id)
        return None
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.patch(
    "/schedules/{schedule_id}/toggle",
    response_model=ScheduleResponse,
    summary="Enable/disable schedule",
    description="""
    Toggles a feeding schedule on or off without deleting it.

    **Access Control**: Users can only toggle their own schedules (admins can toggle any).

    **Use case**: Temporarily pause a schedule for vacation, illness, etc.

    **Effect**:
    - `enabled=true`: Schedule will execute at next scheduled time
    - `enabled=false`: Schedule skips all executions until re-enabled
    """,
    responses={
        200: {
            "description": "Schedule toggled successfully",
            "content": {
                "application/json": {
                    "example": {
                        "schedule_id": "sched_123abc",
                        "enabled": False,
                        "updated_at": "2025-12-14T11:00:00Z"
                    }
                }
            }
        },
        403: {
            "description": "Forbidden (not schedule owner)",
            "content": {
                "application/json": {
                    "example": {"detail": "You can only modify your own schedules"}
                }
            }
        },
        404: {
            "description": "Schedule not found",
            "content": {
                "application/json": {
                    "example": {"detail": "Schedule not found"}
                }
            }
        },
        500: {
            "description": "Server error",
            "content": {
                "application/json": {
                    "example": {"detail": "Failed to toggle schedule"}
                }
            }
        }
    }
)
async def toggle_schedule(
    schedule_id: str,
    enabled: bool = Query(..., description="Enable (true) or disable (false) the schedule"),
    authorization: str | None = Header(None)
):
    try:
        existing = get_schedule_db(schedule_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Schedule not found")

        user_email = extract_email_from_token(authorization)
        if user_email and not verify_schedule_ownership(existing, user_email):
            raise HTTPException(status_code=403, detail="You can only modify your own schedules")

        toggled_schedule = toggle_schedule_db(schedule_id, enabled)
        return ScheduleResponse(**toggled_schedule)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error toggling schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e
