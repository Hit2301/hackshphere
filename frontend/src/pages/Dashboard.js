

// src/pages/Dashboard.js
import React, { useState, useEffect, useRef } from "react";
import { getAuth } from "firebase/auth";
import Recorder from "../components/Recorder";
import Timeline from "../components/Timeline";
import Chatbot from "../components/Chatbot";
import pcaFeatureMapping from "../data/pca_feature_mapping.json";
import { RadialBarChart, RadialBar, Legend } from "recharts";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import "./Dashboard.css"; // ✅ include new animation styles

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

  // New background refs
  const neuralRef = useRef(null);
  const particlesRef = useRef(null);

  const isVisualizing = isLoading || /recording|uploading|analyzing|processing/i.test(status || "");

  // Firebase Auth
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) setUser(u);
      else (window.location.href = "/login");
    });
    return () => unsub();
  }, [auth]);

  // Upload Handler
  async function handleUpload(blob) {
    try {
      if (!user) return alert("Please login first");
      setStatus("Analyzing your voice...");
      setIsLoading(true);

      const idToken = await user.getIdToken(true);
      const file = new File([blob], `voice-${Date.now()}.wav`, { type: "audio/wav" });
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

  // ===== 🎇 Landing Page Background System =====
  useEffect(() => {
    // Neural Canvas
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

    const frame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
        ctx.fillStyle = "rgba(15,185,164,0.8)";
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
      requestAnimationFrame(frame);
    };
    frame();

    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    // Floating Particles
    const canvas = particlesRef.current;
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

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(15, 185, 164, 0.5)";
        ctx.fill();
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
      });
      requestAnimationFrame(draw);
    };
    draw();

    return () => window.removeEventListener("resize", resize);
  }, []);

  // Confidence calculation
  const numericScore = latest?.fusion_proba || 0;
  const confidencePct = Math.round(Math.max(0, Math.min(100, numericScore * 100)));

  // 🧩 Build radar data using JSON mapping + backend values
  const radarData = (latest?.pca_features || []).map((v, i) => ({
    name: pcaFeatureMapping[i]?.name || `Feature ${i + 1}`,
    value: Math.abs(v),
    description: pcaFeatureMapping[i]?.description || "—",
  }));


  const formatVal = (v) =>
    v == null ? "—" : typeof v === "number" ? Number(v).toFixed(4).replace(/\.?0+$/, "") : String(v);

  return (
    <div className="dashboard-container">
      {/* === Background Layers === */}
      <canvas ref={neuralRef} className="bg-canvas neural" />
      <canvas ref={particlesRef} className="bg-canvas particles" />
      <div className="gradient-blob blob-primary" />
      <div className="gradient-blob blob-secondary" />
      <div className="waveform-bar" />

      {/* === Main Content === */}
      <div className="dashboard-content">
        <div className="card">
          <h2 className="welcome-title">
            Welcome, {user?.email || "Guest"} 👋
          </h2>
          <p className="welcome-sub">Record your voice to analyze for early Parkinson’s indicators.</p>
        </div>

        <div className="card">
          <h3>🎙 Voice Recorder</h3>
          <Recorder onUpload={handleUpload} setStatus={setStatus} />
          <div className={`status ${status.includes("✅") ? "success" : status.includes("❌") ? "error" : "idle"}`}>
            {status || "Idle — ready to record"}
          </div>
        </div>

        {latest && (
          <>
            {/* 🌀 Circular AI Confidence Meters */}
            <div className="circular-section">
              {[
                { key: "audio_full_proba", label: "🎧 Audio (920D)", color: "#0fb9a4" },
                { key: "pca22_proba", label: "🧩 PCA (22)", color: "#0e7ac4" },
                { key: "fusion_proba", label: "🧠 Fusion", color: "#ffd36b" },
              ].map((item, i) => (
                <div className="circle-card" key={i}>
                  <RadialBarChart
                    width={150}
                    height={150}
                    cx={75}
                    cy={75}
                    innerRadius="60%"
                    outerRadius="100%"
                    barSize={12}
                    data={[
                      { name: item.label, value: (latest?.[item.key] || 0) * 100, fill: item.color },
                    ]}
                  >
                    <RadialBar
                      background={{ fill: "rgba(255,255,255,0.1)" }}
                      dataKey="value"
                      cornerRadius={8}
                    />
                  </RadialBarChart>

                  <div className="circle-label">
                    <div className="text-lg font-bold">{item.label}</div>
                    <div className="text-xl text-[var(--color-secondary)]">
                      {Math.round((latest?.[item.key] || 0) * 100)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="chart-card">
              <h4 className="text-lg font-semibold mb-2">🕸 PCA Feature Radar Map</h4>
              <div style={{ width: "100%", height: 420 }}>
                <ResponsiveContainer>
                  <RadarChart outerRadius={120} data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.2)" />
                    <PolarAngleAxis
                      dataKey="name"
                      tick={{ fill: "#bde8e0", fontSize: 10 }}
                    />
                    <Radar
                      name="Feature Intensity"
                      dataKey="value"
                      stroke="#0fb9a4"
                      fill="rgba(15,185,164,0.35)"
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="feature-tooltip">
                <ul>
                  {radarData.map((f, idx) => (
                    <li key={idx}>
                      <strong>{f.name}</strong>: {f.description}
                    </li>
                  ))}
                </ul>
              </div>
            </div>


            <div className="ai-summary">
              <p><strong>AI Summary:</strong> {latest.ai_summary}</p>
            </div>
          </>
        )}


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
