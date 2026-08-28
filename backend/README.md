# Backend (FastAPI + RL)

This directory hosts the redesigned Python backend. Install dependencies via Poetry (`poetry install`) or uv, then run `python -m backend.main` to launch the FastAPI service. The default configuration uses the mock data provider until real API keys are supplied.

Prefer to orchestrate everything from the repo root? Activate your virtual environment, run `npm install` once, and then use `npm run dev:full` to start backend and frontend together (under the hood it executes `python -m backend.main` alongside Vite). A PowerShell helper is available at `scripts/start.ps1` if you want the processes in separate terminals. The one-shot setup script at `scripts/setup.ps1` can bootstrap `.venv`, install Python requirements, and install npm dependencies.

Copy `backend/.env.example` to `backend/.env` and tweak values before running in anything other than the default mock configuration.

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

## Auth0 Configuration

The backend uses Auth0 for JWT authentication. To enable role-based access control:

1. Set `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` in `.env`
2. **Configure a Post-Login Action in your Auth0 tenant** to add roles to the JWT:
   - Create or modify a Post-Login Action that writes user roles to a custom claim namespace
   - Common namespaces: `https://yourapp/roles`, `https://yourdomain.com/roles`, or `roles`
3. Set `AUTH0_ROLES_CLAIM` in `.env` to match the namespace you configured (default: `https://yourapp/roles`)

Example Post-Login Action code:
```javascript
module.exports = async (event, api) => {
  const roles = event.authorization?.roles || [];
  api.idToken.setCustomClaim('https://yourapp/roles', roles);
};
```

Without a proper Post-Login Action, all users will have empty roles, and `require_admin()` protected endpoints (like `POST /api/v1/rl/train`) will return 403 even for administrators.
