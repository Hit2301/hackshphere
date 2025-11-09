import React, { useState } from "react";

export default function Chatbot() {
  const [log, setLog] = useState([]);
  const [q, setQ] = useState("");

  async function send() {
    if (!q) return;
    setLog((l) => [...l, { from: "user", text: q }]);
    let a = "I can help with voice health. Try: 'How long should I record?'";
    if (q.toLowerCase().includes("how long"))
      a = "Record for 3–5 seconds for best accuracy.";
    if (q.toLowerCase().includes("jitter"))
      a = "Jitter measures frequency variation in voice — common in Parkinson’s.";
    if (q.toLowerCase().includes("shimmer"))
      a = "Shimmer measures loudness variation — used to detect voice irregularity.";
    setTimeout(() => setLog((l) => [...l, { from: "bot", text: a }]), 500);
    setQ("");
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3 className="font-semibold">AI Chatbot</h3>
      <div style={{ height: 180, overflow: "auto", background: "#fafafa", padding: 8 }}>
        {log.map((e, i) => (
          <div key={i}>
            <b>{e.from}:</b> {e.text}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <input
          className="border p-2 flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask something..."
        />
        <button
          onClick={send}
          className="bg-indigo-600 text-white px-4 py-2 rounded"
        >
          Send
        </button>
      </div>
    </div>
  );
}
