import { spawn } from "child_process";
import path from "path";

export type AgentCommand =
  | { type: "init"; stateDim: number; actionDim: number; checkpoint?: string }
  | { type: "step"; state: number[]; explore?: boolean }
  | { type: "train"; transitions: Array<{ state: number[]; action: number; reward: number; next_state: number[]; done: number }>; epochs?: number; savePath?: string }
  | { type: "test"; states: number[][] }
  | { type: "quote"; symbol: string };

export interface AgentResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

export function runAgentCommand<T = any>(cmd: AgentCommand, onStdout?: (line: string) => void): Promise<AgentResponse<T>> {
  return new Promise((resolve) => {
    const scriptPath = path.resolve(import.meta.dirname, "py", "agent_service.py");
    const py = spawn(process.env.PYTHON_CMD || "python", [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });
    let stdout = "";
    let stderr = "";
    py.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      onStdout?.(text);
    });
    py.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      onStdout?.(text);
    });
    py.on("close", () => {
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch {
        resolve({ ok: false, error: stderr || "Failed to parse agent response" });
      }
    });
    py.stdin.write(JSON.stringify(cmd));
    py.stdin.end();
  });
}

// Shortcut just for quote
export function runAgentQuote(symbol: string): Promise<AgentResponse<{ symbol: string; provider: string; price: number; currency?: string }>> {
  return runAgentCommand({ type: "quote", symbol });
}


