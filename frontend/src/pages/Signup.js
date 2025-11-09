import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import app from "../helpers/firebase";

export default function Signup() {
  const auth = getAuth(app);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false); // 🔄 Loading state

  async function signup(e) {
    e.preventDefault();
    if (loading) return; // ⛔ Prevent double-clicks
    setLoading(true);

    try {
      await createUserWithEmailAndPassword(auth, email, pw);
      navigate("/dashboard"); // ✅ Redirect after successful signup
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false); // 🧹 Always reset loading state
    }
  }

  return (
    <div className="card max-w-md mx-auto mt-10 p-6 shadow-lg rounded-lg border border-gray-200">
      <h2 className="text-2xl font-semibold mb-4 text-center">Sign Up</h2>
      <form onSubmit={signup} className="flex flex-col gap-4">
        <input
          className="p-2 border rounded"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
        <input
          className="p-2 border rounded"
          type="password"
          placeholder="Password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className={`flex justify-center items-center gap-2 py-2 rounded text-white 
            ${loading ? "bg-green-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"}`}
        >
          {loading ? (
            <>
              <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-5 h-5"></span>
              Creating account...
            </>
          ) : (
            "Sign Up"
          )}
        </button>
      </form>
    </div>
  );
}
