# Adaptive Stock Trading Platform

## 1. Executive Summary
Adaptive Stock Trading is a full-stack reference implementation for algorithmic trading workflows. It combines a React + Vite client, a Python FastAPI backend, and reinforcement-learning agent services. The project targets low-latency quote streaming, simulated paper trading, and operational dashboards suitable for local experimentation or cloud deployment.

## 2. Solution Architecture
- **Frontend**: Vite + React (TypeScript), Tailwind CSS, component library built on Radix UI. Consumes REST and WebSocket endpoints for quotes, metrics, and control signals.
- **Backend API**: FastAPI application (`backend/main.py`) hosting REST routes under `packages.api.routes`. Uses SQLModel/SQLAlchemy for persistence and orchestrates data providers, agent services, and shared configuration.
- **Data Layer**: Pluggable providers via `packages.data.provider` supporting either mock data streams or Polygon market data (`POLYGON_API_KEY`).
- **Agent Service**: RL agent interfaces in `packages.agent.service` reading models from `MODEL_BUCKET`, coordinating training/inference workflows.
- **Infrastructure Hooks**: Optional integrations with Firebase Auth, Google Pub/Sub, Google Cloud Storage, Redis, Sentry.

```
Client (Vite/React)  <-->  FastAPI REST + WS  <-->  Data Providers (Mock / Polygon)
                                         \-->  Agent Service (Torch RL)
                                         \-->  Optional GCP Integrations (Pub/Sub, GCS)
```

## 3. Key Features
- Real-time quote dashboard with configurable streaming tickers.
- Paper trading and backtesting views for RL policies.
- Diagnostics pages for monitoring agent metrics, logs, and WebSocket status.
- Modular theme support and responsive design for desktop/mobile.

## 4. Project Structure
```
apps/
  client/        # Frontend source, Vite configs, components, pages
backend/         # FastAPI app, data providers, agent service, tests
.pnpm, .env*     # Environment and toolchain configuration
```
Additional roots include `bandit.yaml`, `eslint.config.js`, `tailwind.config.ts`, `vite.config.ts`, `tsconfig.json`.

## 5. Local Development Workflow
1. **Install dependencies**
   ```powershell
   npm install
   python -m venv .venv
   .\.venv\Scripts\activate
   pip install -r backend\requirements.txt
   ```
2. **Configure environment**
   - Copy `.env` to appropriate values (mock provider works without external keys).
   - Optional: populate `POLYGON_API_KEY`, Firebase, Pub/Sub, Redis settings.
3. **Run backend**
   ```powershell
   $env:PYTHONPATH="backend"
   python -m backend.main
   ```
4. **Run frontend**
   ```powershell
   npm run dev
   ```
5. Access the UI at `http://localhost:5173` (Vite auto-selects available port).

## 6. Environment Variables
| Variable | Purpose | Required | Notes |
| --- | --- | --- | --- |
| `ENVIRONMENT` | Controls dev/staging/prod behaviour | Yes | `development` enables auto-reload |
| `DATABASE_URL` | SQLModel connection string | Yes | Defaults to local SQLite |
| `POLYGON_API_KEY` | Polygon market data access | Optional | Required when `DATA_PROVIDER=polygon` |
| `DATA_PROVIDER` | `mock` or `polygon` | Yes | Mock provider for offline runs |
| `SYMBOLS` | Comma-separated tickers | Yes | Used by streaming providers |
| `FIREBASE_PROJECT_ID`, `FIREBASE_AUTH_AUDIENCE` | Auth validation | Optional | Needed if enabling Firebase Auth |
| `PUBSUB_TOPIC`, `MODEL_BUCKET` | GCP integrations | Optional | Enable asynchronous workflows |
| `REDIS_URL` | Redis cache | Optional | Provide only when Redis used |
| `VITE_API_BASE`, `VITE_WS_URL` | Frontend runtime endpoints | Optional | Default to current origin |
| `VITE_SENTRY_DSN` | Frontend observability | Optional | Leave blank to disable |

## 7. Testing Strategy
- Python tests (`backend/tests`) cover data provider logic; run with `pytest`.
- Frontend relies on ESLint and TypeScript for static checking; add React Testing Library for UI coverage if needed.

## 8. Deployment Considerations
- **Azure**: Containerize backend (Azure Container Apps/App Service) and deploy frontend via Azure Static Web Apps. Ensure subscription region policies allow chosen regions.
- **Google Cloud**: Leverage Cloud Run for backend, Cloud Storage for model artifacts, Pub/Sub for eventing.
- **CI/CD**: GitHub Actions previously handled lint/test/deploy; reintroduce workflows as needed.

## 9. Security & Secrets Management
- Keep API keys and service account credentials in environment variables or secret managers (Azure Key Vault, Google Secret Manager).
- Never commit `.env` files with real secrets.

## 10. Next Steps
- Integrate Google Gemini or other LLM services via backend proxy.
- Expand automated tests for frontend components and agent logic.
- Reintroduce observability (Sentry, Azure Monitor) when deploying to production environments.

---
**Export to PDF**
- In VS Code: open this file, use `Markdown: Print to HTML` or `Markdown PDF` extension to export.
- Or with Pandoc:
  ```powershell
  pandoc docs/project-overview.md -o docs/project-overview.pdf
  ```
