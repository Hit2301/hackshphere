import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import app from "../helpers/firebase";

export default function Login() {
  const auth = getAuth(app);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");

  async function login(e) {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, pw);
      navigate("/dashboard"); // ✅ Redirect to Dashboard after login
    } catch (err) {
      alert(err.message);
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
        />
        <input
          className="p-2 border rounded"
          type="password"
          placeholder="Password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Login
        </button>
      </form>
    </div>
  );
}
