from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.routes import config, feed, notifications, schedule, status, users
from app.core.config import settings
from app.core.exceptions import SecurityError, sanitize_error

TAGS_METADATA = [
    {
        "name": "Feed",
        "description": "On-demand feeding operations and feed history management."
    },
    {
        "name": "Schedule",
        "description": "Scheduled feeding management - create, update, delete, and toggle feeding schedules."
    },
    {
        "name": "Config",
        "description": "Device configuration including feed portion size and email notification settings."
    },
    {
        "name": "Status",
        "description": "Device status monitoring including weight readings and connectivity."
    },
    {
        "name": "Notifications",
        "description": "Email notification subscription management."
    },
    {
        "name": "Users",
        "description": "User management including access requests and admin operations."
    },
    {
        "name": "Health",
        "description": "API health check endpoints."
    }
]

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="""
## Smart Pet Feeder API

Cloud-connected IoT pet feeder with weight tracking, event logging, and automated scheduling.

### Features
- **On-demand feeding** - Trigger feeding manually from the app
- **Scheduled feeding** - Set up recurring or one-time feeding schedules
- **Weight tracking** - Monitor food bowl weight in real-time
- **Event history** - View complete feeding history with timestamps
- **Email notifications** - Get notified on feed events
- **Multi-user support** - Admin and regular user roles with Cognito authentication

### Authentication
All endpoints (except health check and access request) require a valid Cognito JWT token
in the `Authorization` header as `Bearer <token>`.
    """,
    openapi_tags=TAGS_METADATA,
    contact={
        "name": "Pet Feeder Support",
        "url": "https://github.com/arthur-bryan/iot-pet-feeder"
    },
    license_info={
        "name": "MIT License",
        "url": "https://opensource.org/licenses/MIT"
    }
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,  # Explicit whitelist (no regex wildcards)
    allow_credentials=True,      # Allow cookies to be included in cross-origin requests
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],  # Explicit methods only
    allow_headers=["Content-Type", "Authorization"],  # Only necessary headers
)
# --- End CORS Configuration ---

# Include routers for different API sections
app.include_router(feed.router, prefix="/api/v1", tags=["Feed"])
app.include_router(schedule.router, prefix="/api/v1", tags=["Schedule"])
app.include_router(config.router, prefix="/api/v1", tags=["Config"])
app.include_router(status.router, prefix="/api/v1/status", tags=["Status"])
app.include_router(notifications.router, prefix="/api/v1", tags=["Notifications"])
app.include_router(users.router, prefix="/api/v1", tags=["Users"])


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "message": "Smart Pet Feeder API is running"}


@app.exception_handler(SecurityError)
async def security_exception_handler(request: Request, exc: SecurityError):
    """Handle security exceptions with sanitized messages."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler - sanitize all unhandled exceptions."""
    return JSONResponse(
        status_code=500,
        content={"detail": sanitize_error(exc, {"path": request.url.path})}
    )
