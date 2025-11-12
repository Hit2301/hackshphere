import React, { useState, useEffect, useRef } from "react";
import { getAuth } from "firebase/auth";
import Recorder from "../components/Recorder";
import Chatbot from "../components/Chatbot";
import pcaFeatureMapping from "../data/pca_feature_mapping.json";
import "./Dashboard.css";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

export default function Dashboard() {
  const auth = getAuth();
  const [user, setUser] = useState(auth.currentUser);
  const [latest, setLatest] = useState(null);
  const [status, setStatus] = useState("Idle — ready to record");
  const [hoveredBox, setHoveredBox] = useState(null);
  const [animatedAudio, setAnimatedAudio] = useState(0);
  const [animatedFusion, setAnimatedFusion] = useState(0);
  const neuralRef = useRef(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) setUser(u);
      else window.location.href = "/login";
    });
    return () => unsub();
  }, [auth]);

  async function handleUpload(blob) {
    try {
      if (!user) return alert("Please log in first.");
      setStatus("Analyzing your voice...");

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
      if (!Array.isArray(result.pca_features))
        result.pca_features = Array(22).fill(0);

      setLatest(result);
      setStatus("✅ Analysis complete!");

      animateValue(setAnimatedAudio, 0, result.audio_full_proba, 1200);
      animateValue(setAnimatedFusion, 0, result.fusion_proba, 1200);

      await supabase.from("analysis_results").insert([
        {
          user_email: user.email,
          audio_prob: result.audio_full_proba,
          fusion_prob: result.fusion_proba,
          result_label: result.label,
          audio_id: `audio-${Date.now()}`,
        },
      ]);
    } catch (err) {
      console.error(err);
      setStatus("❌ " + err.message);
    }
  }

  function animateValue(setter, start, end, duration) {
    const startTime = performance.now();
    function update(currentTime) {
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const val = start + (end - start) * progress;
      setter(val);
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  useEffect(() => {
    const canvas = neuralRef.current;
    const ctx = canvas.getContext("2d");
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const nodes = Array.from({ length: 50 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      nodes.forEach((n) => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
        ctx.fillStyle = "rgba(15,185,164,0.8)";
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
      requestAnimationFrame(draw);
    };
    draw();
  }, []);

  const pct = (v) => Math.round((v ?? 0) * 100);
  const audio = latest?.audio_full_proba ?? 0;
  const fusion = latest?.fusion_proba ?? 0;
  const riskLevel =
    fusion < 0.36
      ? "✅ Healthy"
      : fusion < 0.66
      ? "⚠ Borderline"
      : "🔴 Parkinson Risk";
  const radarData = (latest?.pca_features || []).map((v, i) => ({
    name: pcaFeatureMapping[i]?.name || `Feature ${i + 1}`,
    description: pcaFeatureMapping[i]?.description || "—",
  }));

  return (
    <div className="dashboard-container">
      <canvas ref={neuralRef} className="bg-canvas" />
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
          <Recorder onUpload={handleUpload} setStatus={setStatus} />
          <div
            className={`status ${
              status.includes("✅")
                ? "success"
                : status.includes("❌")
                ? "error"
                : "idle"
            }`}
          >
            {status}
          </div>
        </div>

        {latest && (
          <>
            <div className="top-metrics-row">
              {[
                { label: "🎧 Audio Model", value: animatedAudio },
                { label: "🧠 Fusion Model", value: animatedFusion },
              ].map((m, i) => {
                const percent = pct(m.value);
                return (
                  <div key={i} className="gauge-card">
                    <div className="gauge-label">{m.label}</div>
                    <div className="gauge-wrap">
                      <div
                        className="gauge-conic"
                        style={{
                          background: `conic-gradient(var(--color-primary) ${
                            percent * 3.6
                          }deg, rgba(255,255,255,0.06) ${percent * 3.6}deg)`,
                        }}
                      />
                      <div className="gauge-inner">
                        <div className="gauge-num">{percent}%</div>
                        <div className="gauge-sub">Probability</div>
                      </div>
                      <div className="gauge-glow"></div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="risk-panel compact card">
              <div className="risk-header">
                <div>
                  <div className="risk-title">Overall Risk</div>
                  <div className="risk-sub">Based on Fusion Model</div>
                </div>
                <div className="risk-percent">{(fusion * 100).toFixed(1)}%</div>
              </div>
              <div className="risk-bar-outer">
                <div className="risk-bar-track" />
                <div
                  className="risk-bar-fill"
                  style={{ width: `${pct(fusion)}%` }}
                />
                <div
                  className="risk-thumb"
                  style={{ left: `${pct(fusion)}%` }}
                />
              </div>
              <div className="risk-labels">
                <span>0.0</span>
                <span>0.5</span>
                <span>1.0</span>
              </div>
              <div className="result-aggregate">
                <div className="result-pill">{riskLevel}</div>
              </div>
            </div>

            <div className="feature-grid-section card">
              <h4>🎛 PCA Feature Matrix (22)</h4>
              <div className="feature-box-grid">
                {radarData.map((f, i) => (
                  <div
                    key={i}
                    className={`feature-item ${
                      hoveredBox === i ? "active" : ""
                    }`}
                    onMouseEnter={() => setHoveredBox(i)}
                    onMouseLeave={() => setHoveredBox(null)}
                  >
                    <div className="feature-header">
                      <div>
                        <div className="feature-name">{f.name}</div>
                        <div className="feature-sub">Audio Feature</div>
                      </div>
                    </div>
                    {hoveredBox === i && (
                      <div className="feature-extra">
                        <div className="feature-desc">{f.description}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="ai-summary card">
              <p>
                <strong>AI Summary:</strong>{" "}
                {latest.ai_summary || "No summary available."}
              </p>
            </div>
          </>
        )}

        <div className="card chatbot">
          <h3>💬 AI Assistant</h3>
          <Chatbot />
        </div>
      </div>
    </div>
  );
}