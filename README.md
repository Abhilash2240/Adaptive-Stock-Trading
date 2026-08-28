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
cp .env.example .env.local  # frontend Auth0/API configuration
npm run dev                 # runs on http://localhost:5173

### Authentication setup
Authentication uses Auth0's hosted Universal Login. The frontend calls
`loginWithRedirect` from `frontend/src/App.tsx`; this project does not provide
local `/login` or `/register` routes.

1. Create an Auth0 application (typically a Single Page Application).
2. Create an Auth0 API and use its identifier as the API audience.
3. In the Auth0 application settings, allow `http://localhost:5173` as an
   allowed callback, logout, and web origin URL.
4. Create `frontend/.env.local` with:
   ```dotenv
   VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com
   VITE_AUTH0_CLIENT_ID=your-auth0-client-id
   VITE_AUTH0_AUDIENCE=https://your-api-identifier
   VITE_AUTH0_REDIRECT_URI=http://localhost:5173
   ```
5. Create `backend/.env` from `backend/.env.example` and set:
   ```dotenv
   AUTH0_DOMAIN=your-tenant.us.auth0.com
   AUTH0_AUDIENCE=https://your-api-identifier
   AUTH0_ROLES_CLAIM=https://yourapp/roles
   ```
6. In the Auth0 tenant, configure a Post-Login Action to write authorization
   roles to the same custom claim namespace:
   ```javascript
   module.exports = async (event, api) => {
     const roles = event.authorization?.roles || [];
     api.idToken.setCustomClaim('https://yourapp/roles', roles);
   };
   ```
   Set `AUTH0_ROLES_CLAIM` to the exact namespace used by that Action. The
   backend validates Auth0 RS256 tokens through the tenant JWKS endpoint; no
   locally generated signing secret is required.

On first sign-in, Auth0 handles account creation and login. Paper trading is
enabled by default; no real money is used.

## Infra commands

- Start local database stack: `docker compose -f database/docker-compose.yml up -d`
- Render blueprint: `deployment/render.yaml`
- Vercel config: `deployment/vercel.json`
