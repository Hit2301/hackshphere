import React from "react";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-screen text-center bg-gray-50">
      <h1 className="text-4xl font-bold mb-4">HackSphere — Parkinson Voice Detector</h1>
      <p className="text-lg mb-8 text-gray-600">Early detection using AI and voice analysis</p>
      <button
        className="bg-blue-600 text-white px-6 py-3 rounded-lg text-lg hover:bg-blue-700"
        onClick={() => navigate("/login")}
      >
        Get Started →
      </button>
    </div>
  );
}
