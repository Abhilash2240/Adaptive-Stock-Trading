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
- PostgreSQL (or use Neon cloud - see `backend/.env.example`)

### Backend setup
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # authoritative backend configuration
python run_server.py        # runs on http://localhost:8001

### Frontend setup
cd frontend
npm install
cp .env.example .env.local  # frontend Clerk/API configuration
npm run dev                 # runs on http://localhost:5173

### Authentication setup
Authentication uses Clerk's hosted sign-in experience. The frontend calls
`openSignIn` from `frontend/src/App.tsx`; this project does not provide local
`/login` or `/register` routes.

1. Create a Clerk application in the Clerk dashboard.
2. Copy the Clerk publishable key into `frontend/.env.local`:
   ```dotenv
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
   ```
3. Create a JWT template named `backend` in the Clerk dashboard. Configure it
   to issue the claims needed by the backend, including the `role` claim.
4. Create `backend/.env` from `backend/.env.example` and set:
   ```dotenv
   CLERK_SECRET_KEY=sk_test_your_secret_key_here
   CLERK_JWT_TEMPLATE=backend
   CLERK_FRONTEND_API=your-instance.clerk.accounts.dev
   ```
   The backend validates Clerk RS256 tokens through Clerk's JWKS endpoint; no
   locally generated signing secret is required.

On first sign-in, Clerk handles account creation and login. Paper trading is
enabled by default; no real money is used.

## Infra commands

- Start local database stack: `docker compose -f database/docker-compose.yml up -d`
- Render blueprint: `deployment/render.yaml`
- Vercel config: `deployment/vercel.json`
