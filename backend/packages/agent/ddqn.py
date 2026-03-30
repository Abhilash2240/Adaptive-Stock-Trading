from __future__ import annotations

import random
from collections import deque
from datetime import datetime, timezone

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim


# -- Neural network -------------------------------------------------
class DQNetwork(nn.Module):
    def __init__(self, state_dim: int, action_dim: int, hidden: int = 256):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(state_dim, hidden), nn.ReLU(),
            nn.Linear(hidden, hidden),    nn.ReLU(),
            nn.Linear(hidden, hidden // 2), nn.ReLU(),
            nn.Linear(hidden // 2, action_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


# -- Replay buffer --------------------------------------------------
class ReplayBuffer:
    def __init__(self, capacity: int = 50_000):
        self.buffer: deque = deque(maxlen=capacity)

    def push(self, state, action, reward, next_state, done):
        self.buffer.append((
            np.array(state, dtype=np.float32),
            int(action),
            float(reward),
            np.array(next_state, dtype=np.float32),
            bool(done),
        ))

    def sample(self, batch_size: int):
        batch = random.sample(self.buffer, batch_size)
        s, a, r, ns, d = zip(*batch)
        return (
            torch.FloatTensor(np.array(s)),
            torch.LongTensor(a),
            torch.FloatTensor(r),
            torch.FloatTensor(np.array(ns)),
            torch.FloatTensor(d),
        )

    def __len__(self) -> int:
        return len(self.buffer)


# -- DDQN agent -----------------------------------------------------
class DDQNAgent:
    ACTION_NAMES = {0: "HOLD", 1: "BUY", 2: "SELL"}

    def __init__(
        self,
        state_dim: int = 14,
        action_dim: int = 3,
        lr: float = 1e-4,
        gamma: float = 0.99,
        epsilon: float = 1.0,
        epsilon_min: float = 0.05,
        epsilon_decay: float = 0.995,
        batch_size: int = 64,
        target_update_freq: int = 500,
        buffer_capacity: int = 50_000,
    ):
        self.device = torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )
        self.action_dim = action_dim
        self.gamma = gamma
        self.epsilon = epsilon
        self.epsilon_min = epsilon_min
        self.epsilon_decay = epsilon_decay
        self.batch_size = batch_size
        self.target_update_freq = target_update_freq
        self.step_count = 0
        self.last_trained: datetime | None = None

        self.online_net = DQNetwork(state_dim, action_dim).to(self.device)
        self.target_net = DQNetwork(state_dim, action_dim).to(self.device)
        self.target_net.load_state_dict(self.online_net.state_dict())
        self.target_net.eval()

        self.optimizer = optim.Adam(self.online_net.parameters(), lr=lr)
        self.loss_fn = nn.SmoothL1Loss()
        self.replay = ReplayBuffer(buffer_capacity)

    # -- Inference --------------------------------------------------
    def act(self, state: np.ndarray, training: bool = False) -> int:
        if training and random.random() < self.epsilon:
            return random.randrange(self.action_dim)
        t = torch.FloatTensor(state).unsqueeze(0).to(self.device)
        with torch.no_grad():
            return int(self.online_net(t).argmax(dim=1).item())

    def q_values(self, state: np.ndarray) -> list[float]:
        t = torch.FloatTensor(state).unsqueeze(0).to(self.device)
        with torch.no_grad():
            return self.online_net(t).squeeze().tolist()

    def confidence(self, q_vals: list[float]) -> float:
        """Softmax probability of the chosen action as confidence score."""
        arr = np.array(q_vals, dtype=np.float64)
        exp = np.exp(arr - arr.max())
        return float(exp.max() / exp.sum())

    # -- Training ---------------------------------------------------
    def remember(self, state, action, reward, next_state, done):
        self.replay.push(state, action, reward, next_state, done)

    def train_step(self) -> float | None:
        if len(self.replay) < self.batch_size:
            return None
        s, a, r, ns, d = [t.to(self.device)
                          for t in self.replay.sample(self.batch_size)]
        with torch.no_grad():
            next_a = self.online_net(ns).argmax(dim=1)
            target_q = r + self.gamma * (1 - d) * \
                self.target_net(ns).gather(1, next_a.unsqueeze(1)).squeeze()
        current_q = self.online_net(s).gather(1, a.unsqueeze(1)).squeeze()
        loss = self.loss_fn(current_q, target_q)
        self.optimizer.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(self.online_net.parameters(), 1.0)
        self.optimizer.step()
        self.step_count += 1
        if self.step_count % self.target_update_freq == 0:
            self.target_net.load_state_dict(self.online_net.state_dict())
        self.epsilon = max(self.epsilon_min,
                           self.epsilon * self.epsilon_decay)
        self.last_trained = datetime.now(timezone.utc)
        return loss.item()

    # -- Persistence ------------------------------------------------
    def save(self, path: str) -> None:
        torch.save({
            "online": self.online_net.state_dict(),
            "target": self.target_net.state_dict(),
            "optimizer": self.optimizer.state_dict(),
            "epsilon": self.epsilon,
            "step_count": self.step_count,
        }, path)

    def load(self, path: str) -> None:
        ckpt = torch.load(path, map_location=self.device)
        self.online_net.load_state_dict(ckpt["online"])
        self.target_net.load_state_dict(ckpt["target"])
        self.optimizer.load_state_dict(ckpt["optimizer"])
        self.epsilon = ckpt.get("epsilon", self.epsilon_min)
        self.step_count = ckpt.get("step_count", 0)
