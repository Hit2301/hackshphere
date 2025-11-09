import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import app from "../helpers/firebase";

export default function Login() {
  const auth = getAuth(app);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false); // 🔄 loading state

  async function login(e) {
    e.preventDefault();
    if (loading) return; // ⛔ prevent double-clicks
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, pw);
      navigate("/dashboard"); // ✅ redirect
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false); // 🧹 always reset
    }
  }

  return (
    <div className="card max-w-md mx-auto mt-10 p-6 shadow-lg rounded-lg border border-gray-200">
      <h2 className="text-2xl font-semibold mb-4 text-center">Login</h2>
      <form onSubmit={login} className="flex flex-col gap-4">
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
            ${loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {loading ? (
            <>
              <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-5 h-5"></span>
              Logging in...
            </>
          ) : (
            "Login"
          )}
        </button>
      </form>
    </div>
  );
}
