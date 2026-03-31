import { FormEvent, useMemo, useState } from "react";
import { Bot, MessageSquare, Send, X } from "lucide-react";

import { useGeminiChat } from "@/hooks/use-api";

type ChatMsg = {
  role: "user" | "assistant";
  text: string;
};

const DEFAULT_USER_ID = "anonymous-user";

export function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      text: "Hi, I am your Gemini trading assistant. Ask about market moves, portfolio risk, or trading terms.",
    },
  ]);

  const chat = useGeminiChat();

  const canSend = input.trim().length > 0 && !chat.isPending;

  const title = useMemo(() => (chat.isPending ? "Thinking..." : "Gemini Assistant"), [chat.isPending]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const message = input.trim();
    if (!message || chat.isPending) return;

    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setInput("");

    try {
      const result = await chat.mutateAsync({
        userId: DEFAULT_USER_ID,
        message,
      });
      setMessages((prev) => [...prev, { role: "assistant", text: result.answer }]);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Unable to get response from assistant";
      setMessages((prev) => [...prev, { role: "assistant", text: `Error: ${messageText}` }]);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="w-[360px] max-w-[92vw] overflow-hidden rounded-2xl border border-[#2c4770] bg-[#0f1d34] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#29466f] px-4 py-3">
            <div className="flex items-center gap-2 text-[#e7f2ff]">
              <Bot size={16} />
              <span className="text-sm font-semibold">{title}</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md border border-[#35527d] bg-[#162a49] p-1 text-[#d5e7ff]"
              aria-label="Close chat"
            >
              <X size={14} />
            </button>
          </div>

          <div className="h-80 space-y-3 overflow-y-auto bg-[#0b172b] p-3">
            {messages.map((m, idx) => (
              <div key={`${m.role}-${idx}`} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={[
                    "max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                    m.role === "user" ? "bg-[#2d8bff] text-white" : "bg-[#1a2d4d] text-[#deebff]",
                  ].join(" ")}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-[#29466f] p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask your trading question..."
              className="flex-1 rounded-lg border border-[#35527d] bg-[#0d1c33] px-3 py-2 text-sm text-[#e7f2ff] outline-none placeholder:text-[#8ca6c8]"
            />
            <button
              type="submit"
              disabled={!canSend}
              className="inline-flex items-center gap-1 rounded-lg bg-[#2d8bff] px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              <Send size={14} />
              Send
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-[#35527d] bg-[#152848] px-4 py-2 text-sm font-medium text-[#e6f1ff] shadow-lg"
        >
          <MessageSquare size={16} />
          Ask AI
        </button>
      )}
    </div>
  );
}
