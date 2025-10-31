Render deployment notes

This repository now includes two dedicated Dockerfiles and a `render.yaml` which deploys two services to Render:

- `Dockerfile.web` — smaller web image that builds the client and server and installs only lightweight Python deps (no torch). Used by the web service.
- `Dockerfile.agent` — agent worker image that installs heavier ML deps (torch) and runs a persistent in-process agent HTTP server. Used by the worker.

What changed
- Separated web and agent images to keep the web image small and quick to build.
- Added an in-process persistent agent worker (`apps/server/py/agent_server.py`) that imports the agent code and serves an HTTP API. This avoids spawning a subprocess for each request and reduces latency.
- The Node server will prefer calling the agent via HTTP if you set the `AGENT_URL` environment variable (e.g. `http://stocktraderl-agent:9001/` in Render). If `AGENT_URL` is not set, the Node server falls back to spawning the local Python script (for local dev).

Render notes
- `render.yaml` defines two services:
	- `stocktraderl` (web) — uses `Dockerfile.web` and serves your frontend + API on the Render-assigned `PORT`.
	- `stocktraderl-agent` (worker) — uses `Dockerfile.agent` and runs `apps/server/py/agent_server.py` on port `9001`.
- The web service should NOT hardcode `PORT` in `render.yaml`. Render injects `PORT` at runtime and the server reads `process.env.PORT`.
- To have the Node server call the agent worker on Render, set `AGENT_URL` for the web service to the worker's internal address (Render private services or the internal DNS name, e.g. `http://stocktraderl-agent:9001/`).

Local testing
- Build the web image and run locally:

```powershell
# From repo root (Windows PowerShell)
# Build the web image
docker build -t stocktraderl-web -f Dockerfile.web .
# Run the web container (map port 5000 locally):
docker run -p 5000:5000 stocktraderl-web
```

- Build the agent image and run locally:

```powershell
# Build the agent image
docker build -t stocktraderl-agent -f Dockerfile.agent .
# Run the agent worker (map port 9001 locally):
docker run -p 9001:9001 stocktraderl-agent
```

- Run web and agent together locally and point the web app at the agent: set `AGENT_URL` when running the web container.

Troubleshooting
- If the agent image build is slow or large because of `torch`, consider removing or pinning to a smaller CPU-only wheel. The `Dockerfile.agent` installs `torch` with the CPU wheel; adjust as needed for your Render plan.

CI
- A GitHub Actions workflow was added at `.github/workflows/ci.yml` to run `npm ci` and `npm run build` on PRs to `main` to catch build issues early.

Secrets and the Render API key
- Do NOT commit secrets (API keys, tokens) into the repository. Instead set them directly in Render or in GitHub Secrets.
- To set the Render API key for a service:
	1. Open the Render dashboard, go to your service, choose "Environment" -> "Environment Variables" and add a new variable named `RENDER_API_KEY` with the API key value.
	2. For the web service, also set `AGENT_URL` to the internal worker URL (for example `http://stocktraderl-agent:9001/`).

- To add the `RENDER_API_KEY` to GitHub (for use in Actions):
	1. Open the GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret.
	2. Name the secret `RENDER_API_KEY` and paste the key value.

Helper scripts
- This repo includes helper scripts you can run locally to set environment variables on a Render service via the Render API. They do not contain secrets — you must supply your `RENDER_API_KEY` locally.

Linux/macOS (bash):
```bash
# set your API key locally (do not commit)
export RENDER_API_KEY="<YOUR_KEY>"
# run the helper to add AGENT_URL to a service
./.render/set-env.sh <SERVICE_ID> AGENT_URL "http://stocktraderl-agent:9001/"
```

Windows PowerShell:
```powershell
#$env:RENDER_API_KEY = '<YOUR_KEY>'
.\.render\set-env.ps1 -ServiceId '<SERVICE_ID>' -Key 'AGENT_URL' -Value 'http://stocktraderl-agent:9001/'
```

CI usage
- The repository's CI workflow reads secrets from GitHub Actions secrets if you configure them. The workflow does not contain any secret values in the code.

