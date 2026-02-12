#!/bin/bash

# Setup script for Adaptive Stock Trading platform
# This script installs dependencies and creates environment files

set -e

echo "=== Adaptive Stock Trading Setup ==="
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node --version)
echo "Node.js version: $NODE_VERSION"

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
echo "Python dependencies setup (optional):"
echo "To install backend dependencies, run:"
echo "  pip install -r backend/requirements.txt"
echo "Or create a virtual environment:"
echo "  python3 -m venv .venv"
echo "  source .venv/bin/activate"
echo "  pip install -r backend/requirements.txt"

echo ""
echo "=== Setup Complete! ==="
echo ""
echo "To start the frontend only:"
echo "  npm run dev:frontend"
echo ""
echo "To start both frontend and backend:"
echo "  npm run dev:full"
echo ""
echo "The frontend will be available at: http://localhost:5173/"
