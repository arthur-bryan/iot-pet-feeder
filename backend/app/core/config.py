
import os

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "IoT - Pet Feeder"
    ENVIRONMENT: str = "dev"  # dev, demo, prod
    AWS_REGION: str
    DYNAMO_FEED_HISTORY_TABLE: str
    DYNAMO_FEED_SCHEDULE_TABLE: str
    DEVICE_STATUS_TABLE_NAME: str
    DYNAMO_FEED_CONFIG_TABLE_NAME: str
    IOT_ENDPOINT: str | None = None  # Not required for demo mode
    IOT_THING_ID: str
    IOT_TOPIC_FEED: str = "petfeeder/commands"
    IOT_TOPIC_CONFIG: str = "petfeeder/config"
    SNS_TOPIC_ARN: str | None = None  # Optional for local development

    # CORS allowed origins - explicit whitelist for security
    CORS_ALLOWED_ORIGINS: str = os.environ.get(
        'CORS_ALLOWED_ORIGINS',
        'https://dev.dz84jq4nwmr81.amplifyapp.com'
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ALLOWED_ORIGINS into a list."""
        return [origin.strip() for origin in self.CORS_ALLOWED_ORIGINS.split(',') if origin.strip()]

    class Config:
        env_file = ".venv"
        # If you want to strictly enforce that these come from env vars
        # and not fall back to defaults if not found in .venv, remove the defaults.
        # For deployment, they will always come from Lambda environment variables.


settings = Settings()
