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
    
    # Security Configuration
    jwt_secret_key: str = "development-secret-key"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    rate_limit_enabled: bool = True
    redis_url: str = "redis://localhost:6379/0"
    allowed_origins: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000"
    log_level: str = "INFO"
    audit_log_enabled: bool = True
    ssl_required: bool = False
    trust_proxy: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
