import numpy as np

from packages.agent.ddqn import DDQNAgent
from packages.agent.environment import TradingEnvironment


def quote(price: float) -> dict:
    return {"symbol": "AAPL", "price": price, "volume": 1}


def warm_environment(price: float = 100.0) -> TradingEnvironment:
    environment = TradingEnvironment()
    for _ in range(26):
        environment.on_quote(quote(price))
    return environment


def test_buy_then_price_up_has_positive_reward():
    environment = warm_environment()
    environment.on_quote(quote(100.0), TradingEnvironment.BUY)

    _, reward, _ = environment.on_quote(quote(110.0), TradingEnvironment.HOLD)

    assert reward > 0


def test_sell_then_price_up_has_negative_reward():
    environment = warm_environment()
    environment.on_quote(quote(100.0), TradingEnvironment.SELL)

    _, reward, _ = environment.on_quote(quote(110.0), TradingEnvironment.HOLD)

    assert reward < 0


def test_remember_populates_replay_buffer():
    environment = warm_environment()
    state, _, _ = environment.on_quote(quote(100.0), TradingEnvironment.HOLD)
    next_state, reward, done = environment.on_quote(quote(101.0), TradingEnvironment.BUY)

    agent = DDQNAgent(batch_size=1)
    agent.remember(state, TradingEnvironment.BUY, reward, next_state, done)

    assert len(agent.replay) == 1
    replay_state, replay_action, replay_reward, replay_next_state, replay_done = agent.replay.buffer[0]
    assert isinstance(replay_state, np.ndarray)
    assert replay_action == TradingEnvironment.BUY
    assert replay_reward == reward
    assert np.array_equal(replay_next_state, next_state)
    assert replay_done is done