#!/bin/bash

# Setup script for Adaptive Stock Trading platform
# This script installs dependencies and creates environment files
#
# Usage: ./scripts/setup.sh
# Note: If the script is not executable, run: chmod +x scripts/setup.sh

set -e

echo "=== Adaptive Stock Trading Setup ==="
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node --version)
echo "Node.js version: $NODE_VERSION"
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "⚠ Warning: Node.js v18 or higher is recommended. You have $NODE_VERSION"
fi

# Install npm dependencies
echo ""
echo "Installing npm dependencies..."
npm install

# Setup frontend environment file
echo ""
echo "Setting up frontend environment..."
if [ ! -f "apps/client/.env.local" ]; then
    cp apps/client/.env.example apps/client/.env.local
    echo "✓ Created apps/client/.env.local from .env.example"
else
    echo "ℹ apps/client/.env.local already exists"
fi

# Setup backend environment file
echo ""
echo "Setting up backend environment..."
if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    echo "✓ Created backend/.env from .env.example"
else
    echo "ℹ backend/.env already exists"
fi

# Install Python dependencies (optional)
echo ""
echo "Python dependencies setup:"
if [ "$1" = "--with-backend" ] || [ "$1" = "-b" ]; then
    echo "Installing Python backend dependencies..."
    if command -v python3 &> /dev/null; then
        pip3 install -r backend/requirements.txt --user
        echo "✓ Backend dependencies installed"
    else
        echo "⚠ Python3 not found. Skipping backend dependencies."
    fi
else
    echo "ℹ Backend dependencies not installed (use --with-backend to install)"
    echo ""
    echo "To install backend dependencies manually:"
    echo "  pip3 install -r backend/requirements.txt --user"
    echo ""
    echo "Or with a virtual environment (recommended):"
    echo "  python3 -m venv .venv"
    echo "  source .venv/bin/activate      # On Linux/Mac"
    echo "  .venv\\Scripts\\Activate.ps1      # On Windows"
    echo "  pip install -r backend/requirements.txt"
fi

echo ""
echo "=== Setup Complete! ==="
echo ""
echo "To start the frontend only:"
echo "  npm run dev:frontend"
echo ""
echo "To start both frontend and backend:"
echo "  npm run dev:full"
echo ""
echo "Note: Backend requires Python dependencies to be installed"
echo "  Run: ./scripts/setup.sh --with-backend"
echo "  Or:  pip3 install -r backend/requirements.txt --user"
echo ""
echo "The frontend will be available at: http://localhost:5173/"
echo "The backend will be available at: http://localhost:8080/"
