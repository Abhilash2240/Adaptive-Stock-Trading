# Adaptive-Stock-Trading

## Quick start

### Option 1: Automated Setup (Recommended)

**Linux/Mac:**
```bash
./scripts/setup.sh
```

**Windows:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
```

### Option 2: Manual Setup

1. Install dependencies: `npm install`
2. Copy `backend/.env.example` to `backend/.env`, and `apps/client/.env.example` to `apps/client/.env.local`. Adjust values (API endpoints, Sentry DSN, Polygon keys, etc.).
3. (Optional) Install Python dependencies: 
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows: .\.venv\Scripts\Activate.ps1
   pip install -r backend/requirements.txt
   ```

### Running the Application

Launch both services together: `npm run dev:full`. This wraps the FastAPI backend (`python -m backend.main`) and the Vite frontend (`vite dev`).

On Windows you can also run `powershell -ExecutionPolicy Bypass -File scripts/start.ps1` to open dedicated terminals for each process. Stop both servers with `CTRL+C` in their respective windows.

## Troubleshooting

**First, try the automated setup script (Option 1 above) if you haven't already!**

If the frontend still fails to start:

1. **Install dependencies**: Make sure you run `npm install` to install all required packages
2. **Setup environment files**: Copy `apps/client/.env.example` to `apps/client/.env.local` and `backend/.env.example` to `backend/.env`
3. **Check Node version**: Ensure you're using Node.js v18 or higher (`node --version`)
4. **Clear cache**: If issues persist, delete `node_modules` and `package-lock.json`, then run `npm install` again

To run only the frontend (for development):
```bash
npm run dev:frontend
```

The frontend will be available at `http://localhost:5173/`