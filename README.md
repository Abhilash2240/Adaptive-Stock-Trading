# Adaptive-Stock-Trading

## Quick start

### Option 1: Automated Setup (Recommended)

**Linux/Mac (Frontend + Backend):**
```bash
./scripts/setup.sh --with-backend
```

**Linux/Mac (Frontend Only):**
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

**Frontend only (no login functionality):**
```bash
npm run dev:frontend
```
The frontend will be available at `http://localhost:5173/`

**Both frontend and backend (full functionality):**
```bash
npm run dev:full
```
- Frontend: `http://localhost:5173/`
- Backend API: `http://localhost:8080/`
- API Docs: `http://localhost:8080/docs`

On Windows you can also run `powershell -ExecutionPolicy Bypass -File scripts/start.ps1` to open dedicated terminals for each process. Stop both servers with `CTRL+C` in their respective windows.

**Note:** The backend is **required** for login functionality. Without it, you'll see connection errors when trying to log in.

## Troubleshooting

**First, try the automated setup script (Option 1 above) if you haven't already!**

### Frontend Issues

If the frontend fails to start:

1. **Install dependencies**: Make sure you run `npm install` to install all required packages
2. **Setup environment files**: Copy `apps/client/.env.example` to `apps/client/.env.local` and `backend/.env.example` to `backend/.env`
3. **Check Node version**: Ensure you're using Node.js v18 or higher (`node --version`)
4. **Clear cache**: If issues persist, delete `node_modules` and `package-lock.json`, then run `npm install` again

To run only the frontend (for development):
```bash
npm run dev:frontend
```

The frontend will be available at `http://localhost:5173/`

### Backend Issues

If you get **"ModuleNotFoundError"** when starting the backend:

1. **Install Python dependencies**:
   ```bash
   pip3 install -r backend/requirements.txt --user
   ```
   Or use the automated setup:
   ```bash
   ./scripts/setup.sh --with-backend
   ```

2. **Use virtual environment (recommended)**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\Activate.ps1
   pip install -r backend/requirements.txt
   ```

### Login Not Working

If login doesn't navigate to the dashboard:

- **Backend must be running!** Login requires the backend API at `http://localhost:8080`
- Start the backend with: `npm run dev:backend` or `npm run dev:full`
- Check the browser console for `ERR_CONNECTION_REFUSED` errors
- Verify backend is running by visiting: `http://localhost:8080/docs`