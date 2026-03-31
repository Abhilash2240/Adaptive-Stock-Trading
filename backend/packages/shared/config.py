from functools import lru_cache
from pathlib import Path
import secrets as _secrets

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
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"
    data_provider: str = ""
    symbols: str = "AAPL,MSFT,TSLA"
    mock_stream_interval: float = 1.0
    twelvedata_poll_interval: float = 60.0  # free tier: 8 credits/min
    firebase_project_id: str = ""
    firebase_auth_audience: str = ""
    pubsub_topic: str | None = None
    model_bucket: str | None = None
    agent_model_name: str = "ppo-default"
    
    # Security Configuration
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    rate_limit_enabled: bool = True
    redis_url: str = "redis://localhost:6379/0"
    allowed_origins: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000"
    log_level: str = "INFO"
    audit_log_enabled: bool = True
    ssl_required: bool = False
    trust_proxy: bool = False

    @model_validator(mode="after")
    def apply_provider_defaults(self) -> "Settings":
        # Default to twelvedata when a key is present; otherwise use mock.
        if not self.data_provider:
            self.data_provider = "twelvedata" if self.twelvedata_api_key else "mock"
        if self.data_provider == "twelvedata" and not self.twelvedata_api_key:
            self.data_provider = "mock"
        return self

    @model_validator(mode="after")
    def _check_jwt_secret(self) -> "Settings":
        if not self.jwt_secret:
            if self.environment == "production":
                raise ValueError(
                    "JWT_SECRET must be set in production. "
                    "Generate one with: "
                    "python -c \"import secrets; print(secrets.token_hex(32))\""
                )
            # Dev only - generate ephemeral secret with warning.
            import warnings

            self.jwt_secret = _secrets.token_hex(32)
            warnings.warn(
                "JWT_SECRET not set - using ephemeral secret. "
                "All sessions will invalidate on restart. "
                "Set JWT_SECRET in .env for persistent sessions.",
                RuntimeWarning,
                stacklevel=2,
            )
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
