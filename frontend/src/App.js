import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";

export default function App() {
  return (
    <div className="container">
      <header className="header">
        <h1 className="text-2xl font-semibold">
          Hackshphere — Parkinson Voice Detector
        </h1>
        <nav>
          <Link to="/" className="mr-4">
            Dashboard
          </Link>
          <Link to="/login" className="mr-4">
            Login
          </Link>
          <Link to="/signup">Signup</Link>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
    </div>
  );
}
