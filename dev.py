"""
Dev launcher — starts both backend (uvicorn) and frontend (vite) in
sub-processes using CREATE_NEW_PROCESS_GROUP so that VS Code terminal
signals (SIGINT/SIGBREAK) are NOT forwarded to the children.

The launcher itself also ignores SIGBREAK and only honours a *real*
user-initiated Ctrl+C (SIGINT) for shutdown.
"""
import subprocess, sys, os, signal, time, ctypes

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.join(ROOT, "backend")
VENV_PYTHON = os.path.join(ROOT, ".venv", "Scripts", "python.exe")
RUN_SERVER = os.path.join(BACKEND, "run_server.py")

env = os.environ.copy()
env["DATA_PROVIDER"] = "twelvedata"
env["PYTHONIOENCODING"] = "utf-8"

# ── Ignore SIGBREAK (VS Code sends this on Windows) ──────────────
if hasattr(signal, "SIGBREAK"):
    signal.signal(signal.SIGBREAK, signal.SIG_IGN)

# Also tell Windows that this process should NOT receive Ctrl+C
# events from the console — we will poll children instead.
try:
    ctypes.windll.kernel32.SetConsoleCtrlHandler(None, True)    # ignore all
except Exception:
    pass

# CREATE_NEW_PROCESS_GROUP prevents the parent's SIGINT / SIGBREAK
# from being forwarded to children automatically.
CREATE_NEW_PROCESS_GROUP = 0x00000200

print("[launcher] Starting backend on :8001 ...")
backend_proc = subprocess.Popen(
    [VENV_PYTHON, RUN_SERVER],
    cwd=BACKEND,
    env=env,
    creationflags=CREATE_NEW_PROCESS_GROUP,
)

print("[launcher] Starting frontend on :5173 ...")
frontend_proc = subprocess.Popen(
    ["node", os.path.join(ROOT, "node_modules", "vite", "bin", "vite.js"),
     "dev", "--port", "5173"],
    cwd=ROOT,
    env=env,
    creationflags=CREATE_NEW_PROCESS_GROUP,
)

print("[launcher] Both servers started successfully!")
print("[launcher] Backend:  http://localhost:8001")
print("[launcher] Frontend: http://localhost:5173")
print("[launcher] To stop, close this terminal or kill the processes.\n")
sys.stdout.flush()

# Keep running until both children exit
try:
    while True:
        b_alive = backend_proc.poll() is None
        f_alive = frontend_proc.poll() is None
        if not b_alive and not f_alive:
            print("[launcher] Both processes exited.")
            break
        time.sleep(2)
except (KeyboardInterrupt, SystemExit):
    print("\n[launcher] Shutting down...")
    for name, proc in [("backend", backend_proc), ("frontend", frontend_proc)]:
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
            print(f"[launcher] {name} stopped.")
