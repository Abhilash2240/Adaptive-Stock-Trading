"""
pretrain.py — Offline DDQN Pretraining Script
=============================================
Ties together all fixes into one runnable script:
  - Loads historical data (CSV) or falls back to labelled GBM synthetic
  - Chronological train / val split (never shuffled)
  - Streams training data through TradingEnvironment and DDQNAgent
  - Evaluates greedily on held-out val split
  - Logs metrics to SQLite via TrainingMetricsLogger
  - Saves model checkpoint on each improvement

Usage:
  python -m packages.agent.pretrain --help
  python -m packages.agent.pretrain --symbol AAPL --data data/AAPL.csv
  python -m packages.agent.pretrain --symbol AAPL --synthetic --steps 5000
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)


def _build_agent(args, use_per: bool = True, use_dueling: bool = True):
    from packages.agent.ddqn import DDQNAgent
    return DDQNAgent(
        state_dim=14,
        action_dim=3,
        lr=1e-4,
        gamma=0.99,
        epsilon=1.0,
        epsilon_min=0.05,
        epsilon_decay=0.995,
        batch_size=64,
        target_update_freq=500,
        tau=0.0,
        buffer_capacity=50_000,
        use_per=use_per,
        use_dueling=use_dueling,
    )


def _run_episode(
    quotes: list[dict],
    agent,
    env_cls,
    metrics,
    user_id: str,
    symbol: str,
    training: bool,
) -> dict:
    """Stream quotes through one environment and return summary stats."""
    from packages.agent.environment import TradingEnvironment, RewardConfig

    env = env_cls()
    total_reward = 0.0
    n_steps      = 0
    action       = env.HOLD

    for quote in quotes:
        result = env.on_quote(quote, action)
        if result is None:
            continue
        state, reward, done = result
        next_action = agent.act(state, training=training)

        if training:
            agent.remember(
                env.features.get_state(env.portfolio),
                action, reward, state, done,
            )
            loss = agent.train_step()
            if loss is not None and n_steps % 50 == 0:
                metrics.log(
                    user_id=user_id,
                    symbol=symbol,
                    step=agent.step_count,
                    loss=loss,
                    epsilon=agent.epsilon,
                    buffer_size=len(agent.replay),
                    reward=reward,
                )

        total_reward += reward
        n_steps += 1
        action = next_action

    return {
        "total_reward": total_reward,
        "n_steps":      n_steps,
        "final_value":  env.total_value,
        "epsilon":      agent.epsilon,
        "step_count":   agent.step_count,
    }


def pretrain(
    symbol: str,
    data_csv: str | None = None,
    use_synthetic: bool  = False,
    user_id: str         = "__pretrain__",
    val_fraction: float  = 0.2,
    use_per: bool        = True,
    use_dueling: bool    = True,
    output_dir: str      = "models",
    log_every: int       = 100,
) -> None:
    from packages.agent.historical import (
        CSVDataLoader, GBMDataGenerator, HistoricalDataPipeline,
    )
    from packages.agent.environment import TradingEnvironment
    from packages.agent.metrics import TrainingMetricsLogger

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    db_path = str(out / "training_metrics.db")
    metrics = TrainingMetricsLogger(db_path=db_path)

    # -- Load data -------------------------------------------------------
    if use_synthetic or data_csv is None:
        logger.warning(
            "⚠  Using SYNTHETIC GBM data — for pipeline testing ONLY. "
            "Do not use these weights for real trading."
        )
        quotes = GBMDataGenerator(symbol=symbol, n=5_000).generate()
    else:
        logger.info("Loading CSV: %s", data_csv)
        quotes = CSVDataLoader(data_csv, symbol=symbol).load()

    pipeline = HistoricalDataPipeline(quotes, val_fraction=val_fraction)
    logger.info(
        "Data split — train: %d  val: %d  synthetic: %s",
        len(pipeline.train), len(pipeline.val), pipeline.is_synthetic,
    )

    agent = _build_agent(None, use_per=use_per, use_dueling=use_dueling)
    logger.info("Agent: PER=%s  Dueling=%s  device=%s", use_per, use_dueling, agent.device)

    # -- Training pass ---------------------------------------------------
    logger.info("=== Training pass ===")
    train_stats = _run_episode(
        pipeline.train, agent, TradingEnvironment,
        metrics, user_id, symbol, training=True,
    )
    logger.info(
        "Train done — steps=%d  reward=%.2f  final_value=%.2f  epsilon=%.4f",
        train_stats["step_count"],
        train_stats["total_reward"],
        train_stats["final_value"],
        train_stats["epsilon"],
    )

    # -- Save checkpoint -------------------------------------------------
    ckpt = out / f"{symbol.upper()}_pretrained.pt"
    agent.save(str(ckpt))
    logger.info("Checkpoint saved → %s", ckpt)

    # -- Validation pass (epsilon=0, no training) ------------------------
    logger.info("=== Validation pass (greedy) ===")
    saved_eps   = agent.epsilon
    agent.epsilon = 0.0         # greedy evaluation

    val_stats = _run_episode(
        pipeline.val, agent, TradingEnvironment,
        metrics, user_id, symbol, training=False,
    )
    agent.epsilon = saved_eps

    logger.info(
        "Val done — steps=%d  reward=%.2f  final_value=%.2f",
        val_stats["n_steps"],
        val_stats["total_reward"],
        val_stats["final_value"],
    )

    logger.info("Metrics stored in %s", db_path)
    logger.info("Done.")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_args(argv=None):
    p = argparse.ArgumentParser(
        description="Offline DDQN pretraining for the Adaptive Stock Trading agent."
    )
    p.add_argument("--symbol",    default="AAPL",  help="Ticker symbol")
    p.add_argument("--data",      default=None,    help="Path to OHLCV CSV file")
    p.add_argument("--synthetic", action="store_true",
                   help="Use GBM synthetic data (pipeline test only)")
    p.add_argument("--user-id",   default="__pretrain__",
                   help="User ID to tag metrics with")
    p.add_argument("--val",       type=float, default=0.2,
                   help="Validation fraction (default 0.2)")
    p.add_argument("--no-per",    action="store_true",  help="Disable PER")
    p.add_argument("--no-dueling",action="store_true",  help="Use plain DQN network")
    p.add_argument("--out",       default="models", help="Output directory")
    return p.parse_args(argv)


if __name__ == "__main__":
    args = _parse_args()
    if args.data is None and not args.synthetic:
        logger.error(
            "Provide --data <csv_path> or --synthetic for GBM pipeline testing."
        )
        sys.exit(1)
    pretrain(
        symbol=args.symbol,
        data_csv=args.data,
        use_synthetic=args.synthetic,
        user_id=args.user_id,
        val_fraction=args.val,
        use_per=not args.no_per,
        use_dueling=not args.no_dueling,
        output_dir=args.out,
    )
