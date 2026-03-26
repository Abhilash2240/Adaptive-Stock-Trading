#!/usr/bin/env python3
"""
Simple server runner that sets up the Python path correctly.
Handles VS Code terminal SIGBREAK on Windows gracefully.
"""

import sys
import os
import signal
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))


if __name__ == "__main__":
    # Redirect stdin to devnull to avoid EOF issues in VS Code terminals
    try:
        devnull = open(os.devnull, "r")
        os.dup2(devnull.fileno(), 0)
    except Exception:
        pass

    # Monkey-patch uvicorn to remove SIGBREAK from its handled signals list.
    # VS Code sends SIGBREAK to background terminals on Windows, which causes
    # uvicorn to shut down immediately after startup.
    import uvicorn.server as _uvicorn_server
    if hasattr(signal, "SIGBREAK"):
        _uvicorn_server.HANDLED_SIGNALS = tuple(
            s for s in _uvicorn_server.HANDLED_SIGNALS if s != signal.SIGBREAK
        )

    import uvicorn

    port = int(os.environ.get("PORT", 8001))
    host = os.environ.get("HOST", "0.0.0.0")

    print("Starting Adaptive Stock Trading Server")
    print("=" * 50)
    print(f"Backend Directory: {backend_dir}")
    print(f"Server URL: http://{host}:{port}")
    print(f"API Docs: http://{host}:{port}/docs")
    print("=" * 50)
    sys.stdout.flush()

    uvicorn.run(
        "packages.api.app:create_app",
        factory=True,
        host=host,
        port=port,
        log_level="info",
    )