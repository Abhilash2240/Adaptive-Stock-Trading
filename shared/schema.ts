import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, real, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Portfolios table
export const portfolios = pgTable("portfolios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  initialCash: real("initial_cash").notNull().default(100000),
  currentCash: real("current_cash").notNull().default(100000),
  totalValue: real("total_value").notNull().default(100000),
  status: text("status").notNull().default("active"), // active, archived
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Positions table - current holdings in portfolios
export const positions = pgTable("positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").notNull().references(() => portfolios.id),
  ticker: text("ticker").notNull(),
  quantity: real("quantity").notNull(),
  entryPrice: real("entry_price").notNull(),
  currentPrice: real("current_price").notNull(),
  lastAction: text("last_action"), // BUY_5, BUY_10, SELL_5, SELL_10, HOLD
  qValue: real("q_value"), // confidence from RL agent
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// RL Models table - trained agent checkpoints
export const models = pgTable("models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  modelType: text("model_type").notNull().default("double_dqn"), // double_dqn, sac
  hyperparameters: jsonb("hyperparameters").notNull(), // {replay_size, batch_size, lr, gamma, etc}
  trainingDataHash: text("training_data_hash"),
  seed: integer("seed"),
  status: text("status").notNull().default("untrained"), // training, trained, failed
  performance: jsonb("performance"), // {cagr, sharpe, sortino, max_dd, etc}
  checkpointPath: text("checkpoint_path"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Training Jobs table
export const trainingJobs = pgTable("training_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelId: varchar("model_id").notNull().references(() => models.id),
  status: text("status").notNull().default("pending"), // pending, running, completed, failed, cancelled
  progress: real("progress").notNull().default(0), // 0-100
  currentEpisode: integer("current_episode").default(0),
  totalEpisodes: integer("total_episodes").notNull(),
  currentLoss: real("current_loss"),
  epsilon: real("epsilon"),
  logs: text("logs"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Backtests table
export const backtests = pgTable("backtests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  modelId: varchar("model_id").notNull().references(() => models.id),
  tickers: jsonb("tickers").notNull(), // array of ticker symbols
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  initialCash: real("initial_cash").notNull().default(100000),
  transactionCost: real("transaction_cost").default(0.001), // 0.1%
  slippage: real("slippage").default(0.0005), // 0.05%
  status: text("status").notNull().default("pending"), // pending, running, completed, failed
  results: jsonb("results"), // {cagr, sharpe, sortino, max_dd, win_rate, trades, equity_curve, etc}
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Trades table - historical trade log
export const trades = pgTable("trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id),
  backtestId: varchar("backtest_id").references(() => backtests.id),
  ticker: text("ticker").notNull(),
  action: text("action").notNull(), // BUY_5, BUY_10, SELL_5, SELL_10, HOLD
  quantity: real("quantity").notNull(),
  price: real("price").notNull(),
  fees: real("fees").notNull().default(0),
  pnl: real("pnl"), // profit/loss
  cumulativePnl: real("cumulative_pnl"),
  qValue: real("q_value"), // confidence from agent
  sentiment: real("sentiment"), // sentiment score from Gemini
  executedAt: timestamp("executed_at").notNull().defaultNow(),
});

// Paper Trading Sessions table
export const paperTradingSessions = pgTable("paper_trading_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").notNull().references(() => portfolios.id),
  modelId: varchar("model_id").notNull().references(() => models.id),
  status: text("status").notNull().default("active"), // active, paused, stopped
  currentValue: real("current_value").notNull(),
  totalReturn: real("total_return").default(0),
  sharpeRatio: real("sharpe_ratio"),
  maxDrawdown: real("max_drawdown"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  stoppedAt: timestamp("stopped_at"),
});

// Settings table - user preferences and API keys
export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  tradingMode: text("trading_mode").notNull().default("paper"), // paper, live
  marketDataProvider: text("market_data_provider").default("yfinance"), // yfinance, iex, polygon
  geminiEnabled: boolean("gemini_enabled").default(true),
  notificationsEnabled: boolean("notifications_enabled").default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  portfolios: many(portfolios),
  settings: one(settings),
}));

export const portfoliosRelations = relations(portfolios, ({ one, many }) => ({
  user: one(users, {
    fields: [portfolios.userId],
    references: [users.id],
  }),
  positions: many(positions),
  trades: many(trades),
  paperTradingSessions: many(paperTradingSessions),
}));

export const positionsRelations = relations(positions, ({ one }) => ({
  portfolio: one(portfolios, {
    fields: [positions.portfolioId],
    references: [portfolios.id],
  }),
}));

export const modelsRelations = relations(models, ({ many }) => ({
  trainingJobs: many(trainingJobs),
  backtests: many(backtests),
  paperTradingSessions: many(paperTradingSessions),
}));

export const trainingJobsRelations = relations(trainingJobs, ({ one }) => ({
  model: one(models, {
    fields: [trainingJobs.modelId],
    references: [models.id],
  }),
}));

export const backtestsRelations = relations(backtests, ({ one, many }) => ({
  model: one(models, {
    fields: [backtests.modelId],
    references: [models.id],
  }),
  trades: many(trades),
}));

export const tradesRelations = relations(trades, ({ one }) => ({
  portfolio: one(portfolios, {
    fields: [trades.portfolioId],
    references: [portfolios.id],
  }),
  backtest: one(backtests, {
    fields: [trades.backtestId],
    references: [backtests.id],
  }),
}));

export const paperTradingSessionsRelations = relations(paperTradingSessions, ({ one }) => ({
  portfolio: one(portfolios, {
    fields: [paperTradingSessions.portfolioId],
    references: [portfolios.id],
  }),
  model: one(models, {
    fields: [paperTradingSessions.modelId],
    references: [models.id],
  }),
}));

export const settingsRelations = relations(settings, ({ one }) => ({
  user: one(users, {
    fields: [settings.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertPortfolioSchema = createInsertSchema(portfolios).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPositionSchema = createInsertSchema(positions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertModelSchema = createInsertSchema(models).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTrainingJobSchema = createInsertSchema(trainingJobs).omit({
  id: true,
  createdAt: true,
});

export const insertBacktestSchema = createInsertSchema(backtests).omit({
  id: true,
  createdAt: true,
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  executedAt: true,
});

export const insertPaperTradingSessionSchema = createInsertSchema(paperTradingSessions).omit({
  id: true,
  startedAt: true,
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
});

// Infer types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type Portfolio = typeof portfolios.$inferSelect;

export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Position = typeof positions.$inferSelect;

export type InsertModel = z.infer<typeof insertModelSchema>;
export type Model = typeof models.$inferSelect;

export type InsertTrainingJob = z.infer<typeof insertTrainingJobSchema>;
export type TrainingJob = typeof trainingJobs.$inferSelect;

export type InsertBacktest = z.infer<typeof insertBacktestSchema>;
export type Backtest = typeof backtests.$inferSelect;

export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof trades.$inferSelect;

export type InsertPaperTradingSession = z.infer<typeof insertPaperTradingSessionSchema>;
export type PaperTradingSession = typeof paperTradingSessions.$inferSelect;

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;
