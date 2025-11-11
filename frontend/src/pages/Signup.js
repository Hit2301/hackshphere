import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import app from "../helpers/firebase";

export default function Signup() {
  const auth = getAuth(app);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signup(e) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      await createUserWithEmailAndPassword(auth, email, pw);
      navigate("/dashboard");
    } catch (err) {
      setError("Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-signup relative overflow-hidden flex flex-col items-center justify-center px-4 py-12 text-white">
      <div className="absolute top-[-10%] left-[10%] w-[35vw] h-[35vw] bg-[var(--color-secondary)]/25 blur-[160px] animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[10%] w-[35vw] h-[35vw] bg-[var(--color-primary)]/25 blur-[160px] animate-pulse-slow"></div>

      <div className="relative z-10 card w-full max-w-md p-10 text-center">
        <h2 className="text-3xl font-extrabold text-[var(--color-secondary)] mb-2">
          Create Account ✨
        </h2>
        <p className="text-gray-300 mb-8">
          Join BHEEM and start using AI for early Parkinson detection.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/20 text-red-200 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={signup} className="flex flex-col gap-4 text-left">
          <label className="text-sm font-medium text-gray-200">
            Email Address
          </label>
          <input
            type="email"
            className="p-3 rounded-lg bg-white/10 border border-white/20 focus:ring-2 focus:ring-[var(--color-secondary)] outline-none"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />

          <label className="text-sm font-medium text-gray-200">Password</label>
          <input
            type="password"
            className="p-3 rounded-lg bg-white/10 border border-white/20 focus:ring-2 focus:ring-[var(--color-secondary)] outline-none"
            placeholder="••••••••"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            disabled={loading}
            required
          />

          <button type="submit" disabled={loading} className="btn w-full mt-6 py-3 text-lg">
            {loading ? (
              <>
                <span className="spinner"></span>&nbsp; Creating...
              </>
            ) : (
              "Sign Up"
            )}
          </button>
        </form>

        <p className="text-sm text-gray-300 mt-6">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-[var(--color-secondary)] hover:underline"
          >
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}