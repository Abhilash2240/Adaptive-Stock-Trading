# Adaptive-Stock-Trading

## Quick start

1. Install dependencies: run `powershell -ExecutionPolicy Bypass -File scripts/setup.ps1` (or manually create the `.venv` via `py -3.11 -m venv .venv`, then `.\.venv\Scripts\Activate.ps1`, `pip install -r backend\requirements.txt`, and `npm install`).
2. Copy `backend/.env.example` to `backend/.env`, and `apps/client/.env.example` to `apps/client/.env.local`. Adjust values (API endpoints, Sentry DSN, Polygon keys, etc.).
3. Launch both services together: `npm run dev:full`. This wraps the FastAPI backend (`python -m backend.main`) and the Vite frontend (`vite dev`).

On Windows you can also run `powershell -ExecutionPolicy Bypass -File scripts/start.ps1` to open dedicated terminals for each process. Stop both servers with `CTRL+C` in their respective windows.