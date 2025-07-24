from fastapi import FastAPI
from backend.app.api.v1.routes import feed
from backend.app.api.v1.routes import schedule
from backend.app.core.config import settings
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="API to control on-demand and scheduled pet feeding"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(feed.router, prefix="/api/v1/feed", tags=["Feed"])
app.include_router(schedule.router, prefix="/api/v1/schedule", tags=["Schedule"])


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "message": "Smart Pet Feeder API is running"}