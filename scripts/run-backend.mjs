import { spawn } from "node:child_process";
import path from "node:path";

const pythonPath = process.platform === "win32"
  ? path.join(".venv", "Scripts", "python.exe")
  : path.join(".venv", "bin", "python");

const child = spawn(path.resolve(pythonPath), ["backend/run_server.py"], {
  stdio: "inherit",
  shell: false,
});

child.on("error", (error) => {
  console.error(`Failed to start backend with ${pythonPath}:`, error.message);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exitCode = code ?? 1;
  }
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
