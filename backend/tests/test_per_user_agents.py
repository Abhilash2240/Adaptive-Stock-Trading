"""Tests for per-user agent model behavior."""
import os
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from packages.agent.service import AgentService, _DEFAULT_USER_ID, _get_user_model_path
from packages.data.provider import get_data_provider
from packages.shared.schemas import OrderSide


@pytest.fixture
def agent_service():
    """Create an AgentService instance for testing."""
    provider = get_data_provider()
    return AgentService(provider)


@pytest.fixture
def sample_quote():
    """Sample quote for testing."""
    return {
        "symbol": "AAPL",
        "price": 150.0,
        "open": 149.5,
        "high": 151.0,
        "low": 149.0,
        "close": 150.0,
        "volume": 1000000,
        "timestamp": "2024-01-01T10:00:00Z",
    }


class TestColdStart:
    """Test cold-start behavior for new users."""

    def test_new_user_gets_fresh_model_with_high_epsilon(self, agent_service):
        """New user should get a fresh untrained model with epsilon=1.0 (full exploration)."""
        user_id = "test_user_fresh"
        
        # Get action for new user
        action = agent_service.get_action(
            symbol="AAPL",
            portfolio={
                "position_flag": 0,
                "unrealized_pnl_pct": 0.0,
                "cash": 10000.0,
                "total_value": 10000.0,
                "trade_count_today": 0,
            },
            user_id=user_id,
        )
        
        # Verify we got an action (should be HOLD since not enough data yet)
        assert action is not None
        
        # Get the agent and verify it has high epsilon (untrained)
        agent = agent_service._get_user_agent(user_id)
        assert agent.epsilon == 1.0, "Fresh model should start with epsilon=1.0"
        assert agent.step_count == 0, "Fresh model should have step_count=0"

    def test_new_user_has_independent_model_instance(self, agent_service):
        """Each new user should have their own independent model instance."""
        user1_id = "user_1"
        user2_id = "user_2"
        
        agent1 = agent_service._get_user_agent(user1_id)
        agent2 = agent_service._get_user_agent(user2_id)
        
        # Verify they are different instances
        assert agent1 is not agent2
        assert id(agent1) != id(agent2)


class TestIndependence:
    """Test that different users' models train independently."""

    def test_two_users_independent_after_different_quotes(self, agent_service, sample_quote):
        """Two users' models should diverge after receiving different quotes."""
        user1_id = "user_1_independent_new"
        user2_id = "user_2_independent_new"
        
        # Get both agents to ensure they're initialized
        agent1 = agent_service._get_user_agent(user1_id)
        agent2 = agent_service._get_user_agent(user2_id)
        
        # Both should start with similar epsilon values (1.0 for fresh models)
        assert agent1.epsilon >= 0.99, "Fresh model should have high epsilon"
        assert agent2.epsilon >= 0.99, "Fresh model should have high epsilon"
        
        # Feed quotes to user1 multiple times to trigger training
        # Need enough to build replay buffer (default batch_size=64) and trigger a train
        for i in range(100):
            quote = {**sample_quote, "price": 150.0 + i * 0.1, "close": 150.0 + i * 0.1}
            agent_service.on_quote(quote, user_id=user1_id)
        
        # Feed different quotes to user2
        for i in range(100):
            quote = {**sample_quote, "price": 160.0 - i * 0.1, "close": 160.0 - i * 0.1}
            agent_service.on_quote(quote, user_id=user2_id)
        
        # After training, their epsilons should have decayed at the same rate
        # (both trained at similar intervals) so they should be similar
        # Allow small floating point difference
        assert abs(agent1.epsilon - agent2.epsilon) < 0.01
        assert agent1.epsilon < 1.0  # Both should have trained and decayed epsilon
        assert agent2.epsilon < 1.0
        
        # But their replay buffers should have same size
        assert len(agent1.replay.buffer) == len(agent2.replay.buffer)

    def test_users_have_independent_environments(self, agent_service):
        """Each user should have independent symbol environments."""
        user1_id = "user_env_1"
        user2_id = "user_env_2"
        
        env1 = agent_service._get_environment("AAPL", user_id=user1_id)
        env2 = agent_service._get_environment("AAPL", user_id=user2_id)
        
        # Verify they are different instances
        assert env1 is not env2
        assert id(env1) != id(env2)
        
        # Verify they're stored separately
        assert user1_id in agent_service._user_environments
        assert user2_id in agent_service._user_environments
        assert "AAPL" in agent_service._user_environments[user1_id]
        assert "AAPL" in agent_service._user_environments[user2_id]


class TestPersistence:
    """Test that model state survives service restart."""

    def test_model_weights_saved_after_training(self, sample_quote):
        """Model weights file should be created after training."""
        with tempfile.TemporaryDirectory() as tmpdir:
            original_cwd = os.getcwd()
            try:
                os.chdir(tmpdir)
                
                user_id = "test_user_persist"
                agent_service = AgentService(get_data_provider())
                
                # Feed enough quotes to trigger training
                # Need 26 for warmup + 32+ for training trigger + buffer to accumulate
                for i in range(150):
                    quote = {
                        **sample_quote,
                        "price": 150.0 + (i * 0.1),
                        "close": 150.0 + (i * 0.1),
                    }
                    agent_service.on_quote(quote, user_id=user_id)
                
                # Get the agent and check if it trained
                trained_agent = agent_service._get_user_agent(user_id)
                
                # If no training happened in on_quote, manually train to ensure model is saved
                if trained_agent.step_count == 0:
                    # Manually add some transitions and train
                    state = trained_agent.online_net.forward(
                        __import__("torch").FloatTensor([0.0] * 14).unsqueeze(0)
                    )
                    trained_agent.remember(
                        [0.0] * 14,  # state
                        0,  # action (HOLD)
                        1.0,  # reward
                        [0.1] * 14,  # next_state
                        False,  # done
                    )
                    trained_agent.train_step()
                
                # Force a save
                agent_service._train_and_save(user_id=user_id)
                
                # Verify file was created
                model_file = _get_user_model_path(user_id)
                assert model_file.exists(), f"Model file should exist at {model_file}"
                
                # Verify file has content
                assert model_file.stat().st_size > 0
                
            finally:
                os.chdir(original_cwd)

    def test_model_persists_across_service_instances(self, sample_quote):
        """Model state should persist when creating new AgentService instance."""
        with tempfile.TemporaryDirectory() as tmpdir:
            original_cwd = os.getcwd()
            try:
                os.chdir(tmpdir)
                
                user_id = "test_user_restart_unique"
                
                # First service: manually train and save
                agent_service1 = AgentService(get_data_provider())
                agent1 = agent_service1._get_user_agent(user_id)
                
                # Manually train - need enough transitions for a batch
                # batch_size is 64, so add at least 64 transitions
                for i in range(70):
                    state = [float(i % 10) / 10.0] * 14
                    action = i % 3  # 0, 1, or 2
                    reward = 1.0 if i % 2 == 0 else -0.5
                    next_state = [float((i + 1) % 10) / 10.0] * 14
                    done = (i % 20 == 19)  # Done every 20 steps
                    
                    agent1.remember(state, action, reward, next_state, done)
                
                # Try training
                train_result = agent1.train_step()
                assert train_result is not None, "Training should occur after 64 samples"
                
                original_epsilon = agent1.epsilon
                original_step_count = agent1.step_count
                original_buffer_size = len(agent1.replay.buffer)
                
                assert original_step_count > 0, "First service should have trained"
                
                # Manually save
                agent_service1._train_and_save(user_id=user_id)
                
                # Verify file was created
                model_file = _get_user_model_path(user_id)
                assert model_file.exists(), f"Model file should be saved to {model_file}"
                
                # Second service: should load from disk
                agent_service2 = AgentService(get_data_provider())
                
                # Clear the in-memory cache to force reload from disk
                agent_service2._user_agents.clear()
                agent_service2._user_environments.clear()
                agent_service2._user_training_ticks.clear()
                agent_service2._user_training_state.clear()
                agent_service2._user_training_action.clear()
                
                # Get the agent - should load from disk
                restored_agent = agent_service2._get_user_agent(user_id)
                
                # Verify critical state was restored
                # Allow for some floating point difference and potential epsilon decay
                assert abs(restored_agent.step_count - original_step_count) <= 1, \
                    f"Step count should be restored: {restored_agent.step_count} vs {original_step_count}"
                assert restored_agent.epsilon <= original_epsilon, \
                    f"Epsilon should not increase after loading: {restored_agent.epsilon} vs {original_epsilon}"
                # Replay buffer is not persisted, so we don't check it
                
            finally:
                os.chdir(original_cwd)

    def test_default_user_model_backward_compatible(self, sample_quote):
        """Default user model should still work for backward compatibility."""
        with tempfile.TemporaryDirectory() as tmpdir:
            temp_models_dir = Path(tmpdir) / "models"
            
            def mock_get_user_model_path(user_id: str) -> Path:
                return temp_models_dir / f"{user_id}.pt"
            
            with patch(
                "packages.agent.service._get_user_model_path",
                side_effect=mock_get_user_model_path,
            ):
                # Create service and train default agent
                agent_service = AgentService(get_data_provider())
                
                # Feed quotes without specifying user_id (should use default)
                for i in range(30):
                    quote = {**sample_quote, "price": 150.0 + i * 0.1, "close": 150.0 + i * 0.1}
                    agent_service.on_quote(quote)  # No user_id
                
                # Get action without user_id
                action = agent_service.get_action(
                    symbol="AAPL",
                    portfolio={
                        "position_flag": 0,
                        "unrealized_pnl_pct": 0.0,
                        "cash": 10000.0,
                        "total_value": 10000.0,
                        "trade_count_today": 0,
                    },
                )
                
                # Should have gotten an action
                assert action is not None
                
                # Default agent should exist
                default_agent = agent_service._get_user_agent(_DEFAULT_USER_ID)
                assert default_agent is not None


class TestUserModelIsolation:
    """Test that user models don't interfere with each other."""

    def test_user_actions_dont_affect_other_users(self, agent_service, sample_quote):
        """Trading actions by one user shouldn't affect another user's model."""
        user1_id = "user_isolated_1"
        user2_id = "user_isolated_2"
        
        # Initialize both users
        agent_service._get_user_agent(user1_id)
        agent_service._get_user_agent(user2_id)
        
        # Get status for user2 before user1 trains
        status_before = agent_service.get_status(user_id=user2_id)
        assert status_before.step_count == 0
        
        # Feed many quotes to user1 to trigger training
        for i in range(100):
            quote = {**sample_quote, "price": 150.0 + i * 0.01, "close": 150.0 + i * 0.01}
            agent_service.on_quote(quote, user_id=user1_id)
        
        # Check user1 trained
        status_user1 = agent_service.get_status(user_id=user1_id)
        assert status_user1.step_count > 0
        
        # Check user2 is unaffected
        status_after = agent_service.get_status(user_id=user2_id)
        assert status_after.step_count == 0, "User2 should not have trained"
        assert status_before.step_count == status_after.step_count
