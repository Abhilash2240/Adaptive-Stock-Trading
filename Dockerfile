# Multi-stage build: build client and server, then run minimal runtime with Python agent

FROM node:20-bullseye AS builder
WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy sources
COPY . .

# Build client into apps/server/dist/public and bundle server
RUN npm run build


# Runtime image with Node + Python + minimal packages
FROM node:20-bullseye AS runtime
WORKDIR /app

# Install Python and pip (needed for small runtime features, but do NOT install heavy ML deps here)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*

# Copy app artifacts and runtime files
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/py ./apps/server/py
COPY --from=builder /app/model.py ./

# Install only lightweight Python deps in the web runtime to keep the image small
RUN pip3 install --no-cache-dir numpy

ENV NODE_ENV=production
ENV PORT=5000
ENV PYTHON_CMD=python3

EXPOSE 5000

# Default command for the web service (no heavy torch installation)
CMD ["node", "apps/server/dist/index.js"]

### Agent runtime target (separate image) - includes heavier ML deps like torch
FROM runtime AS agent-runtime
# Install optional heavier Python deps for agent (torch). This keeps the web image small
RUN pip3 install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch || true

# Expose a different port for the agent worker (if needed)
ENV AGENT_PORT=9001
EXPOSE 9001

# Start a lightweight HTTP wrapper around the agent so Render worker can receive requests
CMD ["python3", "apps/server/py/agent_server.py"]


