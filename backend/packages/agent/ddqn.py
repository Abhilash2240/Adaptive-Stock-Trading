"""
ddqn.py — Double DQN Agent (Drop-in Replacement)
=================================================
Fixes (from deep-dive doc):
  § "No dueling architecture" — adds DuelingDQNetwork alongside original
    DQNetwork; both selectable via use_dueling flag.
  § "No action mask" — act() accepts an optional action_mask list of bools
    so callers can disable shorting for long-only products.
  § "Hard target sync only" — supports both hard (every N steps) and soft /
    Polyak-averaged (tau blend per step) target updates via tau parameter.
  § "Uniform replay sampling" — integrates with PrioritizedReplayBuffer
    (use_per=True); falls back to UniformReplayBuffer for A/B comparison.
  § LayerNorm in DuelingDQNetwork — BatchNorm's running stats misbehave at
    batch_size=1 (live tick-by-tick inference).  LayerNorm normalises per
    sample, so it behaves identically during training and inference.

DDQN correctness preserved:
  online_net  SELECTS  next action  (argmax Q_online(s'))
  target_net  EVALUATES that action (Q_target(s', a*))
  This prevents the overestimation bias of vanilla DQN.

Public API is a strict superset of the original DDQNAgent — all new
parameters have defaults matching the original behaviour, so existing
callers (service.py) need zero changes.
"""
from __future__ import annotations

import random
from datetime import datetime, timezone

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim

from packages.agent.replay import (
    PrioritizedReplayBuffer,
    UniformReplayBuffer,
    ReplayBuffer,   # backward-compat alias
)


# ---------------------------------------------------------------------------
# Networks
# ---------------------------------------------------------------------------

class DQNetwork(nn.Module):
    """Original plain MLP — kept for backward compat and A/B ablation."""

    def __init__(self, state_dim: int, action_dim: int, hidden: int = 256) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(state_dim, hidden), nn.ReLU(),
            nn.Linear(hidden, hidden),    nn.ReLU(),
            nn.Linear(hidden, hidden // 2), nn.ReLU(),
            nn.Linear(hidden // 2, action_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class DuelingDQNetwork(nn.Module):
    """
    Dueling DQN:  Q(s,a) = V(s) + (A(s,a) - mean_a A(s,a))

    Why dueling helps in trading:
      The agent spends most of its time in the HOLD state.  In vanilla DQN
      the network must learn V(s) implicitly from every action.  Dueling
      separates V(s) (how good is this market state?) from A(s,a) (what is
      the relative benefit of BUY vs SELL vs HOLD?), which accelerates
      learning when many states share similar values.

    LayerNorm instead of BatchNorm:
      BatchNorm accumulates running statistics over batches.  At inference
      time (single tick) batch_size=1, which makes BatchNorm stats
      unreliable.  LayerNorm normalises each sample independently and is
      therefore identical at train-time (batch) and inference-time (single).
    """

    def __init__(self, state_dim: int, action_dim: int, hidden: int = 256) -> None:
        super().__init__()
        self.shared = nn.Sequential(
            nn.Linear(state_dim, hidden),
            nn.LayerNorm(hidden),
            nn.ReLU(),
            nn.Linear(hidden, hidden),
            nn.LayerNorm(hidden),
            nn.ReLU(),
        )
        self.value_stream = nn.Sequential(
            nn.Linear(hidden, hidden // 2),
            nn.ReLU(),
            nn.Linear(hidden // 2, 1),
        )
        self.advantage_stream = nn.Sequential(
            nn.Linear(hidden, hidden // 2),
            nn.ReLU(),
            nn.Linear(hidden // 2, action_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        feat = self.shared(x)
        v    = self.value_stream(feat)
        a    = self.advantage_stream(feat)
        return v + (a - a.mean(dim=1, keepdim=True))


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

class DDQNAgent:
    ACTION_NAMES = {0: "HOLD", 1: "BUY", 2: "SELL"}

    def __init__(
        self,
        state_dim:         int   = 14,
        action_dim:        int   = 3,
        lr:                float = 1e-4,
        gamma:             float = 0.99,
        epsilon:           float = 1.0,
        epsilon_min:       float = 0.05,
        epsilon_decay:     float = 0.995,
        batch_size:        int   = 64,
        target_update_freq: int  = 500,   # hard sync every N steps (ignored if tau>0)
        tau:               float = 0.0,   # soft/Polyak sync (0 = disabled, use hard)
        buffer_capacity:   int   = 50_000,
        use_per:           bool  = False,
        use_dueling:       bool  = False,
    ) -> None:
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        self.action_dim        = action_dim
        self.gamma             = gamma
        self.epsilon           = epsilon
        self.epsilon_min       = epsilon_min
        self.epsilon_decay     = epsilon_decay
        self.batch_size        = batch_size
        self.target_update_freq = target_update_freq
        self.tau               = tau
        self.use_per           = use_per
        self.step_count        = 0
        self.last_trained: datetime | None = None

        NetClass = DuelingDQNetwork if use_dueling else DQNetwork
        self.online_net = NetClass(state_dim, action_dim).to(self.device)
        self.target_net = NetClass(state_dim, action_dim).to(self.device)
        self.target_net.load_state_dict(self.online_net.state_dict())
        self.target_net.eval()

        self.optimizer = optim.Adam(self.online_net.parameters(), lr=lr)
        self.loss_fn   = nn.SmoothL1Loss(reduction="none")

        self.replay = (
            PrioritizedReplayBuffer(buffer_capacity)
            if use_per
            else UniformReplayBuffer(buffer_capacity)
        )

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def act(
        self,
        state: np.ndarray,
        training: bool = False,
        action_mask: list[bool] | None = None,
    ) -> int:
        """
        Select an action.
        action_mask: optional list of bools (len == action_dim).
                     True  = action is legal.
                     False = action is forbidden (masked to -inf before argmax).
        """
        if training and random.random() < self.epsilon:
            if action_mask is not None:
                allowed = [i for i, ok in enumerate(action_mask) if ok]
                return random.choice(allowed) if allowed else 0
            return random.randrange(self.action_dim)

        t = torch.FloatTensor(state).unsqueeze(0).to(self.device)
        with torch.no_grad():
            q = self.online_net(t)
            if action_mask is not None:
                mask = torch.tensor(action_mask, dtype=torch.bool, device=self.device)
                q = q.masked_fill(~mask.unsqueeze(0), float("-inf"))
            return int(q.argmax(dim=1).item())

    def q_values(self, state: np.ndarray) -> list[float]:
        t = torch.FloatTensor(state).unsqueeze(0).to(self.device)
        with torch.no_grad():
            return self.online_net(t).squeeze().tolist()

    def confidence(self, q_vals: list[float]) -> float:
        arr = np.array(q_vals, dtype=np.float64)
        exp = np.exp(arr - arr.max())
        return float(exp.max() / exp.sum())

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def remember(self, state, action, reward, next_state, done) -> None:
        self.replay.push(state, action, reward, next_state, done)

    def train_step(self) -> float | None:
        if len(self.replay) < self.batch_size:
            return None

        # -- Sample (PER returns IS weights + indices; uniform does not) --
        if self.use_per:
            s, a, r, ns, d, weights, indices = self.replay.sample(self.batch_size)
            weights = weights.to(self.device)
        else:
            s, a, r, ns, d = self.replay.sample(self.batch_size)
            weights = torch.ones(self.batch_size, device=self.device)
            indices = None

        s  = s.to(self.device)
        a  = a.to(self.device)
        r  = r.to(self.device)
        ns = ns.to(self.device)
        d  = d.to(self.device)

        # -- DDQN target: online SELECTS, target EVALUATES ---------------
        with torch.no_grad():
            next_a   = self.online_net(ns).argmax(dim=1)           # select
            q_target = self.target_net(ns).gather(                  # evaluate
                1, next_a.unsqueeze(1)
            ).squeeze(1)
            target_q = r + self.gamma * (1.0 - d) * q_target

        current_q  = self.online_net(s).gather(1, a.unsqueeze(1)).squeeze(1)
        td_errors   = (target_q - current_q).detach().cpu().numpy()

        # -- Weighted Huber loss (IS correction for PER) -----------------
        element_loss = self.loss_fn(current_q, target_q)
        loss = (element_loss * weights).mean()

        self.optimizer.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(self.online_net.parameters(), 1.0)
        self.optimizer.step()

        self.step_count += 1

        # -- Target network sync -----------------------------------------
        if self.tau > 0.0:
            # Soft / Polyak update every step
            for p_on, p_tgt in zip(
                self.online_net.parameters(), self.target_net.parameters()
            ):
                p_tgt.data.copy_(self.tau * p_on.data + (1.0 - self.tau) * p_tgt.data)
        elif self.step_count % self.target_update_freq == 0:
            # Hard update every N steps
            self.target_net.load_state_dict(self.online_net.state_dict())

        self.epsilon       = max(self.epsilon_min, self.epsilon * self.epsilon_decay)
        self.last_trained  = datetime.now(timezone.utc)

        # -- Feed TD errors back to PER priority tree --------------------
        if self.use_per and indices is not None:
            self.replay.update_priorities(indices, td_errors)

        return float(loss.item())

    # ------------------------------------------------------------------
    # Persistence (unchanged public API)
    # ------------------------------------------------------------------

    def save(self, path: str) -> None:
        torch.save({
            "online":     self.online_net.state_dict(),
            "target":     self.target_net.state_dict(),
            "optimizer":  self.optimizer.state_dict(),
            "epsilon":    self.epsilon,
            "step_count": self.step_count,
        }, path)

    def load(self, path: str) -> None:
        ckpt = torch.load(path, map_location=self.device, weights_only=False)  # nosec B614
        self.online_net.load_state_dict(ckpt["online"])
        self.target_net.load_state_dict(ckpt["target"])
        self.optimizer.load_state_dict(ckpt["optimizer"])
        self.epsilon    = ckpt.get("epsilon",    self.epsilon_min)
        self.step_count = ckpt.get("step_count", 0)
