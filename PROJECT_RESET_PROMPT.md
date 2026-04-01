# Adaptive Stock Trading Platform - Project Reset & Completion Prompt

## Current State Assessment

### Problem Statement
The Adaptive Stock Trading Platform frontend and backend are not meeting expectations. The project has been cluttered with:
- Auth0 authentication logic that needs to be removed
- Complex login flows that are unnecessary for MVP
- UI/UX not leveraging Stitch MCP design system capabilities
- Unclear project direction and unclear work progress

### Objective
Create a **clean, working MVP** of the Adaptive Stock Trading Platform with:
- Functional Dashboard displaying real stock data
- Agent-based trading recommendations
- Portfolio management
- No authentication barriers for initial deployment
- UI built with Stitch MCP design system tokens

---

## Files to Remove

### Frontend Files (Remove Auth/Login)
1. `apps/client/src/pages/login.tsx` - Remove login page
2. `apps/client/src/pages/AuthPage.tsx` - Remove auth page
3. `apps/client/src/contexts/auth-context.tsx` - Remove Auth context provider
4. Auth0 configuration from `apps/client/src/main.tsx`
5. `ProtectedRoute` component from `apps/client/src/App.tsx`
6. `useAuth()` hook usage from all components

### Backend Files (Remove Auth Routes)
1. `backend/packages/api/routes/auth.py` - Remove authentication routes
2. `backend/packages/shared/auth0.py` - Remove Auth0 verification
3. `backend/packages/shared/security.py` - Remove JWT/security (temporarily)
4. `backend/test_security.py` - Remove security tests

---

## Current Changes Made (Session Summary)

### Auth0 Client ID Rotation (Completed but being removed)
- **Previous Client ID**: `UvdY6D16X5Vy4EINgbJFdTzNbiOtKTWz`
- **New Client ID**: `Lyb8MTP0c6Tj6RtpW07tJxaAuJxhm3VS`
- **Status**: Updated in `.env.local`, `.env.production`, and Vercel production
- **Action**: This will be removed as all Auth0 integration is being eliminated

### Deployment Status
- **Frontend**: Deployed to Vercel (https://adaptive-stock-trader-web.vercel.app)
- **Backend**: Paused on Railway
- **Both**: Will be redeployed after cleanup

---

## What User Expects to See (MVP)

### Frontend Requirements
1. **Dashboard Page** - Main landing page showing:
   - Real-time stock quotes (AAPL, MSFT, TSLA)
   - Market metrics
   - Trading signals
   - Agent recommendations
   - No login required

2. **Agent Page** - Agent trading recommendation interface:
   - Current agent status
   - Recommended actions
   - Signal strength indicators

3. **Portfolio Page** - Portfolio management showing:
   - Holdings
   - Performance metrics
   - P&L

4. **Settings Page** - Basic configuration

5. **UI/UX Design**:
   - Use Stitch MCP design system
   - Modern, clean interface
   - Responsive design
   - Proper color palette, typography, spacing

### Backend Requirements
1. **Health Endpoints**:
   - `GET /health/live` - Liveness probe
   - `GET /health/ready` - Readiness probe

2. **Quote API**:
   - `GET /api/quote?symbol=AAPL` - Get stock quotes
   - Real-time data from TwelveData API

3. **Agent Service**:
   - `GET /agent/status` - Agent status without auth
   - `POST /agent/action` - Execute agent recommendations

4. **Portfolio API**:
   - `GET /portfolio` - Get portfolio data
   - `POST /portfolio/trade` - Execute trades

5. **Settings API**:
   - `GET /settings` - Get user settings
   - `POST /settings` - Update settings

---

## Next Steps (For ChatGPT or Continuation)

### Phase 1: Cleanup (Remove Auth)
1. Delete all listed auth/login files
2. Remove Auth0Provider from `main.tsx`
3. Remove ProtectedRoute logic from `App.tsx`
4. Remove JWT verification from API routes
5. Update `.env.local` and `.env.production` (remove AUTH0 vars)
6. Remove Auth0 environment variables from Vercel

### Phase 2: Implement Core Features
1. **Create simple Dashboard page** - displaying stock data
2. **Design with Stitch MCP** - apply design tokens to all components
3. **Backend data endpoints** - ensure `/api/quote`, `/portfolio`, `/settings` work
4. **Agent integration** - wire agent service to frontend
5. **Fix any 403/401 errors** - remove auth checks

### Phase 3: Deploy & Test
1. Build frontend: `npm run build`
2. Deploy frontend: `npx vercel --prod --yes`
3. Deploy backend: `npx @railway/cli up --service backend-api --detach`
4. Verify:
   - Frontend loads without login
   - API endpoints respond
   - Stock data displays
   - Agent shows recommendations

---

## Key Configuration to Update

### Frontend `.env.production` (Remove Auth0)
```
VITE_API_BASE=https://backend-api-production-381c.up.railway.app
VITE_WS_URL=wss://backend-api-production-381c.up.railway.app  
```
(Remove all `VITE_AUTH0_*` variables)

### Frontend `.env.local` (Remove Auth0)
```
VITE_API_BASE=http://localhost:8001
VITE_WS_URL=ws://localhost:8001
```
(Remove all `VITE_AUTH0_*` variables)

### Backend Environment Variables (Remove JWT/Auth0)
- Keep: `DATABASE_URL`, `TWELVEDATA_API_KEY`, `PORT`, `SYMBOLS`, `ALLOWED_ORIGINS`
- Remove: `JWT_SECRET` (temporarily, for initial MVP)

---

## API Endpoints to Verify After Cleanup

```bash
# Backend health
GET https://backend-api-production-381c.up.railway.app/health/live
GET https://backend-api-production-381c.up.railway.app/health/ready

# Stock quotes (no auth required)
GET https://backend-api-production-381c.up.railway.app/api/quote?symbol=AAPL

# Portfolio (no auth required initially)
GET https://backend-api-production-381c.up.railway.app/portfolio

# Agent status (no auth required)
GET https://backend-api-production-381c.up.railway.app/agent/status

# Frontend loads without login
GET https://adaptive-stock-trader-web.vercel.app
```

---

## Design System (Stitch MCP) Implementation

### What Should Be Applied
1. **Color Palette**: Primary colors, secondary colors, accents from design system
2. **Typography**: Font family (Inter/Roboto), sizes, weights
3. **Spacing**: Consistent padding/margins based on design tokens
4. **Components**: Buttons, cards, inputs using design system specs
5. **Light/Dark Mode**: If applicable per design system

### Where to Implement
- All pages (Dashboard, Agent, Portfolio, Settings)
- All UI components in `src/components/`
- Form inputs, buttons, cards

---

## Success Criteria

- ✅ No login page required to view frontend
- ✅ Frontend loads and displays stock data
- ✅ Backend endpoints respond without authentication
- ✅ Agent recommendations visible on frontend
- ✅ Portfolio displays user holdings
- ✅ UI follows Stitch MCP design system
- ✅ Both frontend and backend deployed and working
- ✅ No 401/403 authentication errors in console

---

## Deployment Commands

```bash
# Frontend
npm run build
npx vercel --prod --yes

# Backend (from backend directory)
npx @railway/cli up --service backend-api --detach

# Verify
curl https://backend-api-production-381c.up.railway.app/health/live
curl https://adaptive-stock-trader-web.vercel.app
```

---

## Additional Notes

- This MVP prioritizes **functionality over security** for initial deployment
- Authentication can be re-added in Phase 2 if needed
- Focus on **clear data flows** and **user-visible features**
- Use Stitch MCP to ensure **professional UI/UX**
- Keep API responses **simple and predictable** for frontend integration
