#!/usr/bin/env python3
"""
Simple server runner that sets up the Python path correctly.
"""

import sys
import os
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

if __name__ == "__main__":
    import uvicorn
    from packages.api.app import create_app

    port = int(os.environ.get("PORT", 8001))
    host = os.environ.get("HOST", "0.0.0.0")

    print("🚀 Starting Adaptive Stock Trading Server")
    print("=" * 50)
    print(f"📁 Backend Directory: {backend_dir}")
    print(f"🔗 Server URL: http://{host}:{port}")
    print(f"📚 API Docs: http://{host}:{port}/docs")
    print("=" * 50)

    app = create_app()

    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info"
    )