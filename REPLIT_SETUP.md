# Running on Replit

This guide will help you set up and run the Adaptive Stock Trading application on Replit.

## Quick Start

1. **Fork/Import the Repository**
   - Open this repository in Replit
   - Replit will automatically detect the `.replit` configuration

2. **Install Dependencies**
   - Click the "Run" button or press `Ctrl+Enter`
   - Replit will automatically:
     - Install Python dependencies from `requirements.txt`
     - Install Node.js dependencies from `package.json`
     - Start the development server

3. **Access the Application**
   - The app will be available at the Replit webview URL
   - Default port: 5000

## Environment Variables (Optional)

Create a `.env` file or use Replit's Secrets tab to configure:

```bash
# Database (Optional - uses in-memory storage if not set)
DATABASE_URL=your_postgres_connection_string

# Google API (Optional - for additional stock data sources)
GOOGLE_API_KEY=your_google_api_key

# Agent Configuration (Optional)
AGENT_STATE_DIM=100
AGENT_ACTION_DIM=5
AGENT_CHECKPOINT=path/to/checkpoint

# Server
PORT=5000
NODE_ENV=development
```

## Features Available on Replit

✅ **Full-stack Application**
- React frontend with Vite
- Express backend API
- WebSocket real-time updates
- RL agent integration

✅ **Python RL Agent**
- PyTorch-based Double DQN
- Stock quote fetching (Yahoo Finance)
- Training and inference

✅ **Database Support**
- PostgreSQL (if DATABASE_URL is set)
- In-memory storage (fallback)

## Development

### Run Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Start Production Server
```bash
npm run start
```

## Troubleshooting

### Python Dependencies
If Python packages fail to install:
```bash
pip install -r requirements.txt
```

### Node Dependencies
If Node modules fail to install:
```bash
npm install
```

### Port Issues
The application runs on port 5000 by default. Replit automatically maps this to port 80 for external access.

### Database Connection
If you don't have a database configured, the app will use in-memory storage. This works fine for testing but data won't persist between restarts.

## Python Dependencies

The following Python packages are required:
- `torch` - PyTorch for deep learning
- `numpy` - Numerical computing
- `yfinance` - Yahoo Finance API for stock quotes
- `requests` - HTTP library for API calls

## Node.js Dependencies

All Node.js dependencies are listed in `package.json` and will be installed automatically.

## Support

For issues or questions:
1. Check the main README.md for general documentation
2. Review the code in `apps/server/` for backend details
3. Check `apps/client/` for frontend implementation

---

**Note**: This is an educational platform. Not investment advice.
