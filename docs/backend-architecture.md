# Backend Redesign Architecture

## Goals
- Replace the Node/Express server with a Python-first backend.
- Support modular packages for API, data ingest, RL agent, and model management.
- Enable real-time market data streaming and tight integration with the RL agent.
- Deploy as a container on Google Cloud Run and interoperate with Firebase Hosting.

## Technology Choices
- **Framework**: FastAPI (ASGI) with Uvicorn workers for HTTP and WebSockets.
- **Language**: Python 3.11.
- **Package Layout**:
  - `packages/api`: FastAPI application, routers, dependency wiring, auth middleware.
  - `packages/data`: Data provider abstraction, live feed consumers, caching utilities.
  - `packages/agent`: RL agent service, action selection, reward processing, lifecycle hooks.
  - `packages/model`: Training pipelines, evaluation jobs, checkpoint management.
  - `packages/shared`: Pydantic schemas, enums, settings objects shared across packages.
- **Data Provider (default)**: Polygon.io streaming API (websocket + REST). Mock adapter included for dev/testing.
- **RL Algorithm (default)**: Proximal Policy Optimization (PPO) implemented with PyTorch.
- **Persistence**: Cloud SQL (Postgres) via SQLAlchemy/SQLModel; Firestore optional for event logging.
- **Pub/Sub**: Google Pub/Sub (optional) or Redis for fan-out of high-frequency updates.
- **Auth**: Firebase Authentication tokens verified in FastAPI (via Google public keys).

## High-Level Architecture
```
+----------------------+      +----------------------+      +----------------------+
|      Frontend        | ---> |  Firebase Hosting    | ---> |  Cloud Run Backend   |
|  (React / SPA build) |      |  (static assets)     |      |  (FastAPI + WebSocket|
+----------------------+      +----------------------+      +----------------------+
                                                                  |          |
                                                                  v          v
                                                         +---------------+  +----------------+
                                                         | Cloud SQL (DB)|  | Cloud Pub/Sub  |
                                                         +---------------+  +----------------+
                                                                  |
                                                                  v
                                                         +------------------+
                                                         | RL Training Jobs |
                                                         | (Cloud Run Jobs) |
                                                         +------------------+
```

## Module Responsibilities
- `packages/api`
  - Initialize FastAPI app (HTTP + WebSocket routes) with lifespan hooks.
  - Register routers: market data, orders, portfolios, agent control, admin.
  - Middleware: Firebase JWT verification, request logging, rate limiting.
  - Background tasks: kick off data streams, schedule agent checkpoints.
- `packages/data`
  - `DataProvider` protocol defining `subscribe_quotes`, `fetch_history`, `fetch_snapshot`.
  - Mock adapter for local random-walk quotes and Polygon adapter that polls the last trade endpoint when an API key is supplied.
  - Cache layer (Redis or in-memory) to buffer latest ticks for fan-out to multiple WebSocket clients.
- `packages/agent`
  - Load PPO policy (PyTorch) and value nets from `packages/model` artifacts.
  - Provide async inference interface for live trading decisions.
  - Manage action throttling, risk guards, warm-up periods, fallback to rule-based logic.
- `packages/model`
  - Training scripts using historical data from Cloud SQL or Cloud Storage.
  - Evaluation harness to score policies before promotion.
  - Artifact registry interface (Cloud Storage bucket) to version checkpoints.
  - CLI utilities invoked by Cloud Run Jobs or GitHub Actions.
- `packages/shared`
  - Pydantic models for quotes, orders, trades, agent actions, training configs.
  - Enum definitions (symbols, order types, agent states).
  - Settings module reading environment variables into structured classes.

## Data Flow
1. **Live Market Feed**: `packages/data` Polygon adapter connects to WebSocket, normalizes ticks, pushes to an internal async queue.
2. **Backend Streaming**: FastAPI WebSocket endpoints broadcast ticks to authenticated clients; the agent subscribes internally.
3. **Agent Decisions**: `packages/agent` consumes tick snapshots, requests latest state from DB, produces actions, optionally writes orders to a paper-trade table.
4. **Persistence**: REST endpoints and agent writes persist to Cloud SQL; derived aggregates stored via background tasks.
5. **Training Loop**: Cloud Run Job triggers `packages/model` training script, reading historical data; on success uploads new checkpoint and notifies main API to reload.

## Deployment Plan
- **Containerization**: Build a Docker image with multi-stage build (poetry/uv pip install, uvicorn start). Store in Artifact Registry.
- **Cloud Run Service**: Deploy as `stocktrade-backend` with minimum instances 1, CPU 1, memory 1Gi; configure secrets via Secret Manager.
- **Cloud Scheduler**: Trigger model training job daily via HTTP call to Cloud Run Job endpoint.
- **Firebase Integration**:
  - Hosting rewrites `api/*` and `ws/*` to Cloud Run backend.
  - Use Firebase Functions (optional) for lightweight triggers or to proxy analytics events.

## Environment Variables
- `POLYGON_API_KEY` (or alternate provider key).
- `DATABASE_URL` (Cloud SQL connection string).
- `FIREBASE_PROJECT_ID`, `FIREBASE_AUTH_AUDIENCE` for JWT validation.
- `PUBSUB_TOPIC` (optional).
- `MODEL_BUCKET` for checkpoint storage.
- `AGENT_MODEL_NAME` default policy identifier.

## Next Steps
1. Scaffold Python project structure with `pyproject.toml`, uv/poetry, and package layout described above.
2. Implement `packages/shared` schemas and settings first (dependency for all other modules).
3. Stub FastAPI application in `packages/api` with health, auth, and market data placeholder routes.
4. Build mock data provider (random walk) to unblock frontend integration while real API keys are provisioned.
5. Migrate existing business logic as needed, aligning database schema with Cloud SQL migration strategy.
6. Set up Dockerfile + GitHub Action to build and deploy to Cloud Run.
7. Document Firebase hosting rewrites and environment configuration.
