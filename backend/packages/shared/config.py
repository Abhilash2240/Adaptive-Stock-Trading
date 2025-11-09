from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = ""
    polygon_api_key: str = ""
    data_provider: str = "mock"
    symbols: str = "AAPL,MSFT,TSLA"
    mock_stream_interval: float = 1.0
    polygon_poll_interval: float = 1.0
    firebase_project_id: str = ""
    firebase_auth_audience: str = ""
    pubsub_topic: str | None = None
    model_bucket: str | None = None
    agent_model_name: str = "ppo-default"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
