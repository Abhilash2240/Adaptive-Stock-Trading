// Reference: javascript_database blueprint
import {
  users,
  portfolios,
  positions,
  models,
  trainingJobs,
  backtests,
  trades,
  paperTradingSessions,
  settings,
  type User,
  type InsertUser,
  type Portfolio,
  type InsertPortfolio,
  type Position,
  type InsertPosition,
  type Model,
  type InsertModel,
  type TrainingJob,
  type InsertTrainingJob,
  type Backtest,
  type InsertBacktest,
  type Trade,
  type InsertTrade,
  type PaperTradingSession,
  type InsertPaperTradingSession,
  type Settings,
  type InsertSettings,
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

let useDb = true;
try {
  if (!process.env.DATABASE_URL) useDb = false;
} catch {
  useDb = false;
}

// Lazy load db module
let dbInstance: any = null;
async function getDb() {
  if (!useDb) return null;
  if (!dbInstance) {
    const dbModule = await import("./db");
    dbInstance = dbModule.db;
  }
  return dbInstance;
}

const db = await getDb();

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Portfolio operations
  getPortfolio(id: string): Promise<Portfolio | undefined>;
  getPortfoliosByUser(userId: string): Promise<Portfolio[]>;
  createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio>;
  updatePortfolio(id: string, updates: Partial<Portfolio>): Promise<Portfolio | undefined>;

  // Position operations
  getPositionsByPortfolio(portfolioId: string): Promise<Position[]>;
  createPosition(position: InsertPosition): Promise<Position>;
  updatePosition(id: string, updates: Partial<Position>): Promise<Position | undefined>;

  // Model operations
  getModel(id: string): Promise<Model | undefined>;
  getAllModels(): Promise<Model[]>;
  createModel(model: InsertModel): Promise<Model>;
  updateModel(id: string, updates: Partial<Model>): Promise<Model | undefined>;

  // Training job operations
  getTrainingJob(id: string): Promise<TrainingJob | undefined>;
  getTrainingJobsByModel(modelId: string): Promise<TrainingJob[]>;
  createTrainingJob(job: InsertTrainingJob): Promise<TrainingJob>;
  updateTrainingJob(id: string, updates: Partial<TrainingJob>): Promise<TrainingJob | undefined>;

  // Backtest operations
  getBacktest(id: string): Promise<Backtest | undefined>;
  getAllBacktests(): Promise<Backtest[]>;
  createBacktest(backtest: InsertBacktest): Promise<Backtest>;
  updateBacktest(id: string, updates: Partial<Backtest>): Promise<Backtest | undefined>;

  // Trade operations
  getTradesByPortfolio(portfolioId: string): Promise<Trade[]>;
  getTradesByBacktest(backtestId: string): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;

  // Paper trading session operations
  getPaperTradingSession(id: string): Promise<PaperTradingSession | undefined>;
  getActivePaperTradingSessions(): Promise<PaperTradingSession[]>;
  createPaperTradingSession(session: InsertPaperTradingSession): Promise<PaperTradingSession>;
  updatePaperTradingSession(id: string, updates: Partial<PaperTradingSession>): Promise<PaperTradingSession | undefined>;

  // Settings operations
  getSettings(userId: string): Promise<Settings | undefined>;
  createOrUpdateSettings(settings: InsertSettings): Promise<Settings>;
}

class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Portfolio operations
  async getPortfolio(id: string): Promise<Portfolio | undefined> {
    const [portfolio] = await db.select().from(portfolios).where(eq(portfolios.id, id));
    return portfolio || undefined;
  }

  async getPortfoliosByUser(userId: string): Promise<Portfolio[]> {
    return await db.select().from(portfolios).where(eq(portfolios.userId, userId)).orderBy(desc(portfolios.createdAt));
  }

  async createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio> {
    const [created] = await db.insert(portfolios).values(portfolio).returning();
    return created;
  }

  async updatePortfolio(id: string, updates: Partial<Portfolio>): Promise<Portfolio | undefined> {
    const [updated] = await db.update(portfolios).set({ ...updates, updatedAt: new Date() }).where(eq(portfolios.id, id)).returning();
    return updated || undefined;
  }

  // Position operations
  async getPositionsByPortfolio(portfolioId: string): Promise<Position[]> {
    return await db.select().from(positions).where(eq(positions.portfolioId, portfolioId)).orderBy(desc(positions.updatedAt));
  }

  async createPosition(position: InsertPosition): Promise<Position> {
    const [created] = await db.insert(positions).values(position).returning();
    return created;
  }

  async updatePosition(id: string, updates: Partial<Position>): Promise<Position | undefined> {
    const [updated] = await db.update(positions).set({ ...updates, updatedAt: new Date() }).where(eq(positions.id, id)).returning();
    return updated || undefined;
  }

  // Model operations
  async getModel(id: string): Promise<Model | undefined> {
    const [model] = await db.select().from(models).where(eq(models.id, id));
    return model || undefined;
  }

  async getAllModels(): Promise<Model[]> {
    return await db.select().from(models).orderBy(desc(models.createdAt));
  }

  async createModel(model: InsertModel): Promise<Model> {
    const [created] = await db.insert(models).values(model).returning();
    return created;
  }

  async updateModel(id: string, updates: Partial<Model>): Promise<Model | undefined> {
    const [updated] = await db.update(models).set({ ...updates, updatedAt: new Date() }).where(eq(models.id, id)).returning();
    return updated || undefined;
  }

  // Training job operations
  async getTrainingJob(id: string): Promise<TrainingJob | undefined> {
    const [job] = await db.select().from(trainingJobs).where(eq(trainingJobs.id, id));
    return job || undefined;
  }

  async getTrainingJobsByModel(modelId: string): Promise<TrainingJob[]> {
    return await db.select().from(trainingJobs).where(eq(trainingJobs.modelId, modelId)).orderBy(desc(trainingJobs.createdAt));
  }

  async createTrainingJob(job: InsertTrainingJob): Promise<TrainingJob> {
    const [created] = await db.insert(trainingJobs).values(job).returning();
    return created;
  }

  async updateTrainingJob(id: string, updates: Partial<TrainingJob>): Promise<TrainingJob | undefined> {
    const [updated] = await db.update(trainingJobs).set(updates).where(eq(trainingJobs.id, id)).returning();
    return updated || undefined;
  }

  // Backtest operations
  async getBacktest(id: string): Promise<Backtest | undefined> {
    const [backtest] = await db.select().from(backtests).where(eq(backtests.id, id));
    return backtest || undefined;
  }

  async getAllBacktests(): Promise<Backtest[]> {
    return await db.select().from(backtests).orderBy(desc(backtests.createdAt));
  }

  async createBacktest(backtest: InsertBacktest): Promise<Backtest> {
    const [created] = await db.insert(backtests).values(backtest).returning();
    return created;
  }

  async updateBacktest(id: string, updates: Partial<Backtest>): Promise<Backtest | undefined> {
    const [updated] = await db.update(backtests).set(updates).where(eq(backtests.id, id)).returning();
    return updated || undefined;
  }

  // Trade operations
  async getTradesByPortfolio(portfolioId: string): Promise<Trade[]> {
    return await db.select().from(trades).where(eq(trades.portfolioId, portfolioId)).orderBy(desc(trades.executedAt));
  }

  async getTradesByBacktest(backtestId: string): Promise<Trade[]> {
    return await db.select().from(trades).where(eq(trades.backtestId, backtestId)).orderBy(desc(trades.executedAt));
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const [created] = await db.insert(trades).values(trade).returning();
    return created;
  }

  // Paper trading session operations
  async getPaperTradingSession(id: string): Promise<PaperTradingSession | undefined> {
    const [session] = await db.select().from(paperTradingSessions).where(eq(paperTradingSessions.id, id));
    return session || undefined;
  }

  async getActivePaperTradingSessions(): Promise<PaperTradingSession[]> {
    return await db.select().from(paperTradingSessions).where(eq(paperTradingSessions.status, "active")).orderBy(desc(paperTradingSessions.startedAt));
  }

  async createPaperTradingSession(session: InsertPaperTradingSession): Promise<PaperTradingSession> {
    const [created] = await db.insert(paperTradingSessions).values(session).returning();
    return created;
  }

  async updatePaperTradingSession(id: string, updates: Partial<PaperTradingSession>): Promise<PaperTradingSession | undefined> {
    const [updated] = await db.update(paperTradingSessions).set(updates).where(eq(paperTradingSessions.id, id)).returning();
    return updated || undefined;
  }

  // Settings operations
  async getSettings(userId: string): Promise<Settings | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.userId, userId));
    return setting || undefined;
  }

  async createOrUpdateSettings(insertSettings: InsertSettings): Promise<Settings> {
    const existing = await this.getSettings(insertSettings.userId);
    
    if (existing) {
      const [updated] = await db
        .update(settings)
        .set({ ...insertSettings, updatedAt: new Date() })
        .where(eq(settings.userId, insertSettings.userId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(settings).values(insertSettings).returning();
      return created;
    }
  }
}

class InMemoryStorage implements IStorage {
  users = new Map<string, User>();
  portfolios = new Map<string, Portfolio>();
  positions = new Map<string, Position>();
  models = new Map<string, Model>();
  trainingJobs = new Map<string, TrainingJob>();
  backtests = new Map<string, Backtest>();
  trades = new Map<string, Trade>();
  paperTradingSessions = new Map<string, PaperTradingSession>();
  settings = new Map<string, Settings>();

  private genId(prefix: string) { return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now()}`; }

  async getUser(id: string) { return this.users.get(id); }
  async getUserByUsername(username: string) { return Array.from(this.users.values()).find(u => (u as any).username === username); }
  async createUser(user: InsertUser) { const id = this.genId('usr'); const now = new Date(); const obj = { ...(user as any), id, createdAt: now, updatedAt: now } as User; this.users.set(id, obj); return obj; }

  async getPortfolio(id: string) { return this.portfolios.get(id); }
  async getPortfoliosByUser(userId: string) { return Array.from(this.portfolios.values()).filter(p => p.userId === userId).sort((a,b)=>+new Date(b.createdAt)-+new Date(a.createdAt)); }
  async createPortfolio(portfolio: InsertPortfolio) { const id = this.genId('pf'); const now = new Date(); const obj = { ...(portfolio as any), id, createdAt: now, updatedAt: now } as Portfolio; this.portfolios.set(id, obj); return obj; }
  async updatePortfolio(id: string, updates: Partial<Portfolio>) { const cur = this.portfolios.get(id); if (!cur) return undefined; const obj = { ...cur, ...updates, updatedAt: new Date() } as Portfolio; this.portfolios.set(id, obj); return obj; }

  async getPositionsByPortfolio(portfolioId: string) { return Array.from(this.positions.values()).filter(p => p.portfolioId === portfolioId).sort((a,b)=>+new Date(b.updatedAt)-+new Date(a.updatedAt)); }
  async createPosition(position: InsertPosition) { const id = this.genId('pos'); const now = new Date(); const obj = { ...(position as any), id, createdAt: now, updatedAt: now } as Position; this.positions.set(id, obj); return obj; }
  async updatePosition(id: string, updates: Partial<Position>) { const cur = this.positions.get(id); if (!cur) return undefined; const obj = { ...cur, ...updates, updatedAt: new Date() } as Position; this.positions.set(id, obj); return obj; }

  async getModel(id: string) { return this.models.get(id); }
  async getAllModels() { return Array.from(this.models.values()).sort((a,b)=>+new Date(b.createdAt)-+new Date(a.createdAt)); }
  async createModel(model: InsertModel) { const id = this.genId('mdl'); const now = new Date(); const obj = { ...(model as any), id, createdAt: now, updatedAt: now } as Model; this.models.set(id, obj); return obj; }
  async updateModel(id: string, updates: Partial<Model>) { const cur = this.models.get(id); if (!cur) return undefined; const obj = { ...cur, ...updates, updatedAt: new Date() } as Model; this.models.set(id, obj); return obj; }

  async getTrainingJob(id: string) { return this.trainingJobs.get(id); }
  async getTrainingJobsByModel(modelId: string) { return Array.from(this.trainingJobs.values()).filter(j => (j as any).modelId === modelId).sort((a,b)=>+new Date(b.createdAt)-+new Date(a.createdAt)); }
  async createTrainingJob(job: InsertTrainingJob) { const id = this.genId('trn'); const now = new Date(); const obj = { ...(job as any), id, createdAt: now, updatedAt: now, status: (job as any).status ?? 'queued', progress: (job as any).progress ?? 0 } as TrainingJob; this.trainingJobs.set(id, obj); return obj; }
  async updateTrainingJob(id: string, updates: Partial<TrainingJob>) { const cur = this.trainingJobs.get(id); if (!cur) return undefined; const obj = { ...cur, ...updates, updatedAt: new Date() } as TrainingJob; this.trainingJobs.set(id, obj); return obj; }

  async getBacktest(id: string) { return this.backtests.get(id); }
  async getAllBacktests() { return Array.from(this.backtests.values()).sort((a,b)=>+new Date(b.createdAt)-+new Date(a.createdAt)); }
  async createBacktest(backtest: InsertBacktest) { const id = this.genId('bt'); const now = new Date(); const obj = { ...(backtest as any), id, createdAt: now, updatedAt: now, status: (backtest as any).status ?? 'queued' } as Backtest; this.backtests.set(id, obj); return obj; }
  async updateBacktest(id: string, updates: Partial<Backtest>) { const cur = this.backtests.get(id); if (!cur) return undefined; const obj = { ...cur, ...updates, updatedAt: new Date() } as Backtest; this.backtests.set(id, obj); return obj; }

  async getTradesByPortfolio(portfolioId: string) { return Array.from(this.trades.values()).filter(t => t.portfolioId === portfolioId).sort((a,b)=>+new Date(b.executedAt)-+new Date(a.executedAt)); }
  async getTradesByBacktest(backtestId: string) { return Array.from(this.trades.values()).filter(t => (t as any).backtestId === backtestId).sort((a,b)=>+new Date(b.executedAt)-+new Date(a.executedAt)); }
  async createTrade(trade: InsertTrade) { const id = this.genId('tr'); const now = new Date(); const obj = { ...(trade as any), id, executedAt: (trade as any).executedAt ?? now } as Trade; this.trades.set(id, obj); return obj; }

  async getPaperTradingSession(id: string) { return this.paperTradingSessions.get(id); }
  async getActivePaperTradingSessions() { return Array.from(this.paperTradingSessions.values()).filter(s => s.status === 'active').sort((a,b)=>+new Date(b.startedAt)-+new Date(a.startedAt)); }
  async createPaperTradingSession(session: InsertPaperTradingSession) { const id = this.genId('ps'); const now = new Date(); const obj = { ...(session as any), id, startedAt: (session as any).startedAt ?? now, status: (session as any).status ?? 'active' } as PaperTradingSession; this.paperTradingSessions.set(id, obj); return obj; }
  async updatePaperTradingSession(id: string, updates: Partial<PaperTradingSession>) { const cur = this.paperTradingSessions.get(id); if (!cur) return undefined; const obj = { ...cur, ...updates } as PaperTradingSession; this.paperTradingSessions.set(id, obj); return obj; }

  async getSettings(userId: string) { return this.settings.get(userId); }
  async createOrUpdateSettings(sett: InsertSettings) { const now = new Date(); const obj = { ...(sett as any), updatedAt: now } as Settings; this.settings.set(sett.userId, obj); return obj; }
}

export const storage: IStorage = useDb ? new DatabaseStorage() : new InMemoryStorage();
