from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime


class FeedRequest(BaseModel):
    mode: Literal["manual", "api"] = Field(default="api", description="How the feed was triggered: 'api' for web/app, 'manual' for physical button")
    requested_by: str = Field(default="manual", examples=["user@example.com"])


class FeedResponse(BaseModel):
    feed_id: str
    requested_by: str
    mode: str
    status: Literal["queued", "sent", "failed", "denied_weight_exceeded"]
    timestamp: datetime
    event_type: Optional[str] = Field(default="manual_feed", description="Type of event: manual_feed, consumption, refill")
    weight_before_g: Optional[float] = Field(default=None, description="Weight in grams before the event")
    weight_after_g: Optional[float] = Field(default=None, description="Weight in grams after the event")
    weight_delta_g: Optional[float] = Field(default=None, description="Change in weight (positive = added, negative = consumed)")
