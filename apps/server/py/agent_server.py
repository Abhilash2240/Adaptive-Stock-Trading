import json
import os
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer

HOST = "0.0.0.0"
PORT = int(os.environ.get("AGENT_PORT", "9001"))
PYTHON_CMD = os.environ.get("PYTHON_CMD", "python3")
SCRIPT_PATH = os.path.join(os.path.dirname(__file__), "agent_service.py")

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
        # Expect JSON body containing the same shape that agent_service expects
        content_length = int(self.headers.get('Content-Length', 0))
        raw = self.rfile.read(content_length)
        try:
            payload = json.loads(raw.decode())
        except Exception as e:
            self._set_headers(400)
            self.wfile.write(json.dumps({"ok": False, "error": "invalid json"}).encode())
            return

        # Spawn the agent_service.py script and pass the JSON on stdin
        try:
            proc = subprocess.run([PYTHON_CMD, SCRIPT_PATH], input=json.dumps(payload).encode(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
            stdout = proc.stdout.decode().strip()
            if proc.returncode != 0:
                self._set_headers(500)
                self.wfile.write(json.dumps({"ok": False, "error": proc.stderr.decode()}).encode())
                return
            # Try to parse and return the JSON the agent emitted
            try:
                parsed = json.loads(stdout)
                self._set_headers(200)
                self.wfile.write(json.dumps(parsed).encode())
            except Exception:
                self._set_headers(500)
                self.wfile.write(json.dumps({"ok": False, "error": "failed to parse agent output", "raw": stdout}).encode())
        except Exception as e:
            self._set_headers(500)
            self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode())

def run():
    server = HTTPServer((HOST, PORT), Handler)
    print(f"Agent worker listening on {HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()

if __name__ == '__main__':
    run()
