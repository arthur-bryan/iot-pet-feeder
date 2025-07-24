from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "IoT - Pet Feeder"
    AWS_REGION: str = "us-east-2"
    DYNAMO_FEED_HISTORY_TABLE: str = "feed-history"
    DYNAMO_FEED_SCHEDULE_TABLE: str = "feed-schedules"
    IOT_THING_ID: str = "PetFeeder"
    IOT_TOPIC_FEED: str = "petfeeder/commands"

    class Config:
        env_file = ".env"


settings = Settings()
