import React, { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";
import Recorder from "../components/Recorder";
import Timeline from "../components/Timeline";
import Chatbot from "../components/Chatbot";
import { supabase } from "../helpers/supabase";

export default function Dashboard() {
  const auth = getAuth();
  const [user, setUser] = useState(auth.currentUser);
  const [latest, setLatest] = useState(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (u) setUser(u);
      else window.location.href = "/login"; // redirect if logged out
    });
    return () => unsubscribe();
  }, [auth]);

  async function handleUpload(blob) {
    try {
      if (!user) return alert("Please login first");
      setStatus("Uploading...");

      // ✅ Get fresh Firebase ID token
      const idToken = await user.getIdToken(true);

      const file = new File([blob], `voice-${Date.now()}.wav`, {
        type: "audio/wav",
      });

      const formData = new FormData();
      formData.append("file", file);

      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";

      // ✅ Send token with Authorization header
      const response = await fetch(`${backendUrl}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Upload failed");
      }

      const result = await response.json();
      setLatest(result);
      setStatus("Upload complete ✅");

      // // ✅ Store in Supabase history (for local display/timeline)
      // if (result && result.score !== undefined) {
      //   await supabase.from("results").insert([
      //     {
      //       user_id: user.uid,
      //       score: result.score,
      //       label:
      //         result.label ||
      //         (result.score > 0.5 ? "Parkinson Risk" : "Healthy"),
      //       created_at: new Date().toISOString(),
      //     },
      //   ]);
      // }
    } catch (err) {
      console.error("Upload error:", err);
      setStatus("Error: " + err.message);
    }
  }

  return (
    <div>
      <div className="card">
        <h2>Welcome {user?.email || "Guest"}</h2>
        <p>{status}</p>
      </div>

      <Recorder onUpload={handleUpload} setStatus={setStatus} />

      <div className="card">
        <h3>Latest Result</h3>
        <pre>
          {latest ? JSON.stringify(latest, null, 2) : "No results yet"}
        </pre>
      </div>

      <Timeline user={user} />
      <Chatbot />
    </div>
  );
}
