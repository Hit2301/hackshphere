import React, { useState } from "react";

export default function Recorder({ onUpload, setStatus }) {
  const [recording, setRecording] = useState(false);
  const [file, setFile] = useState(null);

  async function startRecording() {
    setStatus("Requesting microphone...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: mimeType });
        const audioFile = new File([blob], `recording-${Date.now()}.webm`, {
          type: mimeType,
        });
        setFile(audioFile);
        setStatus("Recording ready ✅");
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setRecording(true);
      setStatus("Recording... 🎙️");

      // Auto stop after 4 seconds
      setTimeout(() => {
        recorder.stop();
        setRecording(false);
      }, 4000);
    } catch (err) {
      console.error("Microphone error:", err);
      setStatus("Microphone error ❌");
      alert("Microphone access denied or unavailable.");
    }
  }

  async function handleUpload() {
    if (!file) {
      alert("No audio recorded yet!");
      return;
    }
    setStatus("Uploading...");
    await onUpload(file);
  }

  return (
    <div className="card">
      <button
        className="bg-blue-600 text-white px-4 py-2 rounded mr-2"
        onClick={startRecording}
        disabled={recording}
      >
        {recording ? "Recording..." : "Start Recording"}
      </button>

      <button
        className="bg-green-600 text-white px-4 py-2 rounded"
        onClick={handleUpload}
        disabled={!file}
      >
        Upload
      </button>
    </div>
  );
}
