# Backend (FastAPI + RL)

This directory hosts the redesigned Python backend. Install dependencies via Poetry (`poetry install`) or uv, then run `python -m backend.main` to launch the FastAPI service. The default configuration uses the mock data provider until real API keys are supplied.

Prefer to orchestrate everything from the repo root? Activate your virtual environment, run `npm install` once, and then use `npm run dev:full` to start backend and frontend together (under the hood it executes `python -m backend.main` alongside Vite). A PowerShell helper is available at `scripts/start.ps1` if you want the processes in separate terminals.

## Configuration

Populate a `.env` file or environment variables as needed:

```
DATA_PROVIDER=mock          # or "polygon"
SYMBOLS=AAPL,MSFT,TSLA      # comma-separated tickers limited to enums today
MOCK_STREAM_INTERVAL=1.0    # seconds between mock quote updates
POLYGON_POLL_INTERVAL=1.0   # seconds between Polygon REST polls
POLYGON_API_KEY=...         # required when DATA_PROVIDER=polygon
```

When `DATA_PROVIDER=polygon`, the backend polls Polygon's last-trade endpoint for each symbol and streams results through the WebSocket API. The mock provider generates random-walk quotes for quick local testing.
