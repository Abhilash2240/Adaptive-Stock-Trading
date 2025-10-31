import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

HOST = "0.0.0.0"
PORT = int(os.environ.get("AGENT_PORT", "9001"))

# Import helper functions from agent_service to run in-process and keep a persistent agent
try:
    from . import agent_service as agent_service
except Exception:
    # fallback if module import style differs
    import agent_service as agent_service

# Keep a simple cache of loaded agents keyed by (state_dim, action_dim, checkpoint)
_AGENT_CACHE: dict = {}

class Handler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header('Content-type', 'application/json')
        self.end_headers()

    def do_GET(self):
        if self.path == "/healthz":
            self._set_headers(200)
            self.wfile.write(json.dumps({"ok": True, "status": "agent-worker-alive"}).encode())
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"ok": False, "error": "not found"}).encode())

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        raw = self.rfile.read(content_length)
        try:
            payload = json.loads(raw.decode())
        except Exception:
            self._set_headers(400)
            self.wfile.write(json.dumps({"ok": False, "error": "invalid json"}).encode())
            return

        cmd_type = payload.get('type')

        try:
            if cmd_type == 'quote':
                symbol = payload.get('symbol')
                if not symbol:
                    raise ValueError('No symbol provided')
                q = agent_service.get_quote(symbol)
                if q:
                    self._set_headers(200)
                    self.wfile.write(json.dumps({"ok": True, "data": q}).encode())
                else:
                    self._set_headers(404)
                    self.wfile.write(json.dumps({"ok": False, "error": 'Quote not found for ' + symbol}).encode())
                return

            if cmd_type in ('init', 'step', 'train', 'test'):
                # Extract or default dims
                state_dim = int(os.environ.get('AGENT_STATE_DIM', '100'))
                action_dim = int(os.environ.get('AGENT_ACTION_DIM', '5'))
                checkpoint = os.environ.get('AGENT_CHECKPOINT')
                # Allow payload overrides
                state_dim = int(payload.get('stateDim', state_dim))
                action_dim = int(payload.get('actionDim', action_dim))
                checkpoint = payload.get('checkpoint', checkpoint)

                cache_key = (state_dim, action_dim, checkpoint)
                agent = _AGENT_CACHE.get(cache_key)
                if agent is None:
                    agent = agent_service.load_agent(state_dim, action_dim, checkpoint)
                    _AGENT_CACHE[cache_key] = agent

                if cmd_type == 'init':
                    self._set_headers(200)
                    self.wfile.write(json.dumps({"ok": True, "data": {"initialized": True, "stateDim": state_dim, "actionDim": action_dim}}).encode())
                    return

                if cmd_type == 'step':
                    state = payload.get('state')
                    explore = bool(payload.get('explore', True))
                    if not isinstance(state, list):
                        self._set_headers(400)
                        self.wfile.write(json.dumps({"ok": False, "error": 'state must be an array'}).encode())
                        return
                    import numpy as _np
                    action = agent.select_action(_np.array(state, dtype=_np.float32), explore=explore)
                    q_vals = agent.get_q_values(_np.array(state, dtype=_np.float32)).tolist()
                    self._set_headers(200)
                    self.wfile.write(json.dumps({"ok": True, "data": {"action": int(action), "q_values": q_vals}}).encode())
                    return

                if cmd_type == 'train':
                    transitions = payload.get('transitions', [])
                    epochs = int(payload.get('epochs', 1))
                    save_path = payload.get('savePath')
                    # push transitions into agent
                    import numpy as _np
                    for t in transitions:
                        agent.store_transition(
                            _np.array(t['state'], dtype=_np.float32),
                            int(t['action']),
                            float(t['reward']),
                            _np.array(t['next_state'], dtype=_np.float32),
                            float(t['done']),
                        )
                    last_loss = None
                    steps = 0
                    for _ in range(max(1, epochs) * 100):
                        loss = agent.update()
                        if loss is not None:
                            last_loss = loss
                            steps += 1
                    if save_path:
                        agent.save(save_path, metadata={'epochs': epochs, 'steps': steps})
                    self._set_headers(200)
                    self.wfile.write(json.dumps({"ok": True, "data": {"epochs": epochs, "avg_loss": float(last_loss or 0.0), "steps": steps, "saved": save_path}}).encode())
                    return

                if cmd_type == 'test':
                    states = payload.get('states', [])
                    actions = []
                    qvals = []
                    import numpy as _np
                    for s in states:
                        s_np = _np.array(s, dtype=_np.float32)
                        actions.append(int(agent.select_action(s_np, explore=False)))
                        qvals.append(agent.get_q_values(s_np).tolist())
                    self._set_headers(200)
                    self.wfile.write(json.dumps({"ok": True, "data": {"actions": actions, "q_values": qvals}}).encode())
                    return

            self._set_headers(400)
            self.wfile.write(json.dumps({"ok": False, "error": 'unknown command type'}).encode())
        except Exception as e:
            self._set_headers(500)
            self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode())

def run():
    server = HTTPServer((HOST, PORT), Handler)
    print(f"Agent worker (in-process) listening on {HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()

if __name__ == '__main__':
    run()
