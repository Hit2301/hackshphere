import React, { useState, useRef, useEffect } from "react";

export default function Recorder({ onUpload, setStatus }) {
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const [blob, setBlob] = useState(null);
  const [time, setTime] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunks = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);

  const startRecording = async () => {
    setStatus("Requesting microphone...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // ✅ Play your own voice live for feedback
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const destination = audioCtx.createMediaStreamDestination();
      source.connect(destination);
      source.connect(audioCtx.destination); // play live
      audioCtxRef.current = audioCtx;

      const mimeType =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

      const mediaRecorder = new MediaRecorder(destination.stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunks.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: mimeType });
        setBlob(blob);
        setAudioURL(URL.createObjectURL(blob));
        setStatus("Recording ready ✅");

        if (audioCtxRef.current) audioCtxRef.current.close();
        if (streamRef.current)
          streamRef.current.getTracks().forEach((t) => t.stop());
        clearInterval(timerRef.current);
        setRecording(false);
      };

      mediaRecorder.start();
      setRecording(true);
      setStatus("Recording...");
      setTime(0);

      timerRef.current = setInterval(() => setTime((t) => t + 1), 1000);
    } catch (err) {
      console.error("Microphone error:", err);
      setStatus("Microphone error ❌");
      alert("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setStatus("Recording stopped");
    }
  };

  const resetRecording = () => {
    setBlob(null);
    setAudioURL(null);
    setTime(0);
    setUploadProgress(0);
    clearInterval(timerRef.current);
    setStatus("Recording reset 🔁");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("audio")) {
      setBlob(file);
      setAudioURL(URL.createObjectURL(file));
      setStatus("File loaded ✅");
    } else {
      alert("Please select a valid audio file.");
    }
  };

  const uploadRecording = async () => {
    if (!blob) {
      alert("No audio to upload");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setStatus("Uploading...");

    try {
      for (let i = 1; i <= 100; i++) {
        await new Promise((res) => setTimeout(res, 25));
        setUploadProgress(i);
      }

      await onUpload(blob);
      setStatus("Upload successful ✅");
    } catch (err) {
      console.error(err);
      setStatus("Upload failed ❌");
    } finally {
      setUploading(false);
      setUploadProgress(100);
    }
  };

  const formatTime = (s) => {
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${m}:${sec}`;
  };

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="card p-4 flex flex-col items-center">
      <h3 className="text-lg font-semibold mb-3">🎤 Voice Recorder</h3>

      {recording && (
        <div className="flex items-center mb-2">
          <span className="w-3 h-3 rounded-full bg-red-600 mr-2 animate-pulse" />
          <p className="text-red-600 font-mono text-lg">{formatTime(time)}</p>
        </div>
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
          disabled={!blob || uploading}
          className={`px-4 py-2 rounded ${
            blob ? "bg-green-600 text-white" : "bg-gray-400 text-white"
          }`}
        >
          {uploading ? "Uploading..." : "Upload Recording"}
        </button>
        <button
          onClick={resetRecording}
          disabled={!blob || uploading}
          className={`px-4 py-2 rounded ${
            blob ? "bg-yellow-500 text-white" : "bg-gray-400 text-white"
          }`}
        >
          Reset
        </button>
      </div>

      <label className="cursor-pointer text-blue-700 hover:underline mb-2">
        Upload Audio from Device
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </label>

      {audioURL && (
        <div className="w-full mt-3 text-center">
          <p className="text-sm text-gray-300 mb-1">Preview your audio:</p>
          <audio controls src={audioURL} className="w-full" />
        </div>
      )}

      {uploading && (
        <div className="w-full mt-4 bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-green-500 h-full transition-all duration-200"
            style={{ width: `${uploadProgress}%` }}
          ></div>
        </div>
      )}
    </div>
  );
}