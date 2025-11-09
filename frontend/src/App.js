import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";

export default function App() {
  return (
    <div className="container">
      <header className="header flex justify-between items-center p-4 border-b border-gray-200">
        <h1 className="text-2xl font-semibold text-blue-700">
          HackSphere — Parkinson Voice Detector
        </h1>
        <nav>
          <Link to="/" className="mr-4 hover:underline">
            Home
          </Link>
          <Link to="/login" className="mr-4 hover:underline">
            Login
          </Link>
          <Link to="/signup" className="hover:underline">
            Signup
          </Link>
        </nav>
      </header>

      <main className="p-6">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}
