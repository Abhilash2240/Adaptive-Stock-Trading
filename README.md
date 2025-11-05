# Adaptive-Stock-Trading

An adaptive stock trading system using Deep Reinforcement Learning (Double DQN) with real-time portfolio management and paper trading capabilities.

## Features

- 🤖 **Deep Reinforcement Learning**: Double DQN agent for adaptive trading strategies
- 📊 **Real-time Portfolio Management**: Track positions, trades, and performance metrics
- 📈 **Backtesting**: Test strategies against historical data
- 🎯 **Paper Trading**: Simulate live trading without risk
- 🧠 **AI Integration**: Gemini AI for sentiment analysis
- 📉 **Performance Analytics**: Sharpe ratio, max drawdown, CAGR calculations
- 🎨 **Modern UI**: React-based dashboard with real-time updates

## Quick Start

### Prerequisites

- Node.js 20+ 
- PostgreSQL 16+ (or Neon serverless PostgreSQL)
- Python 3.12+ (for training models)

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Abhilash2240/Adaptive-Stock-Trading.git
   cd Adaptive-Stock-Trading
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up PostgreSQL**
   
   Start PostgreSQL (if not already running):
   ```bash
   # On Ubuntu/Debian
   sudo service postgresql start
   
   # On macOS (with Homebrew)
   brew services start postgresql
   ```
   
   Create a database and user:
   ```bash
   sudo -u postgres psql
   ```
   
   In the PostgreSQL prompt:
   ```sql
   CREATE DATABASE stocktrading;
   CREATE USER stockuser WITH PASSWORD 'stockpass';
   GRANT ALL PRIVILEGES ON DATABASE stocktrading TO stockuser;
   \c stocktrading
   GRANT ALL ON SCHEMA public TO stockuser;
   \q
   ```

4. **Configure environment variables**
   
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set your database connection:
   ```
   DATABASE_URL=postgresql://stockuser:stockpass@localhost:5432/stocktrading
   ```

5. **Push database schema**
   ```bash
   npm run db:push
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```
   
   The application will be available at `http://localhost:5000`

### Production Build

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Start the production server**
   ```bash
   npm start
   ```

## Database Setup

### Using Local PostgreSQL

Follow the steps in the Quick Start guide above.

### Using Neon Serverless PostgreSQL

1. Create a Neon database at [neon.tech](https://neon.tech)
2. Copy the connection string
3. Set it in your `.env` file:
   ```
   DATABASE_URL=postgresql://user:password@ep-xxx.region.neon.tech/database?sslmode=require
   ```
4. Run `npm run db:push` to create tables

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run check` - Run TypeScript type checking
- `npm run db:push` - Push database schema to PostgreSQL

## Architecture

### Frontend
- **React 18** with TypeScript
- **TailwindCSS** for styling
- **Recharts** for data visualization
- **WebSocket** for real-time updates

### Backend
- **Express.js** server
- **Drizzle ORM** for database operations
- **PostgreSQL** for data persistence
- **Python** for RL model training

### Machine Learning
- **PyTorch** for deep learning
- **Double DQN** algorithm
- **Experience replay** and target networks
- **Custom trading environment**

## Project Structure

```
.
├── apps/
│   ├── client/          # React frontend
│   │   └── src/
│   ├── server/          # Express backend
│   │   ├── index.ts
│   │   ├── routes.ts
│   │   ├── db.ts
│   │   └── py/          # Python services
│   └── ...
├── packages/
│   └── shared/          # Shared types and schemas
│       └── src/
│           └── schema.ts
├── model.py             # RL agent implementation
├── package.json
└── .env.example
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run type checking: `npm run check`
5. Submit a pull request

## Deployment

See [README_RENDER.md](./README_RENDER.md) for detailed deployment instructions for Render and other platforms.

## License

MIT

## Disclaimer

**Educational & Research Platform.** Not Investment Advice. Past Performance ≠ Future Results.
