import React, { useState, useEffect, useRef } from "react";

export default function Chatbot() {
  const [log, setLog] = useState([]);
  const [q, setQ] = useState("");
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Make sure the chatbot input is clickable (not blocked by canvas)
    const chatbot = document.getElementById("chatbot-container");
    if (chatbot) chatbot.style.zIndex = "50";
  }, []);

  useEffect(() => {
    // Smooth scroll to bottom when new message arrives
    if (chatEndRef.current)
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  async function send() {
    if (!q.trim()) return;
    setLog((l) => [...l, { from: "user", text: q }]);
    let a = "I can help with voice health. Try asking 'How long should I record?'";
    const text = q.toLowerCase();
    if (text.includes("how long"))
      a = "🎙️ Record for about 3–5 seconds for best accuracy.";
    else if (text.includes("jitter"))
      a =
        "⚡ Jitter measures frequency variation — higher jitter may indicate vocal instability.";
    else if (text.includes("shimmer"))
      a =
        "🌟 Shimmer measures loudness variation — used to detect tremors or vocal irregularities.";
    else if (text.includes("parkinson"))
      a =
        "🧠 Parkinson’s voice detection analyzes micro tremors and irregular vocal fold vibrations.";
    setTimeout(() => setLog((l) => [...l, { from: "bot", text: a }]), 600);
    setQ("");
  }

  return (
    <div
      id="chatbot-container"
      className="rounded-2xl shadow-lg p-4 border border-white/10 relative"
      style={{
        background:
          "linear-gradient(145deg, rgba(14,25,40,0.95), rgba(10,35,55,0.9))",
        color: "#eaf6ff",
        pointerEvents: "auto",
      }}
    >
      <h3 className="font-semibold text-xl mb-3 text-[var(--color-secondary)]">
        🤖 AI Chat Assistant
      </h3>

      {/* Chat window */}
      <div
        style={{
          height: 220,
          overflowY: "auto",
          padding: "10px",
          background:
            "linear-gradient(160deg, rgba(15,35,55,0.85), rgba(20,50,70,0.95))",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.15)",
        }}
      >
        {log.map((e, i) => (
          <div
            key={i}
            className={`my-2 ${
              e.from === "user" ? "text-[var(--color-primary)]" : "text-gray-100"
            }`}
          >
            <b>{e.from === "user" ? "You" : "Bot"}:</b> {e.text}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          marginTop: 10,
          display: "flex",
          gap: 8,
          pointerEvents: "auto",
        }}
      >
        <input
          ref={inputRef}
          className="flex-1 px-3 py-2 rounded-lg bg-[#0a1c2b] text-white placeholder-gray-400 border border-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          style={{
            caretColor: "#00e0c3",
            zIndex: 100,
          }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask something..."
        />
        <button
          onClick={send}
          className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white px-4 py-2 rounded-lg hover:opacity-90 transition"
        >
          Send
        </button>
      </div>
    </div>
  );
}