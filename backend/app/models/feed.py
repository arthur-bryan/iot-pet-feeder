from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class FeedRequest(BaseModel):
    mode: Literal["manual", "api", "scheduled"] = Field(default="api", description="How the feed was triggered: 'api' for web/app, 'manual' for physical button, 'scheduled' for scheduled feeds")
    requested_by: str = Field(default="manual", examples=["user@example.com"])


class FeedResponse(BaseModel):
    feed_id: str
    requested_by: str
    mode: str
    status: Literal["queued", "sent", "failed", "denied_weight_exceeded"]
    timestamp: datetime
    event_type: str | None = Field(default="manual_feed", description="Type of event: manual_feed, consumption, refill")
    weight_before_g: float | None = Field(default=None, description="Weight in grams before the event")
    weight_after_g: float | None = Field(default=None, description="Weight in grams after the event")
    weight_delta_g: float | None = Field(default=None, description="Change in weight (positive = added, negative = consumed)")
