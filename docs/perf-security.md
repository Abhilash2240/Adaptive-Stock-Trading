# Performance & Security Monitoring

This repository now ships with automated tooling for dependency auditing, static analysis, and runtime profiling. Use the commands and workflows below to keep the stack healthy.

## Frontend

- **Security audit**: `npm audit --omit=dev`
- **Static analysis**: `npm run lint`
- **Bundle analysis**: `npm run build:analyze`
  - Generates `stats/bundle-report.html` via `rollup-plugin-visualizer`.
- **Lighthouse profiling**: `npm run lighthouse`
  - Reads configuration from `lighthouserc.json` and stores reports in `reports/lighthouse`.
- **Runtime monitoring**: Sentry is automatically initialised when `VITE_SENTRY_DSN` is present; configure sampling via `VITE_SENTRY_TRACES_SAMPLE_RATE` and `VITE_SENTRY_REPLAY_SAMPLE_RATE`.

## Backend

- **Dependency audit**: `python -m pip_audit -r backend/requirements.txt`
- **Static analysis**: `bandit -r backend -x backend/tests -c bandit.yaml`
- **Metrics endpoint**: `/metrics` exposes Prometheus-compatible counters, gauges, and histograms for ingestion by Cloud Monitoring/Ops Agent.

## Load Testing

Run k6 smoke tests against any deployed backend:

```powershell
$env:K6_TARGET="https://staging.api.stocktrade.example.com"
k6 run perf/k6-smoke.js
```

CI automatically picks up `vars.K6_TARGET_URL` (if set) to execute the same script and publishes summaries in the workflow run.

## Continuous Integration

`.github/workflows/ci.yml` now runs audits, linting, Lighthouse, and k6 (when configured) on every main push / release tag, preventing regressions before deploy.
