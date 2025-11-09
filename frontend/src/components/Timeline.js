import React, { useEffect, useState } from "react";
import { supabase } from "../helpers/supabase";

export default function Timeline({ user }) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    async function load() {
      if (!user) return;

      const { data, error } = await supabase
        .from("voice_results")
        .select("*")
        .eq("user_id", user.uid)
        .order("created_at", { ascending: false });

      if (error) console.error("Supabase error:", error);
      else setResults(data);
    }
    load();
  }, [user]);

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3 className="font-semibold">History</h3>
      {results.length ? (
        <ul>
          {results.map((r) => (
            <li key={r.id}>
              {new Date(r.created_at).toLocaleString()} — Score: {r.score} (
              {r.label})
            </li>
          ))}
        </ul>
      ) : (
        <p>No results yet</p>
      )}
    </div>
  );
}
