# Adaptive-Stock-Trading

## Quick start

1. Install dependencies: `npm install` and set up a Python 3.11 virtual environment (`py -3.11 -m venv .venv` followed by `.\.venv\Scripts\Activate.ps1 && pip install -r backend\requirements.txt`).
2. Create `apps\client\.env.local` with `VITE_API_BASE=http://localhost:8080` and `VITE_WS_URL=ws://localhost:8080/ws/quotes` (plus any other public config you need).
3. Launch both services together: `npm run dev:full`. This wraps the FastAPI backend (`python -m backend.main`) and the Vite frontend (`vite dev`).

On Windows you can also run `powershell -ExecutionPolicy Bypass -File scripts/start.ps1` to open dedicated terminals for each process. Stop both servers with `CTRL+C` in their respective windows.