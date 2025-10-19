from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.routes import feed
from app.api.v1.routes import schedule
from app.api.v1.routes import config
from app.api.v1.routes import status
from app.api.v1.routes import notifications
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="API to control on-demand and scheduled pet feeding"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # List of allowed origins
    allow_credentials=True,      # Allow cookies to be included in cross-origin requests
    allow_methods=["*"],         # Allow all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],         # Allow all headers
)
# --- End CORS Configuration ---

# Include routers for different API sections
app.include_router(feed.router, prefix="/api/v1", tags=["Feed"])
app.include_router(schedule.router, prefix="/api/v1", tags=["Schedule"])
app.include_router(config.router, prefix="/api/v1", tags=["Config"])
app.include_router(status.router, prefix="/status", tags=["Status"])
app.include_router(notifications.router, prefix="/api/v1", tags=["Notifications"])


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "message": "Smart Pet Feeder API is running"}
