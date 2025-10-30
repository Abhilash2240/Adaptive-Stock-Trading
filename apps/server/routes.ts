// Reference: javascript_websocket blueprint for WebSocket setup
import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { runAgentCommand, runAgentQuote } from "./agent";
import { analyzeSentiment } from "./gemini";
import { 
  insertPortfolioSchema,
  insertPositionSchema,
  insertModelSchema,
  insertTrainingJobSchema,
  insertBacktestSchema,
  insertTradeSchema,
  insertPaperTradingSessionSchema,
  insertSettingsSchema 
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Portfolio endpoints
  app.get("/api/portfolios", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const portfolios = await storage.getPortfoliosByUser(userId);
      res.json(portfolios);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/portfolios/:id", async (req, res) => {
    try {
      const portfolio = await storage.getPortfolio(req.params.id);
      if (!portfolio) {
        return res.status(404).json({ error: "Portfolio not found" });
      }
      res.json(portfolio);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/portfolios", async (req, res) => {
    try {
      const validated = insertPortfolioSchema.parse(req.body);
      const portfolio = await storage.createPortfolio(validated);
      res.status(201).json(portfolio);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/portfolios/:id", async (req, res) => {
    try {
      const portfolio = await storage.updatePortfolio(req.params.id, req.body);
      if (!portfolio) {
        return res.status(404).json({ error: "Portfolio not found" });
      }
      res.json(portfolio);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Position endpoints
  app.get("/api/portfolios/:portfolioId/positions", async (req, res) => {
    try {
      const positions = await storage.getPositionsByPortfolio(req.params.portfolioId);
      res.json(positions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/positions", async (req, res) => {
    try {
      const validated = insertPositionSchema.parse(req.body);
      const position = await storage.createPosition(validated);
      res.status(201).json(position);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Model endpoints
  app.get("/api/models", async (req, res) => {
    try {
      const models = await storage.getAllModels();
      res.json(models);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/models/:id", async (req, res) => {
    try {
      const model = await storage.getModel(req.params.id);
      if (!model) {
        return res.status(404).json({ error: "Model not found" });
      }
      res.json(model);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/models", async (req, res) => {
    try {
      const validated = insertModelSchema.parse(req.body);
      const model = await storage.createModel(validated);
      res.status(201).json(model);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Training job endpoints
  app.get("/api/training/:id", async (req, res) => {
    try {
      const job = await storage.getTrainingJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Training job not found" });
      }
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/training", async (req, res) => {
    try {
      const validated = insertTrainingJobSchema.parse(req.body);
      const job = await storage.createTrainingJob(validated);
      
      // Simulate training job start
      setTimeout(async () => {
        await storage.updateTrainingJob(job.id, {
          status: "running",
          startedAt: new Date(),
          progress: 0,
        });
        
        // Broadcast to WebSocket clients
        broadcastToClients({
          type: "training_started",
          data: { jobId: job.id },
        });
      }, 100);
      
      res.status(201).json(job);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/training/:id", async (req, res) => {
    try {
      const job = await storage.updateTrainingJob(req.params.id, req.body);
      if (!job) {
        return res.status(404).json({ error: "Training job not found" });
      }
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Backtest endpoints
  app.get("/api/backtests", async (req, res) => {
    try {
      const backtests = await storage.getAllBacktests();
      res.json(backtests);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/backtests/:id", async (req, res) => {
    try {
      const backtest = await storage.getBacktest(req.params.id);
      if (!backtest) {
        return res.status(404).json({ error: "Backtest not found" });
      }
      res.json(backtest);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/backtests", async (req, res) => {
    try {
      const validated = insertBacktestSchema.parse(req.body);
      const backtest = await storage.createBacktest(validated);
      
      // Simulate backtest execution
      setTimeout(async () => {
        await storage.updateBacktest(backtest.id, {
          status: "running",
        });
        
        // Simulate completion after delay
        setTimeout(async () => {
          const mockResults = {
            cagr: 32.5,
            sharpe: 1.85,
            sortino: 2.15,
            maxDrawdown: -8.2,
            winRate: 68.5,
            totalTrades: 156,
            avgPnl: 425.80,
            equityCurve: [],
          };
          
          await storage.updateBacktest(backtest.id, {
            status: "completed",
            results: mockResults,
            completedAt: new Date(),
          });
          
          broadcastToClients({
            type: "backtest_completed",
            data: { backtestId: backtest.id, results: mockResults },
          });
        }, 5000);
      }, 100);
      
      res.status(201).json(backtest);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Trade endpoints
  app.get("/api/portfolios/:portfolioId/trades", async (req, res) => {
    try {
      const trades = await storage.getTradesByPortfolio(req.params.portfolioId);
      res.json(trades);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/backtests/:backtestId/trades", async (req, res) => {
    try {
      const trades = await storage.getTradesByBacktest(req.params.backtestId);
      res.json(trades);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/trades", async (req, res) => {
    try {
      const validated = insertTradeSchema.parse(req.body);
      const trade = await storage.createTrade(validated);
      
      // Broadcast trade execution
      broadcastToClients({
        type: "trade_executed",
        data: trade,
      });
      
      res.status(201).json(trade);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Paper trading session endpoints
  app.get("/api/paper-trading/active", async (req, res) => {
    try {
      const sessions = await storage.getActivePaperTradingSessions();
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/paper-trading/:id", async (req, res) => {
    try {
      const session = await storage.getPaperTradingSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Paper trading session not found" });
      }
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/paper-trading", async (req, res) => {
    try {
      const validated = insertPaperTradingSessionSchema.parse(req.body);
      const session = await storage.createPaperTradingSession(validated);
      
      // Start simulated paper trading
      broadcastToClients({
        type: "paper_trading_started",
        data: { sessionId: session.id },
      });
      
      res.status(201).json(session);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/paper-trading/:id", async (req, res) => {
    try {
      const session = await storage.updatePaperTradingSession(req.params.id, req.body);
      if (!session) {
        return res.status(404).json({ error: "Paper trading session not found" });
      }
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Settings endpoints
  app.get("/api/settings", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const userSettings = await storage.getSettings(userId);
      if (!userSettings) {
        return res.status(404).json({ error: "Settings not found" });
      }
      res.json(userSettings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const validated = insertSettingsSchema.parse(req.body);
      const userSettings = await storage.createOrUpdateSettings(validated);
      res.json(userSettings);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Sentiment analysis endpoint
  app.post("/api/sentiment", async (req, res) => {
    try {
      const { ticker, text } = req.body;
      if (!ticker || !text) {
        return res.status(400).json({ error: "ticker and text are required" });
      }
      
      const sentiment = await analyzeSentiment(text, ticker);
      res.json(sentiment);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Agent action endpoint (simulated RL agent decision)
  app.post("/api/agent/step", async (req, res) => {
    try {
      const { state, explore = true } = req.body;
      if (!Array.isArray(state)) return res.status(400).json({ error: "state array is required" });

      const response = await runAgentCommand<{ action: number; q_values: number[] }>({ type: "step", state, explore });
      if (!response.ok) return res.status(500).json({ error: response.error || "agent error" });

      res.json(response.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Agent training endpoint
  app.post("/api/agent/train", async (req, res) => {
    try {
      const { transitions, epochs = 1, savePath } = req.body;
      if (!Array.isArray(transitions) || transitions.length === 0) {
        return res.status(400).json({ error: "transitions[] is required" });
      }

      const response = await runAgentCommand<{ epochs: number; avg_loss: number; steps: number; saved?: string }>(
        { type: "train", transitions, epochs, savePath }
      );
      if (!response.ok) return res.status(500).json({ error: response.error || "agent error" });
      res.json(response.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Agent test/inference on a batch of states for evaluation
  app.post("/api/agent/test", async (req, res) => {
    try {
      const { states } = req.body;
      if (!Array.isArray(states) || states.length === 0) {
        return res.status(400).json({ error: "states[][] is required" });
      }

      const response = await runAgentCommand<{ actions: number[]; q_values: number[][] }>({ type: "test", states });
      if (!response.ok) return res.status(500).json({ error: response.error || "agent error" });
      res.json(response.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Real-time stock quote endpoint
  app.get("/api/quote", async (req, res) => {
    try {
      const symbol = (req.query.symbol as string)?.toUpperCase();
      if (!symbol) return res.status(400).json({ error: "Required: symbol query param" });
      const response = await runAgentQuote(symbol);
      if (!response.ok) return res.status(404).json({ error: response.error || "not found" });
      return res.json(response.data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server setup - on distinct path to avoid conflicts with Vite HMR
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  const clients = new Set<WebSocket>();

  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');
    clients.add(ws);

    ws.on('message', (message: string) => {
      console.log('Received:', message.toString());
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      clients.delete(ws);
    });

    // Send welcome message
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'WebSocket connected successfully',
        timestamp: new Date().toISOString(),
      }));
    }
  });

  // Helper function to broadcast to all clients
  function broadcastToClients(data: any) {
    const message = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Simulate periodic updates for demo purposes
  setInterval(() => {
    broadcastToClients({
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
      activeClients: clients.size,
    });
  }, 30000); // Every 30 seconds

  return httpServer;
}
