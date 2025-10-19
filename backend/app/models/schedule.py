from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional, List
from datetime import datetime


class ScheduleRequest(BaseModel):
    requested_by: str = Field(..., examples=["user@example.com"])
    scheduled_time: str = Field(..., description="ISO 8601 datetime in UTC (e.g., '2025-10-18T14:30:00Z')")
    feed_cycles: int = Field(1, ge=1, le=10, description="Number of feed cycles (1-10)")
    recurrence: Optional[Literal["none", "daily", "weekly"]] = Field("none", description="Recurrence pattern")
    enabled: bool = Field(True, description="Whether the schedule is active")

    @field_validator('scheduled_time')
    @classmethod
    def validate_scheduled_time(cls, v):
        try:
            # Validate ISO format
            datetime.fromisoformat(v.replace('Z', '+00:00'))
            return v
        except ValueError:
            raise ValueError("scheduled_time must be in ISO 8601 format (e.g., '2025-10-18T14:30:00Z')")


class ScheduleUpdate(BaseModel):
    scheduled_time: Optional[str] = Field(None, description="ISO 8601 datetime in UTC")
    feed_cycles: Optional[int] = Field(None, ge=1, le=10, description="Number of feed cycles (1-10)")
    recurrence: Optional[Literal["none", "daily", "weekly"]] = None
    enabled: Optional[bool] = None


class ScheduleResponse(BaseModel):
    schedule_id: str
    requested_by: str
    scheduled_time: str
    feed_cycles: int
    recurrence: str
    enabled: bool
    created_at: str
    updated_at: Optional[str] = None
    next_execution: Optional[str] = Field(None, description="Next scheduled execution time")


class ScheduleListResponse(BaseModel):
    schedules: List[ScheduleResponse]
    total: int
    page: int
    page_size: int
    has_next: bool
