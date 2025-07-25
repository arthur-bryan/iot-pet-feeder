from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.routes import feed
from app.api.v1.routes import schedule
from app.api.v1.routes import status # <<< ADDED THIS
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="API to control on-demand and scheduled pet feeding"
)

# --- CORS Configuration ---
# IMPORTANT: Replace "https://your-amplify-app-url.amplifyapp.com" with the actual URL
# of your deployed AWS Amplify static website.
# For local development, ensure you include the exact origin of your local web server.
# For example, if you run `python -m http.server 8000` in your frontend's `public` directory,
# then "http://localhost:8000" and "http://127.0.0.1:8000" are necessary.
origins = [
    "http://0.0.0.0:8000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "https://your-amplify-app-url.amplifyapp.com", # <<< REPLACE THIS WITH YOUR ACTUAL AMPLIFY URL
    # If your Amplify app is on a custom domain, add that here too:
    # "https://www.yourcustomdomain.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,       # List of allowed origins
    allow_credentials=True,      # Allow cookies to be included in cross-origin requests
    allow_methods=["*"],         # Allow all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],         # Allow all headers
)
# --- End CORS Configuration ---

# Include routers for different API sections
app.include_router(feed.router, prefix="/api/v1/feed", tags=["Feed"])
app.include_router(schedule.router, prefix="/api/v1/schedule", tags=["Schedule"])
app.include_router(status.router, prefix="/status", tags=["Status"])


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "message": "Smart Pet Feeder API is running"}
