import React, { useState, useEffect, useRef } from "react";

export default function Chatbot() {
  const [log, setLog] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [log]);

  async function send() {
    if (!q.trim()) return;
    const userText = q.trim();
    setLog((l) => [...l, { from: "user", text: userText }]);
    setQ("");
    setLoading(true);

    try {
      const resp = await fetch(
        `${process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000"}/chatbot`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userText }),
        }
      );

      const data = await resp.json();
      const botReply = data.reply || "🤖 Sorry, I couldn’t generate a response right now.";
      setLog((l) => [...l, { from: "bot", text: botReply }]);
    } catch (err) {
      console.error("Chatbot error:", err);
      setLog((l) => [...l, { from: "bot", text: "⚠️ Network error, please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      id="chatbot-container"
      className="rounded-2xl shadow-lg p-5 border border-white/10 relative"
      style={{
        background:
          "linear-gradient(145deg, rgba(8,28,38,0.96), rgba(10,45,60,0.92))",
        color: "#e8f9f2",
        pointerEvents: "auto",
        zIndex: 50,
      }}
    >
      <h3 className="font-semibold text-xl mb-3 text-[var(--color-secondary)]">
        🤖 AI Chat Assistant
      </h3>

      <div
        style={{
          height: 230,
          overflowY: "auto",
          padding: "12px",
          background:
            "linear-gradient(160deg, rgba(14,122,196,0.15), rgba(15,185,164,0.1))",
          borderRadius: "12px",
          border: "1px solid rgba(255,255,255,0.15)",
          fontSize: "0.95rem",
        }}
      >
        {log.map((e, i) => (
          <div
            key={i}
            className={`my-2 ${
              e.from === "user" ? "text-[var(--color-primary)]" : "text-gray-100"
            }`}
          >
            <b>{e.from === "user" ? "You" : "Bot"}:</b>{" "}
            <span>{e.text}</span>
          </div>
        ))}
        {loading && (
          <div className="my-2 text-gray-400 animate-pulse">
            Bot is typing...
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 8,
          pointerEvents: "auto",
          alignItems: "center",
        }}
      >
        <input
          className="flex-1 px-3 py-2 rounded-lg bg-[#0b1d27] text-white placeholder-gray-400 border border-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          style={{ caretColor: "#00e0c3" }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask about your voice analysis..."
        />
        <button
          onClick={send}
          disabled={loading}
          className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white px-5 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}