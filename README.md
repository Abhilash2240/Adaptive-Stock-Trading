# Adaptive-Stock-Trading

## Project layout

- `backend/` - FastAPI backend source and Python runtime files
- `frontend/` - React + Vite frontend source
- `database/` - Local database orchestration files (`docker-compose.yml`)
- `deployment/` - Deployment manifests (`render.yaml`, `vercel.json`, Dockerfiles)

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL (or use Neon cloud - see .env.example)

### Backend setup
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # then fill in your values
python run_server.py        # runs on http://localhost:8001

### Frontend setup
cd frontend
npm install
cp .env.example .env.local  # already correct for local dev
npm run dev                 # runs on http://localhost:5173

### Generate a JWT secret
python -c "import secrets; print(secrets.token_hex(32))"
Copy the output into JWT_SECRET= in backend/.env

### Default credentials (dev)
Register a new account at http://localhost:5173/login
Paper trading mode is enabled by default - no real money.

## Infra commands

- Start local database stack: `docker compose -f database/docker-compose.yml up -d`
- Render blueprint: `deployment/render.yaml`
- Vercel config: `deployment/vercel.json`
