from pydantic import BaseModel, Field
from typing import Literal
from datetime import datetime


class FeedRequest(BaseModel):
    mode: Literal["manual", "api"] = Field(default="api", description="How the feed was triggered")
    requested_by: str = Field(default="manual", examples=["user@example.com"])


class FeedResponse(BaseModel):
    feed_id: str
    requested_by: str
    mode: str
    status: Literal["queued", "sent", "failed"]
    timestamp: datetime
