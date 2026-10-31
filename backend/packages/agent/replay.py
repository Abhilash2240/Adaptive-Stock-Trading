"""
replay.py — Replay Buffers for DDQN Training
=============================================
Fixes (from deep-dive doc):
  § "Uniform replay sampling" — adds Prioritized Experience Replay (PER)
    with a SumTree-backed proportional sampler and IS-weight correction.

Why PER works:
  Uniform sampling gives equal probability to a catastrophic-loss transition
  and a boring HOLD-with-no-price-change transition.  PER revisits high-TD-
  error transitions more often, compressing learning time.  Importance-
  sampling weights correct the introduced bias:
      w_i = (N · P(i))^{-beta}  normalised by max(w)
  beta anneals from BETA_START → 1.0 over BETA_FRAMES for unbiased updates.

Drop-in compatibility:
  UniformReplayBuffer has the same push/sample/__len__ API as the original.
  ReplayBuffer is kept as an alias.  PrioritizedReplayBuffer.sample()
  returns two extra values (IS weights, tree indices) consumed by DDQNAgent
  when use_per=True.
"""
from __future__ import annotations

import random
from collections import deque

import numpy as np
import torch


# ---------------------------------------------------------------------------
# Uniform buffer  (original behaviour, preserved for A/B testing)
# ---------------------------------------------------------------------------

class UniformReplayBuffer:
    """Uniform random replay buffer — same API as the original ReplayBuffer."""

    def __init__(self, capacity: int = 50_000) -> None:
        self.buffer: deque = deque(maxlen=capacity)

    def push(self, state, action, reward, next_state, done) -> None:
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


# Backward-compatible alias
ReplayBuffer = UniformReplayBuffer


# ---------------------------------------------------------------------------
# SumTree
# ---------------------------------------------------------------------------

class SumTree:
    """
    Binary tree: leaves hold priorities; internal nodes hold subtree sums.
    Enables O(log n) priority-proportional sampling and priority updates.

    Tree layout (capacity=4):
        index 0          <- root (total sum)
             / \\
            1   2
           /\\ /\\
          3  4 5  6      <- leaves (capacity-1 .. 2*capacity-2)
    Data is stored in a circular list aligned with leaf positions.
    """

    def __init__(self, capacity: int) -> None:
        self.capacity = capacity
        self.tree = np.zeros(2 * capacity - 1, dtype=np.float64)
        self.data: list = [None] * capacity
        self._write = 0
        self._n_entries = 0

    @property
    def total(self) -> float:
        return float(self.tree[0])

    def __len__(self) -> int:
        return self._n_entries

    def add(self, priority: float, data) -> None:
        tree_idx = self._write + self.capacity - 1
        self.data[self._write] = data
        self._set(tree_idx, priority)
        self._write = (self._write + 1) % self.capacity
        self._n_entries = min(self._n_entries + 1, self.capacity)

    def update(self, tree_idx: int, priority: float) -> None:
        self._set(tree_idx, priority)

    def get(self, s: float) -> tuple[int, float, object]:
        """Return (tree_idx, priority, data) for cumulative value s."""
        idx = self._retrieve(0, s)
        data_idx = idx - self.capacity + 1
        return idx, float(self.tree[idx]), self.data[data_idx]

    def _set(self, idx: int, priority: float) -> None:
        delta = priority - self.tree[idx]
        self.tree[idx] = priority
        while idx > 0:
            idx = (idx - 1) // 2
            self.tree[idx] += delta

    def _retrieve(self, idx: int, s: float) -> int:
        left = 2 * idx + 1
        right = left + 1
        if left >= len(self.tree):
            return idx
        if s <= self.tree[left]:
            return self._retrieve(left, s)
        return self._retrieve(right, s - self.tree[left])


# ---------------------------------------------------------------------------
# Prioritized Experience Replay
# ---------------------------------------------------------------------------

class PrioritizedReplayBuffer:
    """
    Proportional PER.  Transitions sampled with probability
        P(i) = p_i^alpha / sum_k p_k^alpha
    where p_i = |TD-error_i| + epsilon.

    .sample() returns a 7-tuple:
        (states, actions, rewards, next_states, dones, IS_weights, tree_indices)
    Call .update_priorities(tree_indices, td_errors) after each train_step.
    """

    ALPHA: float = 0.6
    BETA_START: float = 0.4
    BETA_FRAMES: int = 100_000
    MIN_PRIORITY: float = 1e-6

    def __init__(self, capacity: int = 50_000) -> None:
        self.tree = SumTree(capacity)
        self.capacity = capacity
        self._beta_frame: int = 0

    def push(self, state, action, reward, next_state, done) -> None:
        leaf_start = self.tree.capacity - 1
        max_p = self.tree.tree[leaf_start:].max()
        priority = float(max_p) if max_p > 0 else 1.0
        transition = (
            np.array(state, dtype=np.float32),
            int(action),
            float(reward),
            np.array(next_state, dtype=np.float32),
            bool(done),
        )
        self.tree.add(priority, transition)

    def sample(self, batch_size: int):
        assert len(self.tree) >= batch_size, "Buffer smaller than batch_size"
        self._beta_frame += 1
        beta = min(
            1.0,
            self.BETA_START + self._beta_frame * (1.0 - self.BETA_START) / self.BETA_FRAMES,
        )

        segment = self.tree.total / batch_size
        indices, priorities, transitions = [], [], []

        for i in range(batch_size):
            s = random.uniform(segment * i, segment * (i + 1))
            idx, p, data = self.tree.get(s)
            if data is None:
                s = random.uniform(0, self.tree.total)
                idx, p, data = self.tree.get(s)
            indices.append(idx)
            priorities.append(max(float(p), self.MIN_PRIORITY))
            transitions.append(data)

        probs = np.array(priorities, dtype=np.float64) / self.tree.total
        weights = (len(self.tree) * probs) ** (-beta)
        weights = (weights / weights.max()).astype(np.float32)

        s, a, r, ns, d = zip(*transitions)
        return (
            torch.FloatTensor(np.array(s)),
            torch.LongTensor(a),
            torch.FloatTensor(r),
            torch.FloatTensor(np.array(ns)),
            torch.FloatTensor(d),
            torch.FloatTensor(weights),
            indices,
        )

    def update_priorities(self, indices: list[int], td_errors: np.ndarray) -> None:
        for idx, err in zip(indices, td_errors):
            p = (float(abs(err)) + self.MIN_PRIORITY) ** self.ALPHA
            self.tree.update(idx, p)

    def __len__(self) -> int:
        return len(self.tree)
