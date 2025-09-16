from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "IoT - Pet Feeder"
    AWS_REGION: str
    DYNAMO_FEED_HISTORY_TABLE: str
    DYNAMO_FEED_SCHEDULE_TABLE: str
    DEVICE_STATUS_TABLE_NAME: str
    IOT_ENDPOINT: str
    IOT_THING_ID: str
    IOT_TOPIC_FEED: str = "petfeeder/commands"

    class Config:
        env_file = ".env"
        # If you want to strictly enforce that these come from env vars
        # and not fall back to defaults if not found in .env, remove the defaults.
        # For deployment, they will always come from Lambda environment variables.


settings = Settings()
