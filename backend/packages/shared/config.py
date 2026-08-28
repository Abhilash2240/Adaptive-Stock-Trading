from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Locate the project root .env (two levels up from this file)
_THIS_DIR = Path(__file__).resolve().parent          # packages/shared/
_BACKEND_DIR = _THIS_DIR.parent.parent               # backend/
_PROJECT_ROOT = _BACKEND_DIR.parent                   # Adaptive-Stock-Trading/

_ENV_FILES: list[str] = []
for candidate in [_BACKEND_DIR / ".env", _PROJECT_ROOT / ".env", Path(".env")]:
    if candidate.exists():
        _ENV_FILES.append(str(candidate))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILES or ".env",
        case_sensitive=False,
        protected_namespaces=("settings_",),
    )

    environment: str = "development"
    port: int = 8001
    database_url: str = ""
    twelvedata_api_key: str = ""
    data_provider: str = ""
    symbols: str = "AAPL,MSFT,TSLA"
    mock_stream_interval: float = 1.0
    twelvedata_poll_interval: float = 60.0  # free tier: 8 credits/min
    firebase_project_id: str = ""
    firebase_auth_audience: str = ""
    pubsub_topic: str | None = None
    model_bucket: str | None = None
    agent_model_name: str = "ppo-default"
    agent_train_interval: int = 32
    
    # Security Configuration
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    rate_limit_enabled: bool = True
    redis_url: str = "redis://localhost:6379/0"
    allowed_origins: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000"
    log_level: str = "INFO"
    audit_log_enabled: bool = True
    ssl_required: bool = False
    trust_proxy: bool = False
    auth0_domain: str = ""
    auth0_audience: str = ""
    openrouter_api_key: str = ""
    openrouter_model: str = "nvidia/nemotron-3-ultra-550b-a55b"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_timeout_seconds: float = 15.0

    @model_validator(mode="after")
    def apply_provider_defaults(self) -> "Settings":
        # Default to twelvedata when a key is present; otherwise use mock.
        if not self.data_provider:
            self.data_provider = "twelvedata" if self.twelvedata_api_key else "mock"
        if self.data_provider == "twelvedata" and not self.twelvedata_api_key:
            self.data_provider = "mock"
        return self

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
