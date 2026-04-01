import { FormEvent, useMemo, useRef, useEffect, useState } from "react";
import { Bot, MessageSquare, Send, X, Loader2 } from "lucide-react";

import { useGeminiChat, ChatRequestPayload } from "@/hooks/use-api";

type ChatMsg = {
  role: "user" | "assistant";
  text: string;
};

interface ChatContext {
  symbol?: string;
  price?: number;
}

interface ChatbotWidgetProps {
  /** Current stock symbol for context */
  currentSymbol?: string;
  /** Current stock price for context */
  currentPrice?: number;
}

const DEFAULT_USER_ID = "anonymous-user";

export function ChatbotWidget({ currentSymbol, currentPrice }: ChatbotWidgetProps = {}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      text: "Hi, I am your Gemini trading assistant. Ask about market moves, portfolio risk, or trading terms.",
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use the backend API hook (no direct Gemini API calls from frontend)
  const chat = useGeminiChat();

  const canSend = input.trim().length > 0 && !chat.isPending;

  const title = useMemo(() => (chat.isPending ? "Thinking..." : "Gemini Assistant"), [chat.isPending]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const message = input.trim();
    if (!message || chat.isPending) return;

    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setInput("");

    try {
      // Call backend /api/v1/chat endpoint (NOT direct Gemini API)
      const payload: ChatRequestPayload = {
        userId: DEFAULT_USER_ID,
        message,
        symbol: currentSymbol,
      };

      const result = await chat.mutateAsync(payload);
      setMessages((prev) => [...prev, { role: "assistant", text: result.answer }]);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Unable to get response from assistant";
      setMessages((prev) => [...prev, { role: "assistant", text: `Error: ${messageText}` }]);
    }
  };

  // Context display in header
  const contextDisplay = currentSymbol ? (
    <span className="ml-2 text-xs text-[#8ea6c8]">
      {currentSymbol}
      {currentPrice !== undefined && currentPrice > 0 && (
        <span className="ml-1">${currentPrice.toFixed(2)}</span>
      )}
    </span>
  ) : null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="w-[360px] max-w-[92vw] overflow-hidden rounded-2xl border border-[#2c4770] bg-[#0f1d34] shadow-2xl">
          {/* Header with stock context */}
          <div className="flex items-center justify-between border-b border-[#29466f] px-4 py-3">
            <div className="flex items-center gap-2 text-[#e7f2ff]">
              <Bot size={16} aria-hidden="true" />
              <span className="text-sm font-semibold">{title}</span>
              {contextDisplay}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md border border-[#35527d] bg-[#162a49] p-1 text-[#d5e7ff] hover:bg-[#1d3a5c] transition-colors"
              aria-label="Close chat"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>

          {/* Chat history */}
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
            {chat.isPending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-xl bg-[#1a2d4d] px-3 py-2 text-sm text-[#8ea6c8]">
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input form */}
          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-[#29466f] p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask your trading question..."
              className="flex-1 rounded-lg border border-[#35527d] bg-[#0d1c33] px-3 py-2 text-sm text-[#e7f2ff] outline-none placeholder:text-[#8ca6c8] focus:border-[#4a7ab8] transition-colors"
              disabled={chat.isPending}
              aria-label="Chat message input"
            />
            <button
              type="submit"
              disabled={!canSend}
              className="inline-flex items-center gap-1 rounded-lg bg-[#2d8bff] px-3 py-2 text-sm text-white disabled:opacity-50 hover:bg-[#3a96ff] transition-colors"
              aria-label="Send message"
            >
              <Send size={14} aria-hidden="true" />
              <span>Send</span>
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-[#35527d] bg-[#152848] px-4 py-2 text-sm font-medium text-[#e6f1ff] shadow-lg hover:bg-[#1d3a5c] transition-colors"
          aria-label="Open AI chat assistant"
        >
          <MessageSquare size={16} aria-hidden="true" />
          <span>Ask AI</span>
        </button>
      )}
    </div>
  );
}
