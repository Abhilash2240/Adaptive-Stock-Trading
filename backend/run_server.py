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
    
    print("🚀 Starting Adaptive Stock Trading Server")
    print("=" * 50)
    print(f"📁 Backend Directory: {backend_dir}")
    print(f"🔗 Server URL: http://127.0.0.1:8001")
    print(f"📚 API Docs: http://127.0.0.1:8001/docs")
    print("=" * 50)
    
    app = create_app()
    
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8001,
        log_level="info"
    )