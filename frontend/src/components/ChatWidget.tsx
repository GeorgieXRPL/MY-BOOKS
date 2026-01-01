import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { useLocation } from "react-router-dom";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    // Check if chat is configured
    api.get("/chat/status")
      .then(res => {
        setConfigured(res.data.configured);
        setSuggestedPrompts(res.data.suggestedPrompts || []);
      })
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post("/chat/message", {
        message: text,
        currentPage: location.pathname,
        history: messages.slice(-10) // Keep last 10 messages for context
      });

      if (res.data.success) {
        setMessages(prev => [...prev, { role: "assistant", content: res.data.message }]);
      } else {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: `Error: ${res.data.error || "Something went wrong"}` 
        }]);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: `Error: ${e.response?.data?.error || e.message}` 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!configured) return null;

  return (
    <>
      {/* Chat Button */}
      <button
        className="chat-toggle"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "var(--accent)",
          color: "white",
          border: "none",
          cursor: "pointer",
          fontSize: 24,
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          zIndex: 1000,
          transition: "transform 0.2s"
        }}
      >
        {isOpen ? "×" : "💬"}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          className="chat-window"
          style={{
            position: "fixed",
            bottom: 90,
            right: 20,
            width: 380,
            maxWidth: "calc(100vw - 40px)",
            height: 500,
            maxHeight: "calc(100vh - 120px)",
            background: "var(--bg-primary)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            zIndex: 999,
            overflow: "hidden"
          }}
        >
          {/* Header */}
          <div style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-secondary)"
          }}>
            <h4 style={{ margin: 0 }}>🤖 AI Assistant</h4>
            <p style={{ margin: "4px 0 0", fontSize: "0.8em", color: "var(--muted)" }}>
              Ask me anything about your finances
            </p>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: "center", color: "var(--muted)", padding: 20 }}>
                <p>👋 Hi! I can help you with:</p>
                <ul style={{ textAlign: "left", fontSize: "0.9em" }}>
                  <li>Account balances & transactions</li>
                  <li>Invoice status & overdue payments</li>
                  <li>Financial reports & ratios</li>
                  <li>Crypto holdings</li>
                </ul>
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontSize: "0.85em", marginBottom: 8 }}>Try asking:</p>
                  {suggestedPrompts.slice(0, 3).map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(prompt)}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "8px 12px",
                        marginBottom: 8,
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        cursor: "pointer",
                        textAlign: "left",
                        fontSize: "0.85em"
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: msg.role === "user" ? "var(--accent)" : "var(--bg-secondary)",
                  color: msg.role === "user" ? "white" : "inherit",
                  whiteSpace: "pre-wrap",
                  fontSize: "0.9em",
                  lineHeight: 1.4
                }}
              >
                {msg.content}
              </div>
            ))}

            {loading && (
              <div style={{
                alignSelf: "flex-start",
                padding: "10px 14px",
                borderRadius: 12,
                background: "var(--bg-secondary)",
                color: "var(--muted)"
              }}>
                Thinking...
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: 12,
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 8
          }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              disabled={loading}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-secondary)",
                fontSize: "0.9em"
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                background: "var(--accent)",
                color: "white",
                border: "none",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                opacity: loading || !input.trim() ? 0.6 : 1
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatWidget;


