from fastapi import FastAPI
from app.api.v1.routes import feed
from app.api.v1.routes import schedule
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="API to control on-demand and scheduled pet feeding"
)
app.include_router(feed.router, prefix="/api/v1/feed", tags=["Feed"])
app.include_router(schedule.router, prefix="/api/v1/schedule", tags=["Schedule"])


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "message": "Smart Pet Feeder API is running"}