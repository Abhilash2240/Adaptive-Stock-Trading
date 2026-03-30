import uvicorn
import os

from packages.api import create_app
from packages.shared.config import get_settings


def run() -> None:
    settings = get_settings()
    port = int(os.environ.get("PORT", "8001"))
    uvicorn.run(
        "packages.api.app:create_app",
        factory=True,
        host="0.0.0.0",
        port=port,
        reload=settings.environment == "development",
        log_level="info",
    )


if __name__ == "__main__":
    run()
