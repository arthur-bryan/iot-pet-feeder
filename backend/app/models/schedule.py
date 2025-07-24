from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime


class ScheduleRequest(BaseModel):
    requested_by: str = Field(..., examples=["user@example.com"])
    scheduled_time: str = Field(..., description="When to feed the pet (UTC)")
    recurrence: Optional[Literal["daily", "weekly"]] = Field(None, description="Optional recurrence Rule")


class ScheduleResponse(BaseModel):
    schedule_id: str
    requested_by: str
    status: Literal["scheduled", "failed"]
    scheduled_time: datetime
    created_at: datetime
    enabled: bool = True
