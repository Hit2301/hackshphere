import React, { useState, useEffect } from "react";
import { Routes, Route, Link } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setBooting(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  if (booting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-landing text-white text-center">
        <h1 className="text-3xl md:text-5xl font-extrabold mb-4 animate-fadeIn">
          🧠 Initializing <span className="text-[var(--color-secondary)]">HackSphere AI Core</span>
        </h1>
        <div className="flex justify-center">
          <span className="pulse-dot"></span>
          <span className="pulse-dot"></span>
          <span className="pulse-dot"></span>
        </div>
        <p className="text-gray-300 mt-4 text-sm tracking-wide">
          Loading neural modules & voice biomarker models...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col text-white">
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/10 border-b border-white/10 shadow-md flex justify-between items-center px-6 py-4">
        <h1 className="text-2xl font-extrabold text-[var(--color-secondary)]">HackSphere AI</h1>
        <nav className="flex gap-6 text-gray-200 font-medium">
          <Link to="/" className="hover:text-[var(--color-secondary)]">Home</Link>
          <Link to="/login" className="hover:text-[var(--color-secondary)]">Login</Link>
          <Link to="/signup" className="hover:text-[var(--color-secondary)]">Signup</Link>
        </nav>
      </header>

      <main className="flex-1 animate-fadeIn">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>

      <footer className="text-center text-gray-400 text-sm py-6 border-t border-white/10 bg-white/5 backdrop-blur-xl">
        Built with 💙 by <span className="text-[var(--color-secondary)] font-semibold">Team HackSphere</span>
      </footer>
    </div>
  );
}