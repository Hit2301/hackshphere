// src/pages/Dashboard.js
import React, { useState, useEffect, useRef } from "react";
import { getAuth } from "firebase/auth";
import Recorder from "../components/Recorder";
import Timeline from "../components/Timeline";
import Chatbot from "../components/Chatbot";
import pcaFeatureMapping from "../data/pca_feature_mapping.json";
import {
  ResponsiveContainer,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
} from "recharts";
import "./Dashboard.css";

/**
 * Dashboard.js
 * - preserves ALL previous logic and extends with many visual/interactive features:
 *   - Larger readable Radar (22 features) + floating tooltip
 *   - 4 circular conic-gradient meters (Audio / PCA / Fusion / Disease Index)
 *   - Dual-layer wave (health pulse + live amplitude front layer)
 *   - 22 feature boxes with hover-expand + description (animated)
 *   - Better health/disease index calculation (weighted average; higher = more threat)
 *   - Safe fallbacks if features missing
 */

export default function Dashboard() {
  const auth = getAuth();

  // --- state
  const [user, setUser] = useState(auth.currentUser);
  const [latest, setLatest] = useState(null);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // hover states
  const [hoveredFeature, setHoveredFeature] = useState(null); // radar hover
  const [hoveredBox, setHoveredBox] = useState(null); // feature box hover

  // small live amplitude simulation (will be replaced if Recorder exposes live amplitude)
  const [isLiveListening, setIsLiveListening] = useState(false);
  const [liveAmplitude, setLiveAmplitude] = useState(0); // 0..1 simulated or real
  const liveAmpRef = useRef(0);

  // background canvas refs
  const neuralRef = useRef(null);
  const particlesRef = useRef(null);

  // Auth state
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) setUser(u);
      else (window.location.href = "/login");
    });
    return () => unsub();
  }, [auth]);

  // ---------- UPLOAD / INFERENCE ----------
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

      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";

      const response = await fetch(`${backendUrl}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.detail || "Upload failed");
      }

      const result = await response.json();

      // --- smart health/disease index calculation (higher = more threat)
      // Weighted average: audio heavier because acoustic features usually carry strong signal.
      // weights: audio 0.45, pca 0.25, fusion 0.30  (sum = 1.0)
      const audio = Number(result.audio_full_proba ?? 0);
      const pca = Number(result.pca22_proba ?? 0);
      const fusion = Number(result.fusion_proba ?? 0);

      const weights = { audio: 0.45, pca: 0.25, fusion: 0.30 };
      let disease_index = Math.min(
        1,
        audio * weights.audio + pca * weights.pca + fusion * weights.fusion
      );

      // small smoothing (optional): push slightly toward fusion if fusion is high
      if (fusion > 0.7) disease_index = Math.min(1, disease_index * 1.02);

      // health_index (same semantics: higher value => higher threat)
      result.health_index = disease_index;
      // expose for UI convenience
      result.disease_index = disease_index;

      // ensure pca_features is array (make fallback 22 zeros)
      if (!Array.isArray(result.pca_features)) {
        result.pca_features = Array(22).fill(0);
      } else if (result.pca_features.length < 22) {
        const pad = Array(22 - result.pca_features.length).fill(0);
        result.pca_features = result.pca_features.concat(pad);
      }

      setLatest(result);
      setStatus("✅ Analysis complete!");
    } catch (err) {
      console.error(err);
      setStatus("❌ " + (err.message || err.toString()));
    } finally {
      setIsLoading(false);
    }
  }

  // ---------- Background: neural nodes ----------
  useEffect(() => {
    const canvas = neuralRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const nodes = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      r: Math.random() * 2 + 1,
    }));

    let raf = null;
    const frame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;

        ctx.fillStyle = "rgba(15,185,164,0.8)";
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // connecting lines
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
    };
    frame();
    return () => {
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // ---------- Background: floating particles ----------
  useEffect(() => {
    const canvas = particlesRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const numParticles = 40;
    const particles = Array.from({ length: numParticles }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 2 + 1,
      dx: (Math.random() - 0.5) * 0.6,
      dy: (Math.random() - 0.5) * 0.6,
    }));

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = null;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(15,185,164,0.45)";
        ctx.fill();

        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
      });

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // ---------- small simulated live amplitude (or attach real mic if available) ----------
  useEffect(() => {
    // if user toggles live listening UI, we simulate a gentle amplitude pattern (or real if connected)
    let interval = null;
    if (isLiveListening) {
      interval = setInterval(() => {
        // simple noise + smooth
        const next = Math.min(
          1,
          Math.abs((Math.sin(Date.now() / 200) + Math.random() * 0.6) / 1.6)
        );
        liveAmpRef.current = liveAmpRef.current * 0.85 + next * 0.15;
        setLiveAmplitude(liveAmpRef.current);
      }, 80);
    } else {
      // decay amplitude to zero slowly
      interval = setInterval(() => {
        liveAmpRef.current = liveAmpRef.current * 0.85;
        setLiveAmplitude(liveAmpRef.current);
      }, 90);
    }
    return () => clearInterval(interval);
  }, [isLiveListening]);

  // ---------- computed values ----------
  const audioScore = latest?.audio_full_proba ?? 0;
  const pcaScore = latest?.pca22_proba ?? 0;
  const fusionScore = latest?.fusion_proba ?? 0;
  // disease_index (in UI we want higher → more threat). Show as 0..1
  const diseaseIndex = latest?.disease_index ?? 0;
  const pct = (v) => Math.round((Number(v) || 0) * 100);

  // radar data (ensure exactly 22 elements)
  const radarData = (latest?.pca_features || Array(22).fill(0)).map((v, i) => ({
    name: pcaFeatureMapping[i]?.name || `Feature ${i + 1}`,
    value: Math.abs(Number(v) || 0),
    description: pcaFeatureMapping[i]?.description || "No description",
    index: i,
  }));

  // risk label
  const getRiskLevel = (val) => {
    if (val < 0.36)
      return {
        label: "✅ Low risk (Healthy)",
        color: "linear-gradient(90deg,#13b48f,#0fb9a4)",
        glow: "#13b48f",
      };
    if (val < 0.66)
      return {
        label: "⚠️ Borderline",
        color: "linear-gradient(90deg,#f6b042,#f39c12)",
        glow: "#f6b042",
      };
    return {
      label: "🔴 High risk — possible Parkinson indicators",
      color: "linear-gradient(90deg,#ff6b63,#d9534f)",
      glow: "#ff6b63",
    };
  };
  const risk = getRiskLevel(diseaseIndex);

  // helpful formatting
  const fmt = (n) =>
    n == null ? "—" : typeof n === "number" ? Number(n).toFixed(4).replace(/\.?0+$/, "") : n;

  // ---------- Render ----------
  return (
    <div className="dashboard-container">
      {/* background canvases */}
      <canvas ref={neuralRef} className="bg-canvas neural" />
      <canvas ref={particlesRef} className="bg-canvas particles" />

      {/* gradient blobs + top wave (keeps your landing feel) */}
      <div className="gradient-blob blob-primary" />
      <div className="gradient-blob blob-secondary" />
      <div className="waveform-bar" />

      <div className="dashboard-content">
        <div className="card">
          <h2 className="welcome-title">Welcome, {user?.email || "Guest"} 👋</h2>
          <p className="welcome-sub">
            Record your voice to analyze for early Parkinson’s indicators.
          </p>
        </div>

        <div className="card">
          <h3>🎙 Voice Recorder</h3>
          <div className="recorder-row">
            <div style={{ flex: 1 }}>
              <Recorder onUpload={handleUpload} setStatus={setStatus} />
            </div>

            {/* small control panel for live amplitude monitor and quick upload */}
            <div className="recorder-side">
              <div className="live-monitor">
                <div className="live-header">
                  <strong>Live Monitor</strong>
                  <button
                    className={`tiny-btn ${isLiveListening ? "on" : ""}`}
                    onClick={() => setIsLiveListening((s) => !s)}
                    title="Toggle live amplitude simulation (or mic if connected)"
                  >
                    {isLiveListening ? "ON" : "OFF"}
                  </button>
                </div>
                <div className="live-wave-outer">
                  <div
                    className="live-wave"
                    style={{
                      transform: `scaleY(${1 + liveAmplitude * 2})`,
                      boxShadow: `0 0 ${8 + liveAmplitude * 18}px rgba(15,185,164,${0.6 +
                        liveAmplitude *
                          0.6})`,
                    }}
                  />
                </div>
                <div className="live-readout">
                  Amplitude: <strong>{(liveAmplitude * 100).toFixed(0)}%</strong>
                </div>
              </div>

              <div className="quick-actions">
                <button
                  className="btn-primary"
                  onClick={() => {
                    // if have last audio url show it, else open sample instructions
                    if (latest?.audio_url) {
                      window.open(latest.audio_url, "_blank");
                    } else {
                      alert("No audio yet. Record and upload to preview the stored file.");
                    }
                  }}
                >
                  Open last audio
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    // quick toggle to show/hide feature grid (for quick testing)
                    const el = document.querySelector(".feature-grid-section");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Jump to PCA features
                </button>
              </div>
            </div>
          </div>

          <div
            className={`status ${
              status.includes("✅") ? "success" : status.includes("❌") ? "error" : "idle"
            }`}
          >
            {status || "Idle — ready to record"}
          </div>
        </div>

        {/* show results when available */}
        {latest && (
          <>
            {/* Circular meters: Audio / PCA / Fusion / Disease Index */}
            <div className="circular-section">
              {[
                { key: "audio_full_proba", label: "🎧 Audio (920D)" },
                { key: "pca22_proba", label: "🧩 PCA (22)" },
                { key: "fusion_proba", label: "🧠 Fusion" },
                { key: "disease_index", label: "💊 Disease Index" },
              ].map((item, i) => {
                const val = Number(latest[item.key] ?? (item.key === "disease_index" ? diseaseIndex : 0));
                const percent = Math.round(Math.max(0, Math.min(1, val)) * 100);
                return (
                  <div
                    key={i}
                    className="circle-visual"
                    aria-label={`${item.label} ${percent}%`}
                    title={`${item.label}: ${percent}%`}
                  >
                    <div
                      className="circle-fill"
                      style={{
                        background: `conic-gradient(white ${percent * 3.6}deg, rgba(255,255,255,0.06) ${percent *
                          3.6}deg)`,
                      }}
                    />
                    <div className="circle-inner">
                      <div className="circle-title">{item.label}</div>
                      <div className="circle-value">{percent}%</div>
                      <div className="circle-mini">raw: {fmt(val)}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Dual reactive wave + risk bar */}
            <div className="risk-panel card">
              <div className="risk-header">
                <div className="risk-title">Overall Risk</div>
                <div className="risk-sub">Disease index (0 → 1)</div>
              </div>

              {/* Dual layer reactive waves */}
              <div className="risk-wave-layer" aria-hidden>
                {/* back layer: health pulse */}
                <div
                  className="risk-wave back"
                  style={{
                    transform: `scaleY(${1 + diseaseIndex * 1.2})`,
                    opacity: 0.12 + diseaseIndex * 0.5,
                    filter: `drop-shadow(0 0 ${8 + diseaseIndex * 28}px ${risk.glow})`,
                  }}
                />
                {/* front layer: live amplitude */}
                <div
                  className="risk-wave front"
                  style={{
                    transform: `scaleY(${1 + liveAmplitude * 2.5})`,
                    opacity: 0.2 + liveAmplitude * 0.6,
                    filter: `drop-shadow(0 0 ${8 + liveAmplitude * 30}px ${risk.glow})`,
                  }}
                />
              </div>

              {/* numeric + bar + scale */}
              <div className="risk-body">
                <div className="risk-left">
                  <div className="risk-large">{(diseaseIndex * 100).toFixed(1)}%</div>
                  <div className="risk-label-small">{risk.label}</div>
                </div>

                <div className="risk-right">
                  <div className="risk-bar">
                    <div
                      className="risk-progress"
                      style={{
                        width: `${pct(diseaseIndex)}%`,
                        background: risk.color,
                        boxShadow: `0 0 18px ${risk.glow}`,
                      }}
                    />
                    <div
                      className="risk-thumb"
                      style={{
                        left: `${pct(diseaseIndex)}%`,
                        boxShadow: `0 0 10px ${risk.glow}`,
                        background: risk.glow,
                      }}
                    />
                  </div>
                  <div className="risk-scale">
                    <span>0.0</span>
                    <span>0.5</span>
                    <span>1.0</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Radar / PCA */}
            <div className="chart-card">
              <h4 className="chart-title">🕸 PCA Feature Radar Map</h4>
              <div className="chart-inner">
                <div style={{ width: "100%", height: 640 }}>
                  <ResponsiveContainer>
                    <RadarChart outerRadius={220} data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.14)" />
                      <PolarAngleAxis dataKey="name" tick={{ fill: "#d9f5ef", fontSize: 12 }} />
                      <Radar
                        dataKey="value"
                        stroke="#0fb9a4"
                        fill="rgba(15,185,164,0.28)"
                        strokeWidth={3}
                        onMouseOver={(e) => setHoveredFeature(e?.payload)}
                        onMouseOut={() => setHoveredFeature(null)}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {/* floating tooltip (for hovered radar segment) */}
                {hoveredFeature && (
                  <div className="floating-feature-info">
                    <div className="ff-header">{hoveredFeature.name}</div>
                    <div className="ff-body">
                      <div>Value: <strong>{Number(hoveredFeature.value).toFixed(4)}</strong></div>
                      <div className="ff-desc">{hoveredFeature.description}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* feature list grid with hover expansion */}
              <div className="feature-grid-section">
                <h4>🎛 All PCA Feature Metrics (22)</h4>
                <div className="feature-box-grid">
                  {radarData.map((feature, index) => (
                    <div
                      key={index}
                      className={`feature-item ${hoveredBox === index ? "active" : ""}`}
                      onMouseEnter={() => setHoveredBox(index)}
                      onMouseLeave={() => setHoveredBox(null)}
                      tabIndex={0}
                      onFocus={() => setHoveredBox(index)}
                      onBlur={() => setHoveredBox(null)}
                      role="button"
                      aria-pressed={hoveredBox === index}
                    >
                      <div className="feature-header">
                        <div className="feature-left">
                          <div className="feature-name">{feature.name}</div>
                          <div className="feature-sub">{pcaFeatureMapping[index]?.domain || "Audio"}</div>
                        </div>
                        <div className="feature-value">{Number(feature.value).toFixed(4)}</div>
                      </div>

                      {/* animated mini bar (always visible) */}
                      <div className="feature-mini-bar-outer">
                        <div
                          className="feature-mini-bar"
                          style={{ width: `${Math.round(feature.value * 100)}%` }}
                        />
                      </div>

                      {/* expanded description on hover/focus */}
                      <div className="feature-extra">
                        <div className="feature-desc">{feature.description}</div>
                        <div className="feature-meta">
                          <div>Top contributors:</div>
                          <div className="contributors">
                            {pcaFeatureMapping[index]?.top?.slice(0, 5).map((t, i) => (
                              <span key={i} className="chip">
                                {t}
                              </span>
                            )) || <span className="chip">—</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* AI summary */}
            <div className="ai-summary">
              <p><strong>AI Summary:</strong> {latest.ai_summary || "No short summary available."}</p>
            </div>
          </>
        )}

        {/* past analyses + chatbot (unchanged) */}
        <div className="card">
          <h3>📊 Your Past Analyses</h3>
          <Timeline user={user} />
        </div>

        <div className="card chatbot">
          <h3>💬 AI Assistant</h3>
          <Chatbot />
        </div>
      </div>
    </div>
  );
}