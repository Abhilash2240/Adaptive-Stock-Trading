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
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

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

export class DatabaseStorage implements IStorage {
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

export const storage = new DatabaseStorage();
