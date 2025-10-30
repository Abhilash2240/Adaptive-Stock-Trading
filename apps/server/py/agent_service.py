import sys
import json
import os
import numpy as np

from pathlib import Path

"""
Simple stdin/stdout JSON microservice wrapper around model.py's DoubleDQNAgent.

Protocol:
  Input: single JSON object on stdin with a `type` field: init | step | train | test
  Output: single JSON object to stdout { ok: bool, data?: any, error?: str }
"""


def make_error(msg: str):
    return json.dumps({"ok": False, "error": msg})


def make_ok(data):
    return json.dumps({"ok": True, "data": data})


def load_agent(state_dim: int, action_dim: int, checkpoint: str | None = None):
    # Import model.py relative to repo root
    root = Path(__file__).resolve().parents[3]
    sys.path.insert(0, str(root))
    from model import DoubleDQNAgent  # type: ignore

    agent = DoubleDQNAgent(state_dim=state_dim, action_dim=action_dim)
    if checkpoint and os.path.exists(checkpoint):
        agent.load(checkpoint)
    return agent


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw)

        # Defaults for quick start; you may tune from client side via init
        state_dim = int(os.environ.get("AGENT_STATE_DIM", "100"))
        action_dim = int(os.environ.get("AGENT_ACTION_DIM", "5"))
        checkpoint = os.environ.get("AGENT_CHECKPOINT")

        cmd_type = payload.get("type")

        if cmd_type == "init":
            state_dim = int(payload.get("stateDim", state_dim))
            action_dim = int(payload.get("actionDim", action_dim))
            checkpoint = payload.get("checkpoint", checkpoint)
            _ = load_agent(state_dim, action_dim, checkpoint)
            print(make_ok({"initialized": True, "stateDim": state_dim, "actionDim": action_dim}))
            return

        if cmd_type == "step":
            state = payload.get("state")
            explore = bool(payload.get("explore", True))
            agent = load_agent(state_dim, action_dim, checkpoint)
            if not isinstance(state, list):
                print(make_error("state must be an array"))
                return
            action = agent.select_action(np.array(state, dtype=np.float32), explore=explore)
            q_vals = agent.get_q_values(np.array(state, dtype=np.float32)).tolist()
            print(make_ok({"action": int(action), "q_values": q_vals}))
            return

        if cmd_type == "train":
            transitions = payload.get("transitions", [])
            epochs = int(payload.get("epochs", 1))
            save_path = payload.get("savePath")
            agent = load_agent(state_dim, action_dim, checkpoint)

            # Minimal training: push provided transitions and run a few updates
            for t in transitions:
                agent.store_transition(
                    np.array(t["state"], dtype=np.float32),
                    int(t["action"]),
                    float(t["reward"]),
                    np.array(t["next_state"], dtype=np.float32),
                    float(t["done"]),
                )

            last_loss = None
            steps = 0
            for _ in range(max(1, epochs) * 100):
                loss = agent.update()
                if loss is not None:
                    last_loss = loss
                    steps += 1

            if save_path:
                agent.save(save_path, metadata={"epochs": epochs, "steps": steps})

            print(make_ok({"epochs": epochs, "avg_loss": float(last_loss or 0.0), "steps": steps, "saved": save_path}))
            return

        if cmd_type == "test":
            states = payload.get("states", [])
            agent = load_agent(state_dim, action_dim, checkpoint)
            actions = []
            qvals = []
            for s in states:
                s_np = np.array(s, dtype=np.float32)
                actions.append(int(agent.select_action(s_np, explore=False)))
                qvals.append(agent.get_q_values(s_np).tolist())
            print(make_ok({"actions": actions, "q_values": qvals}))
            return

        print(make_error("unknown command type"))
    except Exception as e:
        print(make_error(str(e)))


if __name__ == "__main__":
    main()


