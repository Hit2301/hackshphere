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
  const analyserRef = useRef(null);
  const liveWaveRef = useRef(null);
  const staticWaveRef = useRef(null);
  const animationRef = useRef(null);

  // ---- Draw live waveform ----
  const drawLiveWave = () => {
    const canvas = liveWaveRef.current;
    const ctx = canvas.getContext("2d");
    const analyser = analyserRef.current;
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
      grad.addColorStop(0, "#0fb9a4");
      grad.addColorStop(1, "#0e7ac4");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };
    draw();
  };

  // ---- Draw static waveform ----
  const drawStaticWave = async (url) => {
    if (!url) return;
    const canvas = staticWaveRef.current;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const resp = await fetch(url);
      const arr = await resp.arrayBuffer();
      const decoded = await audioCtx.decodeAudioData(arr);
      const data = decoded.getChannelData(0);

      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 2;
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, "#ffd36b");
      grad.addColorStop(1, "#ff6b63");
      ctx.strokeStyle = grad;
      ctx.beginPath();

      const step = Math.floor(data.length / width);
      for (let i = 0; i < width; i++) {
        const min = data[i * step];
        const y = (0.5 + min / 2) * height;
        if (i === 0) ctx.moveTo(i, y);
        else ctx.lineTo(i, y);
      }
      ctx.stroke();
      audioCtx.close();
    } catch (err) {
      console.error("Waveform error:", err);
    }
  };

  // ---- Recording flow ----
  const startRecording = async () => {
    setStatus("Requesting microphone...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const dest = audioCtx.createMediaStreamDestination();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      source.connect(dest);
      source.connect(audioCtx.destination);
      analyserRef.current = analyser;
      audioCtxRef.current = audioCtx;
      drawLiveWave();

      const mime =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
      const recorder = new MediaRecorder(dest.stream, { mimeType: mime });
      mediaRecorderRef.current = recorder;
      chunks.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      recorder.onstop = () => {
        const b = new Blob(chunks.current, { type: mime });
        setBlob(b);
        const url = URL.createObjectURL(b);
        setAudioURL(url);
        drawStaticWave(url);
        setStatus("Recording ready ✅");
        if (audioCtxRef.current) audioCtxRef.current.close();
        if (streamRef.current)
          streamRef.current.getTracks().forEach((t) => t.stop());
        cancelAnimationFrame(animationRef.current);
        clearInterval(timerRef.current);
        setRecording(false);
      };

      recorder.start();
      setRecording(true);
      setTime(0);
      setStatus("Recording...");
      timerRef.current = setInterval(() => setTime((t) => t + 1), 1000);
    } catch (err) {
      console.error("Mic error:", err);
      setStatus("Microphone error ❌");
      alert("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive")
      mediaRecorderRef.current.stop();
  };

  const resetRecording = () => {
    setBlob(null);
    setAudioURL(null);
    setTime(0);
    setUploadProgress(0);
    cancelAnimationFrame(animationRef.current);
    clearInterval(timerRef.current);
    setStatus("Recording reset 🔁");
    const ctx1 = liveWaveRef.current.getContext("2d");
    const ctx2 = staticWaveRef.current.getContext("2d");
    ctx1.clearRect(0, 0, liveWaveRef.current.width, liveWaveRef.current.height);
    ctx2.clearRect(0, 0, staticWaveRef.current.width, staticWaveRef.current.height);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("audio")) {
      setBlob(file);
      const url = URL.createObjectURL(file);
      setAudioURL(url);
      drawStaticWave(url);
      setStatus("File loaded ✅");
    } else alert("Please select a valid audio file.");
  };

  const uploadRecording = async () => {
    if (!blob) return alert("No audio to upload");
    setUploading(true);
    setUploadProgress(0);
    setStatus("Uploading...");
    for (let i = 1; i <= 100; i++) {
      await new Promise((r) => setTimeout(r, 25));
      setUploadProgress(i);
    }
    await onUpload(blob);
    setStatus("Upload successful ✅");
    setUploading(false);
  };

  const formatTime = (s) => {
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${m}:${sec}`;
  };

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animationRef.current);
      clearInterval(timerRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="recorder-card">
      <h3 className="recorder-title">🎤 Voice Recorder</h3>

      {recording && (
        <div className="recording-status">
          <span className="pulse-dot" />
          <p className="timer">{formatTime(time)}</p>
        </div>
      )}

      {/* Live waveform */}
      <canvas ref={liveWaveRef} width="800" height="100" className="wave-canvas live" />
      {/* Static waveform */}
      <canvas ref={staticWaveRef} width="800" height="100" className="wave-canvas static" />

      {/* Upload from Device */}
      <label className="upload-label">
        🎧 Upload from Device
        <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
      </label>

      {/* Controls */}
      <div className="recorder-controls">
        {!recording ? (
          <button onClick={startRecording} className="btn start">
            🎙 Start
          </button>
        ) : (
          <button onClick={stopRecording} className="btn stop">
            ⏹ Stop
          </button>
        )}
        <button
          onClick={uploadRecording}
          disabled={!blob || uploading}
          className={`btn upload ${!blob ? "disabled" : ""}`}
        >
          {uploading ? "Uploading..." : "☁️ Upload"}
        </button>
        <button
          onClick={resetRecording}
          disabled={!blob || uploading}
          className={`btn reset ${!blob ? "disabled" : ""}`}
        >
          🔁 Reset
        </button>
      </div>

      {audioURL && (
        <div className="audio-preview">
          <audio controls src={audioURL} className="audio-player" />
        </div>
      )}

      {uploading && (
        <div className="upload-bar">
          <div className="upload-progress" style={{ width: `${uploadProgress}%` }} />
        </div>
      )}

      <style jsx>{`
        .recorder-card {
          text-align: center;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          box-shadow: 0 0 20px rgba(15, 185, 164, 0.15);
        }
        .recorder-title {
          color: #e0faff;
          text-shadow: 0 0 8px rgba(14, 122, 196, 0.7);
        }
        .wave-canvas {
          width: 100%;
          border-radius: 10px;
          margin: 10px 0;
          background: rgba(255, 255, 255, 0.05);
        }
        .live {
          box-shadow: 0 0 20px rgba(14, 122, 196, 0.4);
        }
        .static {
          box-shadow: 0 0 20px rgba(255, 107, 99, 0.3);
        }
        .upload-label {
          display: inline-block;
          margin-top: 0.5rem;
          padding: 0.6rem 1.4rem;
          background: linear-gradient(90deg, #0fb9a4, #0e7ac4);
          color: white;
          font-weight: 600;
          border-radius: 999px;
          cursor: pointer;
          transition: 0.3s;
        }
        .upload-label:hover {
          transform: scale(1.05);
          box-shadow: 0 0 25px rgba(15, 185, 164, 0.6);
        }
        .recorder-controls {
          display: flex;
          justify-content: center;
          gap: 0.8rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }
        .btn {
          padding: 0.7rem 1.6rem;
          border: none;
          border-radius: 50px;
          font-weight: 600;
          cursor: pointer;
          color: white;
          transition: 0.3s;
        }
        .btn.start {
          background: linear-gradient(90deg, #0fb9a4, #0e7ac4);
        }
        .btn.stop {
          background: linear-gradient(90deg, #ff6b63, #d9534f);
        }
        .btn.upload {
          background: linear-gradient(90deg, #13b48f, #1e8e6b);
        }
        .btn.reset {
          background: linear-gradient(90deg, #f39c12, #f6b042);
        }
        .btn.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .timer {
          color: #ff6b63;
          font-family: monospace;
        }
        .pulse-dot {
          width: 10px;
          height: 10px;
          background: #ff6b63;
          border-radius: 50%;
          margin-right: 8px;
          animation: pulse 1s infinite alternate;
        }
        .recording-status {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
        }
        .upload-bar {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          height: 8px;
          overflow: hidden;
          margin-top: 12px;
        }
        .upload-progress {
          height: 100%;
          background: linear-gradient(90deg, #0fb9a4, #0e7ac4);
          transition: width 0.2s ease;
        }
        @keyframes pulse {
          from { opacity: 0.6; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}