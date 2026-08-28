#!/usr/bin/env python3
"""Train the DDQN agent on historical OHLCV data."""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone
from pathlib import Path
import sys

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from packages.agent.ddqn import DDQNAgent
from packages.agent.environment import TradingEnvironment
from packages.db.engine import get_session_ctx
from packages.db.repositories import (
    ModelArtifactRepository,
    OHLCVRepository,
    TrainingRepository,
)

MODEL_PATH = Path("models/ddqn_weights.pt")
MODEL_NAME = "ddqn"


def parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--symbol",
        action="append",
        required=True,
        help="Symbol to train on; repeat the flag for multiple symbols.",
    )
    parser.add_argument("--start", required=True, type=parse_datetime)
    parser.add_argument("--end", required=True, type=parse_datetime)
    parser.add_argument("--episodes", type=int, default=1)
    return parser.parse_args()


def replay_episode(agent: DDQNAgent, bars: list) -> tuple[float, float | None]:
    environment = TradingEnvironment()
    previous_state = None
    previous_action = TradingEnvironment.HOLD
    episode_reward = 0.0
    final_loss = None

    for bar in bars:
        transition = environment.on_quote(
            {
                "symbol": bar.symbol,
                "open": bar.open,
                "high": bar.high,
                "low": bar.low,
                "close": bar.close,
                "volume": bar.volume,
                "timestamp": bar.timestamp,
            },
            previous_action,
        )
        if transition is None:
            continue

        next_state, reward, done = transition
        state = previous_state if previous_state is not None else next_state
        agent.remember(state, previous_action, reward, next_state, done)
        final_loss = agent.train_step()
        episode_reward += reward
        previous_state = next_state
        previous_action = agent.act(next_state, training=True)

    return episode_reward, final_loss


async def train(args: argparse.Namespace) -> None:
    symbols = [symbol.strip().upper() for symbol in args.symbol]
    if args.episodes < 1:
        raise ValueError("--episodes must be at least 1")
    if args.end < args.start:
        raise ValueError("--end must not be earlier than --start")

    agent = DDQNAgent()
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    episode_metrics: list[tuple[float, float | None]] = []

    async with get_session_ctx() as session:
        ohlcv = OHLCVRepository(session)
        historical_bars = {
            symbol: list(await ohlcv.get_range(symbol, args.start, args.end))
            for symbol in symbols
        }
        if not any(historical_bars.values()):
            raise ValueError("No OHLCV bars found for the requested symbols and date range")

        training = TrainingRepository(session)
        run = await training.create_run(
            MODEL_NAME,
            {
                "symbols": symbols,
                "start": args.start.isoformat(),
                "end": args.end.isoformat(),
                "episodes": args.episodes,
            },
        )
        run.total_episodes = args.episodes
        session.add(run)

        for episode in range(1, args.episodes + 1):
            reward = 0.0
            loss = None
            for symbol in symbols:
                symbol_reward, symbol_loss = replay_episode(
                    agent, historical_bars[symbol]
                )
                reward += symbol_reward
                if symbol_loss is not None:
                    loss = symbol_loss
            episode_metrics.append((reward, loss))
            await training.log_metric(
                run.id,
                episode,
                loss=loss or 0.0,
                reward=reward,
                epsilon=agent.epsilon,
            )

        agent.save(str(MODEL_PATH))
        rewards = [reward for reward, _ in episode_metrics]
        losses = [loss for _, loss in episode_metrics if loss is not None]
        await training.complete_run(
            run.id,
            best_reward=max(rewards) if rewards else None,
            final_loss=losses[-1] if losses else None,
        )
        artifact = await ModelArtifactRepository(session).register(
            name=f"{MODEL_NAME}-offline-{run.id[:8]}",
            version=run.id,
            artifact_uri=str(MODEL_PATH),
            metrics={
                "episodes": args.episodes,
                "best_reward": max(rewards) if rewards else 0.0,
                "final_loss": losses[-1] if losses else None,
            },
        )

    print(f"Training run {run.id} completed; artifact {artifact.name} saved to {MODEL_PATH}")


def main() -> None:
    asyncio.run(train(parse_args()))


if __name__ == "__main__":
    main()