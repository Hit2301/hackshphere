import React, { useState } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import app from "../helpers/firebase";

export default function Login() {
  const auth = getAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");

  async function login(e) {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, pw);
      window.location.href = "/";
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420 }}>
      <h2>Login</h2>
      <form
        onSubmit={login}
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        <input
          className="p-2 border"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="p-2 border"
          type="password"
          placeholder="Password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <button className="bg-blue-600 text-white px-4 py-2 rounded">
          Login
        </button>
      </form>
    </div>
  );
}
