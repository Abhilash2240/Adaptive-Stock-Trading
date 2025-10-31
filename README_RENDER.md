Render deployment notes

This repository is configured to deploy to Render using the included `Dockerfile` and `render.yaml`.

What the Dockerfile does
- Builds the monorepo using `npm ci` and `npm run build` (root package.json).
- Builds the client with Vite and bundles the server with esbuild into `apps/server/dist`.
- Installs Python and required Python dependencies (numpy, torch CPU wheel) in the runtime image so the RL agent files under `apps/server/py` and `model.py` can be used.
- Runs `node apps/server/dist/index.js` as the container CMD.

Key Render notes
- `render.yaml` is configured to use Docker (env: docker) and points to `./Dockerfile`.
- Do NOT hardcode `PORT` in `render.yaml`. Render injects a `PORT` environment variable at runtime and the server reads `process.env.PORT` (defaults to 5000 locally).
- If you need a database, add `DATABASE_URL` (or other environment variables) in the Render dashboard or in `render.yaml` (commented example present).

How to deploy manually on Render
1. Push your branch to GitHub (this repo).
2. In the Render dashboard, create a new Web Service and connect the GitHub repo.
3. Select "Docker" as the environment type and ensure the path to the dockerfile is `./Dockerfile` (Render will detect `render.yaml` if in repo root).
4. Ensure `autoDeploy` is enabled (or deploy manually).

Troubleshooting
- Build fails with Python/torch wheel size: Render free tier has image size limits; consider removing torch installation in the Dockerfile or using a smaller Python dependency set.
- If your build needs private package registry access, ensure `npm` authentication is provided via Render's environment or build environment variables.

Local testing
- To build locally (Linux or WSL recommended):

```powershell
# From repo root (Windows PowerShell)
# Build the Docker image (may take several minutes):
docker build -t stocktraderl:local .
# Run the container (map port 5000 locally):
docker run -p 5000:5000 stocktraderl:local
```

- Then open http://localhost:5000 to verify the app.
