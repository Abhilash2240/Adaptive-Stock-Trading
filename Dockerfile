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
FROM node:20-bullseye
WORKDIR /app

# Install Python and pip
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*

# Copy app artifacts and runtime files
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/py ./apps/server/py
COPY --from=builder /app/model.py ./

# Optional: install Python dependencies (numpy, torch CPU build)
# You can comment torch if the free tier storage/memory is constrained
RUN pip3 install --no-cache-dir numpy \
  && pip3 install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch

ENV NODE_ENV=production
ENV PORT=5000
ENV PYTHON_CMD=python3

EXPOSE 5000

CMD ["node", "apps/server/dist/index.js"]


