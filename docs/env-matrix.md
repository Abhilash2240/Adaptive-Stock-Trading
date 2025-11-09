# Environment & Secrets Matrix

This matrix captures every runtime configuration value required across staging and production so both environments stay in lockstep. Update this file whenever a new setting is introduced.

| Key | Description | Staging Source | Production Source |
| --- | --- | --- | --- |
| `ENVIRONMENT` | Logical environment label reported by the backend | `.env.staging` → `staging` | `.env.production` → `production` |
| `DATA_PROVIDER` | Quote source (`mock` or `polygon`) | `.env.staging` | `.env.production` |
| `SYMBOLS` | Comma-separated list of allowed ticker enums | `.env.staging` | `.env.production` |
| `MOCK_STREAM_INTERVAL` | Seconds between mock quote emissions | `.env.staging` | `.env.production` |
| `POLYGON_POLL_INTERVAL` | Seconds between Polygon REST polls | `.env.staging` | `.env.production` |
| `POLYGON_API_KEY` | Polygon API access token | GitHub Secret `POLYGON_STAGING_API_KEY` (surfaced into `.env.staging` at deploy time) | GitHub Secret `POLYGON_PROD_API_KEY` (surfaced into `.env.production`) |
| `DATABASE_URL` | Async SQL connection string | GitHub Secret `DB_STAGING_URL` → `.env.staging` | GitHub Secret `DB_PROD_URL` → `.env.production` |
| `FIREBASE_PROJECT_ID` | Firebase project identifier for token validation | `.env.staging` | `.env.production` |
| `FIREBASE_AUTH_AUDIENCE` | Expected Firebase auth audience | `.env.staging` | `.env.production` |
| `PUBSUB_TOPIC` | Optional Pub/Sub topic for streaming | `.env.staging` | `.env.production` |
| `MODEL_BUCKET` | GCS bucket for model artifacts | `.env.staging` | `.env.production` |
| `AGENT_MODEL_NAME` | Default agent checkpoint name | `.env.staging` | `.env.production` |
| `REDIS_URL` | Optional Redis cache endpoint | `.env.staging` (placeholder) | `.env.production` (placeholder) |
| `VITE_API_BASE` | Client HTTP base URL | GitHub Repository Variable `VITE_API_BASE_STAGING` | GitHub Repository Variable `VITE_API_BASE_PRODUCTION` |
| `VITE_WS_URL` | Client WebSocket URL | GitHub Repository Variable `VITE_WS_URL_STAGING` | GitHub Repository Variable `VITE_WS_URL_PRODUCTION` |
| `FIREBASE_PROJECT_ID` | Firebase Hosting project id | GitHub Repository Variable `FIREBASE_PROJECT_ID_STAGING` | GitHub Repository Variable `FIREBASE_PROJECT_ID_PRODUCTION` |
| `FIREBASE_HOSTING_SITE` | Firebase Hosting site id | GitHub Repository Variable `FIREBASE_HOSTING_SITE_STAGING` | GitHub Repository Variable `FIREBASE_HOSTING_SITE_PRODUCTION` |
| `FIREBASE_HOSTING_CHANNEL` | Preview channel used for staging deploys | GitHub Repository Variable `FIREBASE_HOSTING_CHANNEL_STAGING` | `live` (default) |
| `FIREBASE_SERVICE_ACCOUNT` | Base64/JSON service account for hosting deploys | GitHub Secret `FIREBASE_SERVICE_ACCOUNT_STAGING` | GitHub Secret `FIREBASE_SERVICE_ACCOUNT_PRODUCTION` |
| `GCP_PROJECT_ID` | Google Cloud project id used for Cloud Run deploys | GitHub Repository Variable `GCP_PROJECT_ID_STAGING` | GitHub Repository Variable `GCP_PROJECT_ID_PRODUCTION` |
| `CLOUD_RUN_REGION` | Cloud Run region for deployments | GitHub Repository Variable `CLOUD_RUN_REGION_STAGING` | GitHub Repository Variable `CLOUD_RUN_REGION_PRODUCTION` |
| `CLOUD_RUN_SERVICE` | Cloud Run service name | GitHub Repository Variable `CLOUD_RUN_SERVICE_STAGING` | GitHub Repository Variable `CLOUD_RUN_SERVICE_PRODUCTION` |
| `CLOUD_RUN_IMAGE` | Container image deployed to Cloud Run | GitHub Repository Variable `CLOUD_RUN_IMAGE_STAGING` | GitHub Repository Variable `CLOUD_RUN_IMAGE_PRODUCTION` |
| `VITE_SENTRY_DSN` | Frontend Sentry DSN | GitHub Secret `SENTRY_STAGING_DSN` | GitHub Secret `SENTRY_PROD_DSN` |
| `VITE_SENTRY_TRACES_SAMPLE_RATE` | Trace sampling rate for Sentry | GitHub Repository Variable `SENTRY_TRACES_SAMPLE_RATE_STAGING` | GitHub Repository Variable `SENTRY_TRACES_SAMPLE_RATE_PRODUCTION` |
| `VITE_SENTRY_REPLAY_SAMPLE_RATE` | Replay sampling rate for Sentry | GitHub Repository Variable `SENTRY_REPLAY_SAMPLE_RATE_STAGING` | GitHub Repository Variable `SENTRY_REPLAY_SAMPLE_RATE_PRODUCTION` |
| `SLACK_MONITORING_WEBHOOK` | Slack Incoming Webhook for CI telemetry | GitHub Secret `SLACK_MONITORING_WEBHOOK` | GitHub Secret `SLACK_MONITORING_WEBHOOK` |
| `K6_TARGET_URL` | Base URL for performance smoke tests | GitHub Repository Variable `K6_TARGET_URL_STAGING` | GitHub Repository Variable `K6_TARGET_URL_PRODUCTION` |

## Usage Guidance

- **Sample configs**: `.env.staging` and `.env.production` contain structured placeholders mirroring this matrix. Inject sensitive values at deploy-time using GitHub Actions secrets and Firebase/Cloud Run environment managers.
- **CI validation**: The updated CI workflow validates Firebase credentials, Google Cloud deploy settings, and repository variables before attempting an automated deploy. Add new entries to the matrix and workflow guardrails at the same time.
- **Front-end deploys**: Firebase Hosting deploys read `VITE_API_BASE_*` and `VITE_WS_URL_*` variables so staging/production builds stay in sync with the backend endpoints they proxy to.
- **Infrastructure parity**: Cloud Run manifests under `deploy/cloudrun` target a shared container image tag; Firebase rewrites route `/api/**` and `/ws/**` to the matching Cloud Run service in each environment.
- **Service accounts**: The same JSON credentials stored in `FIREBASE_SERVICE_ACCOUNT_*` must possess `Firebase Hosting Admin`, `Cloud Run Admin`, and `Service Account Token Creator` roles to satisfy both Hosting and Cloud Run deploy steps.
- **Observability**: Populate the new Sentry and Slack variables to light up React error capture and CI alert forwarding. Configure Cloud Monitoring to scrape `/metrics` from Cloud Run using the Prometheus exporter enabled in the backend.
