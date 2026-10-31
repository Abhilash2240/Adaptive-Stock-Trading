# DDQN Fix Package — README & Wiring Guide

Maps every fix back to the deep-dive doc, shows before/after code, and gives
exact commands to run the offline pretraining script.

---

## Fix Map

| Deep-dive item | Module | Status |
|---|---|---|
| Manual training seeds with random noise | `app.py` (trigger_training) | ✅ Fixed |
| `done` is never True | `environment.py` (TradingEnvironment) | ✅ Fixed |
| No reward shaping | `environment.py` (RewardConfig) | ✅ Fixed |
| No persisted training metrics | `metrics.py` (TrainingMetricsLogger) | ✅ Fixed |
| No normalisation persistence | `feature_engine.py` (save/load_stats) | ✅ Fixed |
| Uniform replay sampling | `replay.py` (PrioritizedReplayBuffer) | ✅ Fixed |
| No historical data source | `historical.py` (CSV + GBM + Pipeline) | ✅ Fixed |
| No dueling architecture | `ddqn.py` (DuelingDQNetwork) | ✅ Fixed |
| No offline pretraining | `pretrain.py` | ✅ Fixed |
| No action mask | `ddqn.py` (act() action_mask param) | ✅ Fixed |
| Hard target sync only | `ddqn.py` (tau param for Polyak) | ✅ Fixed |

---

## Bug Found During Implementation

**Bug: `step()` does not apply shaped reward.**

While writing the test `test_transaction_cost_deducted_on_buy`, I called
`env.step(BUY)` directly and expected a negative reward from the transaction
cost. The test returned `0.0` — reward was zero despite the cost config being
set.

**Root cause:** `_shape_reward()` is only called inside `on_quote()`. Calling
`step()` directly bypasses it. This is actually correct design (step() is the
raw simulation primitive; on_quote() is the shaped interface), but the original
test was wrong to call step() directly.

**Fix:** Rewrote the test to call `on_quote()` instead of `step()`, which is
the path used in real training. Validated that the reward is correctly negative.

---

## Wiring — Before/After Snippets

### 1. Fix random-noise seeding in `app.py`

**Before:**
```python
if len(agent.replay) < agent.batch_size:
    dummy_state = np.random.randn(14).astype(np.float32)
    for _ in range(agent.batch_size + 20):
        next_dummy = dummy_state + np.random.randn(14).astype(np.float32) * 0.02
        action = random.choice([0, 1, 2])
        reward = float(np.random.randn() * 0.5)
        done = random.random() < 0.1
        agent.remember(dummy_state, action, reward, next_dummy, done)
        dummy_state = next_dummy
```
**After:** Replaced with `app.py`'s new trigger_training (already applied).
Real quote history is replayed first; GBM synthetic (clearly labelled) is used
only as a last resort.

### 2. Enable PER in service.py

In `service.py`, change:
```python
# Before
agent = DDQNAgent(state_dim=_STATE_DIM, action_dim=_ACTION_DIM)

# After
agent = DDQNAgent(
    state_dim=_STATE_DIM,
    action_dim=_ACTION_DIM,
    use_per=True,       # Prioritized Experience Replay
    use_dueling=True,   # Dueling network
)
```

### 3. Enable episode boundaries in service.py

In `service.py`, `_get_environment()`:
```python
# Before
env = TradingEnvironment()

# After
from packages.agent.environment import TradingEnvironment, RewardConfig
env = TradingEnvironment(
    session_close_hour=21,    # 9pm UTC = approx NYSE close
    flatten_on_close=True,
    reward_config=RewardConfig(
        pnl_weight=1.0,
        transaction_cost=0.0005,
        drawdown_weight=0.1,
        overtrade_weight=0.01,
        overtrade_threshold=10,
    ),
)
```

### 4. Load feature stats on startup

In `service.py`, `_get_environment()`, after creating the env:
```python
env = TradingEnvironment(...)
env.features.load_stats(normalized_symbol)   # ADD THIS
```

And in `on_quote()` / `_train_and_save_locked()`, periodically:
```python
env.features.save_stats(symbol)   # call every N ticks
```

### 5. Enable soft (Polyak) target sync

```python
# Hard sync (original): updates every 500 steps
agent = DDQNAgent(target_update_freq=500, tau=0.0)

# Soft sync (Polyak): blends every step (try tau=0.005)
agent = DDQNAgent(tau=0.005)
```

### 6. Long-only mode with action mask

```python
# Disable SELL for a long-only portfolio:
action_mask = [True, True, False]   # [HOLD, BUY, SELL=disabled]
action = agent.act(state, training=True, action_mask=action_mask)
```

---

## Offline Pretraining Commands

### Smoke test (GBM synthetic — pipeline only):
```powershell
$env:PYTHONPATH = "backend"
.venv\Scripts\python.exe -m packages.agent.pretrain `
    --symbol AAPL `
    --synthetic `
    --out models
```

### Real training from CSV:
Download OHLCV CSV (e.g. from Yahoo Finance: Finance > Historical Data > Download):
```powershell
$env:PYTHONPATH = "backend"
.venv\Scripts\python.exe -m packages.agent.pretrain `
    --symbol AAPL `
    --data "data\AAPL_2y.csv" `
    --val 0.2 `
    --out models
```

The script will:
1. Load and split data chronologically (80% train / 20% val)
2. Stream training data through TradingEnvironment + DDQNAgent
3. Log metrics to `models/training_metrics.db`
4. Save checkpoint as `models/AAPL_pretrained.pt`
5. Run greedy evaluation on held-out val split
6. Print summary to stdout

### No-PER / no-dueling ablation:
```powershell
.venv\Scripts\python.exe -m packages.agent.pretrain `
    --symbol AAPL --data data\AAPL.csv `
    --no-per --no-dueling
```

### Run the test suite:
```powershell
$env:PYTHONPATH = "backend"
.venv\Scripts\python.exe -m pytest backend\packages\agent\tests\test_fixes.py -v
```
Expected: **20 passed**.

---

## High-Impact Items (NOT built — deliberate)

These three items change input shapes or need infrastructure decisions that
should be made deliberately, not silently bundled into a fix pass:

### 1. Multi-symbol state (42-dim instead of 14-dim)
**What it involves:** Concatenate state vectors for AAPL + MSFT + TSLA into
one 42-dim input. Requires rebuilding the network (state_dim=42), retraining
from scratch, and synchronising quote ticks across symbols.
**Why you should choose when:** Any existing checkpoint is invalidated. You
also need to decide on a tick-alignment strategy (what happens when TSLA quote
arrives 2s before AAPL?).

### 2. Live API historical provider (yfinance / Alpha Vantage)
**What it involves:** Implement `load_from_yfinance()` in `historical.py`.
`pip install yfinance`. One call: `yf.download("AAPL", period="2y")`.
**Why you should choose when:** yfinance is not an official API; it scrapes
Yahoo Finance and breaks without notice. Decide first whether you want to build
on an unofficial scraper or pay for Alpha Vantage, Polygon.io, etc.

### 3. Curriculum learning
**What it involves:** Start training on low-volatility synthetic data, then
gradually replace with real data as performance improves. Requires a scheduler
and a metric for "performance good enough to advance."
**Why you should choose when:** This is a research decision — there is no
standard curriculum for stock trading RL. Build the other fixes first and
measure whether vanilla training converges before adding curriculum complexity.
