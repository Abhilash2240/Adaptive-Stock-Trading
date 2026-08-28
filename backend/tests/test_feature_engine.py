import numpy as np
import pytest

from packages.agent.feature_engine import FeatureEngine


CLOSES = [
    100, 101, 102, 103, 104, 105, 106, 107, 108, 109,
    110, 111, 112, 113, 114, 115, 114, 116, 113, 117,
    112, 118, 111, 119, 110, 120, 121, 119, 122, 118,
]


def feed_prices(engine: FeatureEngine) -> None:
    for index, close in enumerate(CLOSES):
        engine.update(
            {
                "close": close,
                "high": close + 2,
                "low": close - 1,
                "volume": 100 if index < len(CLOSES) - 1 else 1_000_000,
            }
        )


def test_indicators_match_deterministic_reference_values():
    engine = FeatureEngine()
    feed_prices(engine)
    closes = np.array(CLOSES, dtype=np.float64)
    highs = closes + 2
    lows = closes - 1

    assert engine._rsi(closes, 14) == pytest.approx(0.5230769231, abs=1e-9)
    assert engine._macd(closes) == pytest.approx(0.0302241310, abs=1e-9)
    assert engine._bb_position(closes, 20) == pytest.approx(0.6858277791, abs=1e-9)
    assert engine._atr(highs, lows, closes, 14) == pytest.approx(6.2142857143, abs=1e-9)


def test_get_state_warmup_shape_dtype_and_clipping():
    engine = FeatureEngine()
    for close in CLOSES[:25]:
        engine.update({"close": close, "high": close + 2, "low": close - 1, "volume": 100})

    portfolio = {"cash": 10_000, "total_value": 10_000}
    assert engine.get_state(portfolio) is None

    for index, close in enumerate(CLOSES[25:], start=25):
        engine.update(
            {
                "close": close,
                "high": close + 2,
                "low": close - 1,
                "volume": 100 if index < len(CLOSES) - 1 else 1_000_000,
            }
        )
    state = engine.get_state(portfolio)

    assert state is not None
    assert state.shape == (14,)
    assert state.dtype == np.float32
    assert np.all(state >= -10)
    assert np.all(state <= 10)
    assert state[4] == pytest.approx(0.52307695, abs=1e-7)
    assert state[5] == pytest.approx(0.03022413, abs=1e-7)
    assert state[6] == pytest.approx(0.6858278, abs=1e-7)
    assert state[8] == pytest.approx(6.2142857 / 118, abs=1e-7)
