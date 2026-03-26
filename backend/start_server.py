#!/usr/bin/env python3
"""
Development Server Startup Script
Starts the FastAPI server with security enabled.
"""

import asyncio
import os
import subprocess
import sys
from pathlib import Path

def main():
    """Start the FastAPI development server."""
    backend_dir = Path(__file__).parent
    
    print("🚀 Starting Adaptive Stock Trading Server")
    print("=" * 50)
    print(f"📁 Backend Directory: {backend_dir}")
    print(f"🔒 Security: Enabled")
    print(f"🌍 Environment: Development") 
    print(f"🔗 Server URL: http://localhost:8000")
    print(f"📚 API Docs: http://localhost:8000/docs")
    print("=" * 50)
    
    # Change to backend directory
    os.chdir(backend_dir)
    
    try:
        # Start the server with uvicorn
        cmd = [
            "uvicorn", 
            "packages.api.app:create_app", 
            "--factory",
            "--host", "127.0.0.1",
            "--port", "8000", 
            "--reload",
            "--log-level", "info"
        ]
        
        print("📡 Starting server with command:", " ".join(cmd))
        print("Press Ctrl+C to stop the server")
        print("-" * 50)
        
        subprocess.run(cmd, check=True)
        
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except subprocess.CalledProcessError as e:
        print(f"❌ Server failed to start: {e}")
        sys.exit(1)
    except FileNotFoundError:
        print("❌ uvicorn not found. Install with: pip install uvicorn")
        sys.exit(1)

if __name__ == "__main__":
    main()