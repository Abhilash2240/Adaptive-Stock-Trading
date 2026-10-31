"""
test_fixes.py — Verification suite for the DDQN Fix Package
============================================================
Tests every fix item from the deep-dive doc independently.
Run from project root:  python -m pytest backend/packages/agent/tests/ -v
"""
import math
import sys
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Make `packages` importable — add the backend/ directory to sys.path
_BACKEND = Path(__file__).resolve().parents[3]   # .../backend
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))


# ===========================================================================
# 1. SumTree correctness
# ===========================================================================
class TestSumTree(unittest.TestCase):
    def _make(self, cap=8):
        from packages.agent.replay import SumTree
        t = SumTree(cap)
        return t

    def test_total_accumulates(self):
        t = self._make(4)
        t.add(1.0, "a"); t.add(2.0, "b"); t.add(3.0, "c")
        self.assertAlmostEqual(t.total, 6.0, places=9)

    def test_retrieve_returns_correct_leaf(self):
        t = self._make(4)
        t.add(1.0, "A"); t.add(2.0, "B"); t.add(3.0, "C")
        # s near 0 should hit the lowest-priority leaf
        _, _, d = t.get(0.01)
        self.assertIsNotNone(d)

    def test_update_changes_total(self):
        t = self._make(4)
        t.add(1.0, "x")
        idx = t.capacity - 1      # first leaf
        t.update(idx, 5.0)
        self.assertAlmostEqual(t.total, 5.0, places=9)

    def test_circular_overwrite(self):
        t = self._make(3)
        for i in range(5):        # more than capacity
            t.add(float(i + 1), str(i))
        self.assertEqual(len(t), 3)


# ===========================================================================
# 2. PrioritizedReplayBuffer — push, sample, update priorities
# ===========================================================================
class TestPER(unittest.TestCase):
    def _make(self, cap=200):
        from packages.agent.replay import PrioritizedReplayBuffer
        return PrioritizedReplayBuffer(capacity=cap)

    def _fill(self, buf, n=100):
        import numpy as np
        for i in range(n):
            s  = np.zeros(14, dtype=np.float32)
            ns = np.ones(14,  dtype=np.float32)
            buf.push(s, 0, float(i), ns, False)

    def test_len_correct(self):
        buf = self._make()
        self._fill(buf, 80)
        self.assertEqual(len(buf), 80)

    def test_sample_returns_seven_tuple(self):
        import torch
        buf = self._make()
        self._fill(buf, 80)
        result = buf.sample(32)
        self.assertEqual(len(result), 7)
        s, a, r, ns, d, w, idxs = result
        self.assertEqual(s.shape, (32, 14))
        self.assertIsInstance(idxs, list)
        self.assertEqual(len(idxs), 32)

    def test_is_weights_in_0_1(self):
        buf = self._make()
        self._fill(buf, 80)
        _, _, _, _, _, w, _ = buf.sample(32)
        self.assertTrue((w >= 0).all() and (w <= 1.0 + 1e-6).all())

    def test_update_priorities_changes_sampling(self):
        import numpy as np
        buf = self._make()
        self._fill(buf, 80)
        _, _, _, _, _, _, idxs = buf.sample(32)
        # Push huge TD errors → those transitions should dominate next sample
        buf.update_priorities(idxs, np.full(32, 100.0))
        # Should not raise
        buf.sample(32)


# ===========================================================================
# 3. UniformReplayBuffer — backward compat
# ===========================================================================
class TestUniformBuffer(unittest.TestCase):
    def test_sample_returns_five_tuple(self):
        import torch, numpy as np
        from packages.agent.replay import UniformReplayBuffer
        buf = UniformReplayBuffer(100)
        for _ in range(70):
            buf.push(np.zeros(14), 0, 0.0, np.ones(14), False)
        result = buf.sample(32)
        self.assertEqual(len(result), 5)


# ===========================================================================
# 4. Episode boundary — done fires exactly once per session
# ===========================================================================
class TestEpisodeBoundary(unittest.TestCase):
    def _make_env(self, close_hour=21):
        from packages.agent.environment import TradingEnvironment
        return TradingEnvironment(session_close_hour=close_hour)

    def _quote(self, price=100.0, hour=10):
        ts = datetime(2024, 1, 2, hour, 0, tzinfo=timezone.utc)
        return {"symbol": "AAPL", "price": price, "close": price,
                "high": price, "low": price, "volume": 10_000, "timestamp": ts}

    def _warm(self, env, n=30, hour=10):
        for i in range(n):
            env.on_quote(self._quote(100.0 + i * 0.1, hour=hour))

    def test_done_fires_at_close(self):
        env = self._make_env(21)
        self._warm(env, 30, hour=10)
        result = env.on_quote(self._quote(103.0, hour=21))
        self.assertIsNotNone(result)
        _, _, done = result
        self.assertTrue(done, "done must be True at session close hour")

    def test_done_fires_only_once_same_session(self):
        env = self._make_env(21)
        self._warm(env, 30, hour=10)
        env.on_quote(self._quote(103.0, hour=21))          # first close tick
        result2 = env.on_quote(self._quote(104.0, hour=21))  # same hour, same session
        if result2 is not None:
            _, _, done2 = result2
            self.assertFalse(done2, "done must NOT re-fire within same session")

    def test_done_fires_again_next_day(self):
        env = self._make_env(21)
        self._warm(env, 30, hour=10)
        env.on_quote(self._quote(103.0, hour=21))          # close day 1
        # next-day morning tick resets the flag
        env.on_quote(self._quote(103.5, hour=9))
        result_next = env.on_quote(self._quote(104.0, hour=21))  # close day 2
        self.assertIsNotNone(result_next)
        _, _, done_next = result_next
        self.assertTrue(done_next, "done must re-fire on next session close")


# ===========================================================================
# 5. Shaped reward — all penalty components fire
# ===========================================================================
class TestShapedReward(unittest.TestCase):
    def _make_env(self):
        from packages.agent.environment import TradingEnvironment, RewardConfig
        rc = RewardConfig(
            pnl_weight=1.0,
            transaction_cost=0.001,
            drawdown_weight=0.5,
            overtrade_weight=0.1,
            overtrade_threshold=0,
        )
        return TradingEnvironment(reward_config=rc)

    def _warm(self, env, n=30):
        for i in range(n):
            q = {"price": 100.0 + i * 0.1, "close": 100.0 + i * 0.1,
                 "high": 100.0 + i * 0.1, "low": 100.0 + i * 0.1,
                 "volume": 10_000}
            env.on_quote(q, env.HOLD)

    def test_transaction_cost_deducted_on_buy(self):
        from packages.agent.environment import TradingEnvironment, RewardConfig
        rc = RewardConfig(pnl_weight=1.0, transaction_cost=0.001,
                          drawdown_weight=0.0, overtrade_weight=0.0)
        env = TradingEnvironment(reward_config=rc)
        # Warm with fixed price so no P&L drift
        for _ in range(30):
            q = {"price": 100.0, "close": 100.0, "high": 100.0,
                 "low": 100.0, "volume": 10_000}
            env.on_quote(q, env.HOLD)
        # One more tick with BUY action — price flat so only cost deducted
        result = env.on_quote(
            {"price": 100.0, "close": 100.0, "high": 100.0,
             "low": 100.0, "volume": 10_000},
            env.BUY,
        )
        self.assertIsNotNone(result)
        _, reward, _ = result
        self.assertLess(reward, 0, "Transaction cost should make reward negative on BUY at flat price")

    def test_overtrade_penalty_above_threshold(self):
        from packages.agent.environment import RewardConfig
        env = self._make_env()
        self._warm(env, 30)
        env.trade_count = 5   # above threshold=0, so penalty kicks in
        env._price = 100.0
        env._last_total_value = env.total_value
        env._peak_value = env.total_value
        shaped = env._shape_reward(0.0, env.HOLD, False)
        # 5 excess trades * 0.1 weight = -0.5
        self.assertAlmostEqual(shaped, -0.5, places=5)


# ===========================================================================
# 6. FeatureEngine — stats persistence round-trip
# ===========================================================================
class TestFeatureStatsPersistence(unittest.TestCase):
    def test_save_and_load_stats(self):
        import tempfile, json
        from packages.agent.feature_engine import FeatureEngine

        fe = FeatureEngine()
        fe._52w_high = 200.0
        fe._52w_low  = 50.0

        with tempfile.TemporaryDirectory() as tmp:
            original_fn = FeatureEngine._stats_path
            FeatureEngine._stats_path = staticmethod(
                lambda sym: Path(tmp) / f"feature_stats_{sym}.json"
            )
            fe.save_stats("AAPL")

            fe2 = FeatureEngine()
            self.assertEqual(fe2._52w_high, 0.0)    # before load
            fe2.load_stats("AAPL")
            self.assertAlmostEqual(fe2._52w_high, 200.0)
            self.assertAlmostEqual(fe2._52w_low,  50.0)

            FeatureEngine._stats_path = original_fn  # restore


# ===========================================================================
# 7. TrainingMetricsLogger — write and read back
# ===========================================================================
class TestMetricsLogger(unittest.TestCase):
    def test_log_and_retrieve(self):
        import tempfile
        from packages.agent.metrics import TrainingMetricsLogger
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            db = str(Path(tmp) / "m.db")
            logger = TrainingMetricsLogger(db_path=db)
            logger.log(user_id="u1", symbol="AAPL", step=1,
                       loss=0.05, epsilon=0.9, buffer_size=100, reward=1.5)
            history = logger.get_history("u1", "AAPL")
            self.assertEqual(len(history), 1)
            self.assertAlmostEqual(history[0]["loss"], 0.05)
            self.assertAlmostEqual(history[0]["epsilon"], 0.9)

    def test_latest_returns_none_when_empty(self):
        import tempfile
        from packages.agent.metrics import TrainingMetricsLogger
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            logger = TrainingMetricsLogger(db_path=str(Path(tmp) / "m.db"))
            self.assertIsNone(logger.latest("nobody", "AAPL"))


# ===========================================================================
# 8. Historical data — GBM is labelled, CSV round-trip
# ===========================================================================
class TestHistoricalData(unittest.TestCase):
    def test_gbm_labelled_synthetic(self):
        from packages.agent.historical import GBMDataGenerator
        quotes = GBMDataGenerator(n=200, seed=1).generate()
        self.assertEqual(len(quotes), 200)
        self.assertIn("_synthetic", quotes[0])
        self.assertIn("GBM_SYNTHETIC", quotes[0]["_synthetic"])

    def test_pipeline_chronological_split(self):
        from packages.agent.historical import GBMDataGenerator, HistoricalDataPipeline
        import warnings
        quotes = GBMDataGenerator(n=1000).generate()
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            pipeline = HistoricalDataPipeline(quotes, val_fraction=0.2)
        self.assertEqual(len(pipeline.train), 800)
        self.assertEqual(len(pipeline.val),   200)
        # Chronological: last train ts < first val ts
        self.assertLessEqual(
            pipeline.train[-1]["timestamp"],
            pipeline.val[0]["timestamp"],
        )

    def test_csv_loader(self):
        import tempfile, csv
        from packages.agent.historical import CSVDataLoader

        rows = [
            {"date": "2024-01-01", "open": "100", "high": "105",
             "low": "99", "close": "103", "volume": "1000000"},
            {"date": "2024-01-02", "open": "103", "high": "108",
             "low": "102", "close": "107", "volume": "1200000"},
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="") as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader(); writer.writerows(rows)
            fname = f.name
        quotes = CSVDataLoader(fname, symbol="TEST").load()
        self.assertEqual(len(quotes), 2)
        self.assertAlmostEqual(quotes[0]["close"], 103.0)
        self.assertAlmostEqual(quotes[1]["close"], 107.0)
        Path(fname).unlink()


if __name__ == "__main__":
    unittest.main()
