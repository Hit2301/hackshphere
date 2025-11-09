import React, { useState } from "react";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import app from "../helpers/firebase";

export default function Signup() {
  const auth = getAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");

  async function signup(e) {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, email, pw);
      window.location.href = "/";
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420 }}>
      <h2>Signup</h2>
      <form
        onSubmit={signup}
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
        <button className="bg-green-600 text-white px-4 py-2 rounded">
          Sign Up
        </button>
      </form>
    </div>
  );
}
