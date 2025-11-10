// src/pages/Dashboard.js
import React, { useState, useEffect, useRef } from "react";
import { getAuth } from "firebase/auth";
import Recorder from "../components/Recorder";
import Timeline from "../components/Timeline";
import Chatbot from "../components/Chatbot";

/**
 * Dashboard.js
 * - Shows neural bg, real-time mic waveform, uploaded audio waveform
 * - Displays label, score, confidence, AND all 22 features (with friendly names)
 * - Chatbot box styled to match theme and be readable
 *
 * Paste this file directly (overwrite existing Dashboard.js).
 */

const FEATURE_NAMES = [
  "Mean Fundamental Frequency (F0_mean)",
  "Maximum Fundamental Frequency (F0_max)",
  "Minimum Fundamental Frequency (F0_min)",
  "Jitter (local)",
  "Jitter (RAP)",
  "Jitter (PPQ5)",
  "Jitter (DDP)",
  "Shimmer (local)",
  "Shimmer (dB)",
  "Shimmer (APQ3)",
  "Shimmer (APQ5)",
  "Shimmer (APQ11)",
  "Shimmer (DDA)",
  "HNR (Harmonic-to-Noise Ratio)",
  "Median Pitch",
  "Pitch Standard Deviation",
  "MFCC1",
  "MFCC2",
  "MFCC3",
  "MFCC4",
  "MFCC5",
  "MFCC6",
];

export default function Dashboard() {
  const auth = getAuth();
  const [user, setUser] = useState(auth.currentUser);
  const [latest, setLatest] = useState(null);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Canvas refs
  const waveRef = useRef(null); // mic realtime waveform
  const audioWaveRef = useRef(null); // uploaded audio waveform
  const neuralRef = useRef(null);

  // Audio state refs (we keep them as refs to avoid re-render loops)
  const audioCtxRef = useRef(null);
  const micStreamRef = useRef(null);
  const analyserRef = useRef(null);
  const micAnimationRef = useRef(null);
  const audioWaveAnimationRef = useRef(null);

  const isVisualizing = isLoading || /recording|uploading|analyzing|processing/i.test(status || "");

  // Auth
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) setUser(u);
      else (window.location.href = "/login");
    });
    return () => unsub();
  }, [auth]);

  // Upload handler
  async function handleUpload(blob) {
    try {
      if (!user) return alert("Please login first");
      setStatus("Analyzing your voice...");
      setIsLoading(true);

      const idToken = await user.getIdToken(true);
      const file = new File([blob], `voice-${Date.now()}.wav`, {
        type: "audio/wav",
      });

      const formData = new FormData();
      formData.append("file", file);

      const backendUrl = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";

      const response = await fetch(`${backendUrl}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.detail || "Upload failed");
      }

      const result = await response.json();
      setLatest(result);
      setStatus("✅ Analysis complete!");
    } catch (err) {
      console.error(err);
      setStatus("❌ " + (err.message || err.toString()));
    } finally {
      setIsLoading(false);
    }
  }

  // ----------------------------
  // Mic real-time waveform setup
  // ----------------------------
  useEffect(() => {
    const canvas = waveRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let width = (canvas.width = canvas.clientWidth);
    let height = (canvas.height = canvas.clientHeight);

    function resize() {
      width = canvas.width = canvas.clientWidth;
      height = canvas.height = canvas.clientHeight;
    }
    window.addEventListener("resize", resize);

    async function startMicVisualization() {
      try {
        // if already open, don't reopen
        if (audioCtxRef.current && analyserRef.current) return;

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;

        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = audioCtx;

        const src = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;

        src.connect(analyser);

        const bufferLength = analyser.fftSize;
        const dataArray = new Uint8Array(bufferLength);

        function drawMic() {
          micAnimationRef.current = requestAnimationFrame(drawMic);
          analyser.getByteTimeDomainData(dataArray);

          ctx.clearRect(0, 0, width, height); // 4 args — fixed

          ctx.lineWidth = 2;
          const grad = ctx.createLinearGradient(0, 0, width, 0);
          grad.addColorStop(0, "#0fb9a4");
          grad.addColorStop(1, "#0e7ac4");
          ctx.strokeStyle = grad;
          ctx.beginPath();

          const sliceWidth = (width * 1.0) / bufferLength;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0; // 0..2
            const y = (v * height) / 2;
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
            x += sliceWidth;
          }
          ctx.lineTo(width, height / 2);
          ctx.stroke();
        }

        drawMic();
      } catch (err) {
        console.error("Mic visualization error:", err);
      }
    }

    // Start or stop based on isVisualizing
    if (isVisualizing) {
      startMicVisualization();
    } else {
      // stop mic animation + close audio context + clear canvas
      if (micAnimationRef.current) {
        cancelAnimationFrame(micAnimationRef.current);
        micAnimationRef.current = null;
      }
      if (analyserRef.current) {
        analyserRef.current = null;
      }
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch {}
        audioCtxRef.current = null;
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      ctx.clearRect(0, 0, width, height);
    }

    return () => {
      if (micAnimationRef.current) cancelAnimationFrame(micAnimationRef.current);
      window.removeEventListener("resize", resize);
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch {}
        audioCtxRef.current = null;
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisualizing]);

  // ------------------------------------------------
  // Uploaded audio waveform (draw once when audio_url)
  // ------------------------------------------------
  useEffect(() => {
    const canvas = audioWaveRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let width = (canvas.width = canvas.clientWidth);
    let height = (canvas.height = canvas.clientHeight);

    function resize() {
      width = canvas.width = canvas.clientWidth;
      height = canvas.height = canvas.clientHeight;
      // redraw if we have latestAudioBuffer cached
      if (latest && latest.audio_url) {
        drawFromBuffer(latest._decodedBuffer || null);
      }
    }
    window.addEventListener("resize", resize);

    // decode & draw
    async function decodeAndDraw(url) {
      if (!url) {
        ctx.clearRect(0, 0, width, height);
        return;
      }

      try {
        const resp = await fetch(url);
        const arrayBuffer = await resp.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const decoded = await audioCtx.decodeAudioData(arrayBuffer);
        // store decoded buffer onto latest so resize can redraw
        if (latest) latest._decodedBuffer = decoded;
        drawFromBuffer(decoded);
        // close audio context
        try {
          audioCtx.close();
        } catch {}
      } catch (err) {
        console.error("Error decoding audio_url:", err);
        ctx.clearRect(0, 0, width, height);
      }
    }

    function drawFromBuffer(buffer) {
      ctx.clearRect(0, 0, width, height);
      if (!buffer || !buffer.length) return;
      const raw = buffer.getChannelData(0);
      const samples = 1000; // number of points to draw
      const blockSize = Math.max(1, Math.floor(raw.length / samples));
      const filtered = [];
      for (let i = 0; i < samples; i++) {
        const start = i * blockSize;
        let sum = 0;
        for (let j = 0; j < blockSize && start + j < raw.length; j++) sum += Math.abs(raw[start + j]);
        filtered.push(sum / blockSize);
      }

      // normalize
      const max = Math.max(...filtered) || 1;
      ctx.lineWidth = 2;
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, "#ffd36b");
      grad.addColorStop(1, "#ff6b63");
      ctx.strokeStyle = grad;
      ctx.beginPath();
      const sliceWidth = width / filtered.length;
      for (let i = 0; i < filtered.length; i++) {
        const x = i * sliceWidth;
        const y = height - (filtered[i] / max) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    if (latest && latest.audio_url) {
      drawFromBuffer(latest._decodedBuffer || null);
      decodeAndDraw(latest.audio_url);
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    return () => {
      window.removeEventListener("resize", resize);
      if (audioWaveAnimationRef.current) cancelAnimationFrame(audioWaveAnimationRef.current);
    };
  }, [latest]);

  // -----------------------
  // Neural background canvas
  // -----------------------
  useEffect(() => {
    const canvas = neuralRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    const nodes = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
    }));

    let raf = null;
    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
        ctx.fillStyle = "rgba(15,185,164,0.7)";
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i],
            b = nodes[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 120) {
            ctx.strokeStyle = `rgba(14,122,196,${1 - dist / 120})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return () => {
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Confidence/percentage
  const numericScore =
    latest && typeof latest.score === "number"
      ? latest.score
      : latest && latest.score !== undefined
      ? Number(latest.score) || 0
      : 0;

  const confidencePct = Math.round(Math.max(0, Math.min(100, numericScore * 100)));

  // Utility to format feature values
  const formatVal = (v) => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "number" && Math.abs(v) < 1e-6) return "0";
    if (typeof v === "number") return Number(v).toFixed(4).replace(/\.?0+$/, "");
    return String(v);
  };

  // -----------------
  // Render UI
  // -----------------
  return (
    <div className="min-h-screen bg-dashboard relative overflow-hidden py-12 px-6 text-white">
      <canvas ref={neuralRef} className="absolute inset-0 opacity-30 z-0" />

      <div className="absolute top-[-10%] left-[8%] w-[35vw] h-[35vw] bg-[var(--color-primary)]/25 blur-[150px] animate-pulse-slow" />
      <div className="absolute bottom-[-10%] right-[8%] w-[35vw] h-[35vw] bg-[var(--color-secondary)]/25 blur-[150px] animate-pulse-slow" />

      <div className="relative z-10 max-w-6xl mx-auto animate-fadeIn space-y-10">
        <div className="card">
          <h2 className="text-2xl font-bold text-[var(--color-secondary)] mb-1">
            Welcome, {user?.email || "Guest"} 👋
          </h2>
          <p className="text-gray-300">Record your voice to analyze for early Parkinson’s indicators.</p>
        </div>

        <div className="card relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-48 h-48 flex items-center justify-center">
                <span className="absolute w-40 h-40 rounded-full bg-[var(--color-secondary)]/10 animate-ping" />
                <span className="absolute w-56 h-56 rounded-full bg-[var(--color-secondary)]/15 animate-slow-pulse" />
                <span className="absolute w-72 h-72 rounded-full bg-[var(--color-secondary)]/20 animate-slower-pulse" />
                <div className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center text-3xl ${isVisualizing ? "glow-shadow" : ""}`}>
                  <div className="rounded-full w-20 h-20 flex items-center justify-center bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] text-white shadow-lg">
                    🎤
                  </div>
                </div>
              </div>
              <div className="mt-4 text-sm text-gray-300 text-center">
                <strong>AI Scanner</strong>
                <div className="text-xs text-gray-400">Real-time voice analysis</div>
              </div>
            </div>

            <div className="flex-1">
              <div className="mb-4">
                <h3 className="text-xl font-semibold">🎙 Real-time Recorder</h3>
                <p className="text-sm text-gray-300">Click record and hold a sustained tone. The AI will analyze the voice and return your risk prediction.</p>
              </div>

              <Recorder onUpload={handleUpload} setStatus={setStatus} />

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-24 rounded-lg overflow-hidden bg-white/5 border border-white/10">
                  <canvas ref={waveRef} style={{ width: "100%", height: "100%", display: "block" }} />
                </div>

                <div className="h-24 rounded-lg overflow-hidden bg-white/5 border border-white/10">
                  <canvas ref={audioWaveRef} style={{ width: "100%", height: "100%", display: "block" }} />
                </div>
              </div>

              <div className="mt-4">
                <div
                  className={`inline-flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${
                    status.includes("✅")
                      ? "bg-green-500/10 text-green-200"
                      : status.includes("❌")
                      ? "bg-red-500/10 text-red-200"
                      : isLoading || isVisualizing
                      ? "bg-blue-500/10 text-blue-200"
                      : "bg-white/5 text-gray-200"
                  }`}
                >
                  {isLoading ? <span className="spinner" /> : null}
                  <span>{status || "Idle — ready to record"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Analysis */}
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">🧠 Latest AI Analysis</h3>

          {latest ? (
            <>
              <div className="grid md:grid-cols-3 gap-6 items-start">
                <div>
                  <p className="text-sm text-gray-300">Risk Level</p>
                  <p className="text-2xl font-extrabold mt-2">
                    {numericScore > 0.65 ? "⚠️ Parkinson Risk" : numericScore > 0.35 ? "⚠️ Borderline" : "✅ Healthy"}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">{latest.label || ""}</p>

                  <div className="mt-4">
                    <p className="text-sm text-gray-300">Score (raw)</p>
                    <div className="text-lg font-medium mt-1">{Number(numericScore).toExponential(3)} </div>
                    <p className="text-sm text-gray-400 mt-1">Health score (percent)</p>
                    <div className="text-lg font-medium mt-1">{confidencePct}%</div>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-300">Confidence</p>
                  <div className="mt-3">
                    <div className="confidence-bar">
                      <div
                        className="confidence-bar-inner"
                        style={{
                          width: `${confidencePct}%`,
                          background: confidencePct >= 65 ? "linear-gradient(90deg,#ff6b63,#d9534f)" : confidencePct >= 35 ? "linear-gradient(90deg,#f39c12,#f6b042)" : "linear-gradient(90deg,#1e8e6b,#13b48f)",
                        }}
                      />
                    </div>
                    <div className="text-xs text-gray-400 mt-2">{confidencePct}% confidence</div>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-300">Notes</p>
                  <div className="bg-white/6 p-3 rounded-lg mt-2 text-sm text-gray-200">
                    {latest.note || "Model explanation: analyzing tremor, pitch stability, and voice spectral features."}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-lg font-semibold mb-2">🔬 Extracted features</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(latest.features && Array.isArray(latest.features) ? latest.features : []).map((val, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-white/4 border border-white/6">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs text-gray-300 font-medium">{idx + 1}. {FEATURE_NAMES[idx] || `Feature ${idx + 1}`}</div>
                          <div className="text-sm text-gray-200 mt-1">{formatVal(val)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* If features length < 22, show missing placeholders */}
                  {Array.from({ length: Math.max(0, 22 - ((latest.features && latest.features.length) || 0)) }).map((_, i) => {
                    const idx = (latest.features ? latest.features.length : 0) + i;
                    return (
                      <div key={"empty-" + idx} className="p-3 rounded-lg bg-white/4 border border-white/6">
                        <div className="text-xs text-gray-300 font-medium">{idx + 1}. {FEATURE_NAMES[idx] || `Feature ${idx + 1}`}</div>
                        <div className="text-sm text-gray-200 mt-1">—</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <p className="text-gray-400 italic">No analysis yet. Record a sample to begin.</p>
          )}
        </div>

        {/* Timeline + Chatbot */}
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">📊 Your Past Analyses</h3>
          <Timeline user={user} />
        </div>

        <div className="card chatbot-container" style={{ background: "linear-gradient(180deg, rgba(14,122,196,0.12), rgba(15,185,164,0.06))", color: "#e8f9f2" }}>
          <h3 className="text-xl font-semibold mb-4">💬 AI Assistant</h3>
          <p className="text-gray-200 mb-4">
            Ask about Parkinson’s detection, how to prepare voice samples, or what your results mean.
          </p>
          <div style={{ padding: 8, borderRadius: 8 }}>
            {/* If Chatbot component already has its own background, still wrap to ensure theme */
            }
            <div style={{ background: "rgba(255,255,255,0.03)", padding: 12, borderRadius: 8 }}>
              <Chatbot />
            </div>
          </div>
        </div>
      </div>

      {/* Tailwind-like helper styles (if you use tailwind these may be redundant) */}
      <style jsx>{`
        .confidence-bar {
          width: 100%;
          height: 12px;
          background: rgba(255,255,255,0.06);
          border-radius: 999px;
          overflow: hidden;
        }
        .confidence-bar-inner {
          height: 100%;
          transition: width 400ms ease;
        }
        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.15);
          border-top-color: rgba(255,255,255,0.6);
          border-radius: 999px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}