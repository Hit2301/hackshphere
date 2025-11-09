import React, { useState, useRef, useEffect } from "react";

export default function Recorder({ onUpload, setStatus }) {
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const [blob, setBlob] = useState(null);
  const [time, setTime] = useState(0); // timer in seconds
  const mediaRecorderRef = useRef(null);
  const chunks = useRef([]);
  const timerRef = useRef(null);

  // 🎤 Start Recording
  const startRecording = async () => {
    setStatus("Requesting microphone...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      chunks.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunks.current, { type: "audio/wav" });
        setBlob(audioBlob);
        setAudioURL(URL.createObjectURL(audioBlob));
        setStatus("Recording ready ✅");
        stream.getTracks().forEach((track) => track.stop());
        clearInterval(timerRef.current);
        setRecording(false);
      };

      mediaRecorder.start();
      setRecording(true);
      setStatus("Recording...");
      setTime(0);
      timerRef.current = setInterval(() => {
        setTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone error:", err);
      alert("Microphone access denied or unavailable.");
      setStatus("Microphone error ❌");
    }
  };

  // 🛑 Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setStatus("Recording stopped");
    }
  };

  // 🔁 Reset Recording
  const resetRecording = () => {
    setBlob(null);
    setAudioURL(null);
    setTime(0);
    clearInterval(timerRef.current);
    setStatus("Recording reset 🔁");
  };

  // 📁 Upload audio file from device
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("audio")) {
      setBlob(file);
      setAudioURL(URL.createObjectURL(file));
      setStatus("File loaded ✅");
      setTime(0);
    } else {
      alert("Please select a valid audio file.");
    }
  };

  // ☁️ Upload to backend
  const uploadRecording = async () => {
    if (!blob) {
      alert("No audio to upload");
      return;
    }
    setStatus("Uploading...");
    await onUpload(blob);
  };

  // 🕒 Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");
    return `${mins}:${secs}`;
  };

  // 🧹 Cleanup timer on unmount
  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  return (
    <div className="card p-4 flex flex-col items-center">
      <h3 className="text-lg font-semibold mb-3">🎤 Voice Recorder</h3>

      {/* Timer */}
      {recording && (
        <p className="text-red-600 font-mono text-lg mb-2">
          ⏱ {formatTime(time)}
        </p>
      )}

      <div className="flex flex-wrap gap-3 mb-4 justify-center">
        {!recording ? (
          <button
            onClick={startRecording}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="bg-red-600 text-white px-4 py-2 rounded"
          >
            Stop Recording
          </button>
        )}

        <button
          onClick={uploadRecording}
          disabled={!blob}
          className={`px-4 py-2 rounded ${
            blob ? "bg-green-600 text-white" : "bg-gray-400 text-white"
          }`}
        >
          Upload Recording
        </button>

        <button
          onClick={resetRecording}
          disabled={!blob}
          className={`px-4 py-2 rounded ${
            blob ? "bg-yellow-500 text-white" : "bg-gray-400 text-white"
          }`}
        >
          Reset
        </button>
      </div>

      {/* 📁 Upload from device */}
      <label className="cursor-pointer text-blue-700 hover:underline mb-2">
        Upload Audio from Device
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </label>

      {/* 🎧 Preview */}
      {audioURL && (
        <div className="w-full mt-3 text-center">
          <p className="text-sm text-gray-700 mb-1">Preview your audio:</p>
          <audio controls src={audioURL} className="w-full"></audio>
        </div>
      )}
    </div>
  );
}
