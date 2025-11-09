# Pre-Deployment Review (2025-11-09)

## Checks Performed

- **Frontend build & type check**: `npm run build` and `npm run check` succeed (warnings: outdated Browserslist data, PostCSS plugin missing `from` option, large bundle size >500 kB).
- **Dependency audit**: Frontend bumped to Vite 7.2.2, `@vitejs/plugin-react` 5.1, Tailwind toolchain updates, and the esbuild override removed. `npm install` and `npm audit` now show **0 vulnerabilities** with the refreshed lockfile. Backend FastAPI remains on `0.121.1` (`starlette 0.49.3`), and the Python 3.11 venv now applies the following patches before auditing cleanly: `torch 2.8.0`, `certifi 2025.10.5`, `urllib3 2.5.0`, `polygon-api-client 1.16.3`, and `websockets 15.0.1`. `pip-audit -r backend/requirements.txt` now reports **0 vulnerabilities**—validate Polygon streaming and FastAPI WebSocket handling against the upgraded client/runtime.
- **Backend regression checks**: `pytest backend/tests/test_polygon_websocket.py` covers the FastAPI WebSocket flow with a stubbed Polygon provider on websockets 15.0.1, and `python model.py` exercises the DDQN agent with torch 2.8.0 (warnings limited to known Pydantic deprecations).
- **Environment matrix**: `.env.staging`, `.env.production`, and `docs/env-matrix.md` enumerate every runtime variable plus GitHub/Firebase secrets for staging vs production. Firebase Hosting config and Cloud Run manifests under `deploy/` reference shared image tags so both environments share identical runtime knobs.
- **Repository scan**: no `.env` or secrets committed. Backend configuration relies on environment variables via `pydantic-settings`.

## Gaps Requiring Attention

| Area | Issue | Suggested Action |
| --- | --- | --- |
| Automated testing | No unit/integration tests or CI workflows detected for frontend/back-end | Implement Jest/React Testing Library or Vitest for client; pytest for FastAPI; wire into GitHub Actions with lint/build/audit steps |
| Dependency health | Frontend now on Vite 7/Tailwind toolchain without overrides; backend runtime recently repinned to `torch 2.8.0`, `certifi 2025.10.5`, `urllib3 2.5.0`, `polygon-api-client 1.16.3`, `websockets 15.0.1` | Execute regression tests for model training/inference and Polygon streaming, monitor for runtime regressions, and continue staged frontend upgrades (React/TanStack/Radix) |
| Environment parity | Sample `.env.*` files, Firebase Hosting config, and Cloud Run manifests now exist; values still require population with live secrets | Populate secrets referenced in `docs/env-matrix.md`, align Firebase site/project ids, and automate drift detection |
| Database migrations | SQLModel used but no migration tooling/scripts | Introduce Alembic (or SQLModel migrations), generate baseline revisions, and test upgrade/rollback |
| Secrets management | Process undocumented | Provide `.env.example`, confirm secret manager usage, and document required variables |
| Performance & security | Lighthouse/k6 automation newly scaffolded; requires tuning thresholds | Review generated reports after each CI run, raise budgets gradually, extend to full DAST (OWASP ZAP) |
| Backups & rollback | No evidence of policies | Coordinate with ops to confirm automated backups & rehearse rollback plan |
| Monitoring & alerting | Prometheus `/metrics`, frontend Sentry hooks, and GCP dashboard templates added; alert routing not yet activated | Deploy `monitoring/` configs to Cloud Monitoring and plug PagerDuty/Slack targets |
| Documentation | Missing deployment runbook, contact matrix, communication plan | Draft deployment guide with steps, environment matrix, owners, rollback procedures, stakeholder notifications |
| Post-deploy practices | No automated smoke tests or review cadence | Add post-deploy smoke tests, error budget tracking, and schedule post-release review |

## Recommended Next Steps for the Team

1. Stand up CI pipelines to run lint, build, tests, and security checks on every change.
2. Resolve dependency advisories and capture npm/Poetry lockfiles; add recurring security audits.
3. Produce and socialize a deployment runbook covering environments, migrations, secrets, monitoring, comms, rollback, and post-deploy review.
