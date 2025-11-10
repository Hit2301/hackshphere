import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Landing Page — Futuristic Medical AI Design
 * ---------------------------------------------
 * - Neural AI background animation
 * - Floating gradient blobs + parallax waves
 * - Animated hero scanner glow
 * - Premium 3D hover and reveal animations
 */

export default function Landing() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const neuralRef = useRef(null);

  // Floating particles
  useEffect(() => {
    const canvas = canvasRef.current;
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

  // Neural network background
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

  return (
    <div className="relative min-h-screen bg-landing text-center flex flex-col items-center justify-center overflow-hidden text-white">
      {/* AI Neural Network Background */}
      <canvas
        ref={neuralRef}
        className="absolute top-0 left-0 w-full h-full opacity-40 z-0"
      />

      {/* Floating particles */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full z-0 opacity-50"
      />

      {/* Gradient blobs */}
      <div className="absolute top-[-10%] left-[10%] w-[40vw] h-[40vw] bg-[var(--color-primary)]/30 blur-[150px] animate-pulse-slow" />
      <div className="absolute bottom-[-10%] right-[10%] w-[40vw] h-[40vw] bg-[var(--color-secondary)]/30 blur-[180px] animate-pulse-slow" />

      {/* Waveform bar animation */}
      <div className="absolute top-[10%] w-full h-[180px] overflow-hidden opacity-30">
        <div className="absolute w-full h-full bg-[linear-gradient(90deg,#0fb9a4,#0e7ac4)] animate-[wave_8s_infinite_linear]" />
      </div>

      {/* Hero Section */}
      <div className="relative z-10 max-w-5xl px-6 animate-fadeIn">
        <h1 className="text-5xl md:text-6xl font-extrabold mb-6 leading-tight drop-shadow-lg">
          🧠 HackSphere —{" "}
          <span className="text-[var(--color-secondary)]">
            AI for Parkinson Detection
          </span>
        </h1>
        <p className="text-lg md:text-xl text-blue-100 mb-10 leading-relaxed">
          Harness the power of{" "}
          <span className="text-[var(--color-secondary)] font-semibold">
            Artificial Intelligence
          </span>{" "}
          to detect early signs of{" "}
          <strong>Parkinson’s Disease</strong> through voice biomarkers — faster,
          safer, and smarter.
        </p>
        <button
          onClick={() => navigate("/login")}
          className="btn text-lg py-3 px-8 rounded-full shadow-lg hover:scale-105 hover:shadow-[0_0_20px_rgba(15,185,164,0.5)] transition-all duration-300"
        >
          🚀 Get Started
        </button>
      </div>

      {/* Info Section */}
      <section className="relative z-10 mt-24 w-full px-8 py-16 bg-white/5 backdrop-blur-2xl border-t border-white/10 rounded-t-[40px] animate-fadeUp">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-secondary)] mb-3">
              Understanding Parkinson’s Disease
            </h2>
            <p className="text-blue-100 leading-relaxed">
              Parkinson’s Disease occurs when dopamine-producing neurons begin to
              degrade. Our AI model listens for subtle vocal biomarkers, enabling
              earlier awareness and preventive care.
            </p>
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-secondary)] mb-3">
              The Power of Voice Analysis
            </h2>
            <p className="text-blue-100 leading-relaxed">
              Minor changes in tone, rhythm, and pitch can reveal neurological
              changes. HackSphere’s AI decodes these hidden patterns in seconds.
            </p>
          </div>
        </div>

        {/* Cards Section */}
        <div className="mt-16 grid md:grid-cols-3 gap-8">
          {[
            {
              title: "🔒 Secure & Private",
              text: "Your voice data is encrypted and processed locally where possible. You remain in control of your privacy.",
            },
            {
              title: "🧬 Validated Science",
              text: "Trained on clinical datasets from real neurological research institutions for trustworthy outcomes.",
            },
            {
              title: "⚠️ Medical Disclaimer",
              text: "This is a screening aid, not a replacement for diagnosis. Always consult qualified medical experts.",
            },
          ].map((card, idx) => (
            <div
              key={idx}
              className="card hover:scale-105 hover:-translate-y-2 transition-all duration-300 shadow-[0_0_25px_rgba(15,185,164,0.2)] hover:shadow-[0_0_40px_rgba(15,185,164,0.4)]"
            >
              <h3 className="text-xl font-semibold text-[var(--color-secondary)] mb-2">
                {card.title}
              </h3>
              <p className="text-blue-100 text-sm">{card.text}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-blue-200 italic text-lg mt-12">
          “The future of medicine is preventive, precise, and powered by AI.” 💙
        </p>
      </section>
    </div>
  );
}