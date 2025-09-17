// components/pantry/BarcodeScanner.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  IScannerControls,
} from "@zxing/browser";

type Props = {
  onDetected: (code: string) => void;
  // If false, camera is hidden and only photo upload is offered
  allowCamera?: boolean;
};

export default function BarcodeScanner({ onDetected, allowCamera = true }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [mode, setMode] = useState<"camera" | "photo">(allowCamera ? "camera" : "photo");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Start/stop camera decoding
  useEffect(() => {
    if (!allowCamera || mode !== "camera") {
      stopCamera();
      return;
    }

    let mounted = true;
    const reader = new BrowserMultiFormatReader();

    async function start() {
      setErr(null);
      try {
        // Use constraints API (3 args): constraints, videoEl, callback
        const controls = await reader.decodeFromConstraints(
          {
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          } as MediaStreamConstraints,
          videoRef.current!,
          (result, _err) => {
            if (!mounted) return;
            if (result) {
              onDetected(result.getText());
              // stop after first successful scan
              stopCamera();
              setMode("photo"); // optional: switch to photo tab after success
            }
          }
        );
        controlsRef.current = controls;
      } catch (e: any) {
        // Typical reasons: http (not https), permission denied, no camera
        setErr(
          e?.name === "NotAllowedError"
            ? "Camera permission was denied. Use the Photo tab instead."
            : e?.message || "Camera failed to start. Use the Photo tab."
        );
      }
    }

    if (videoRef.current) {
      // iOS/Safari playback hints
      videoRef.current.setAttribute("playsInline", "true");
      videoRef.current.muted = true;
      videoRef.current.autoplay = true;
      start();
    }

    return () => {
      mounted = false;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, allowCamera]);

  function stopCamera() {
    try {
      controlsRef.current?.stop();
    } catch {}
    controlsRef.current = null;

    // Also stop tracks explicitly (defensive)
    const v = videoRef.current;
    const stream = (v?.srcObject as MediaStream | null) || null;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      if (v) v.srcObject = null;
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const url = URL.createObjectURL(file);
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(url);
      URL.revokeObjectURL(url);
      onDetected(result.getText());
    } catch (e: any) {
      setErr(e?.message || "Could not read a barcode from the image.");
    } finally {
      setBusy(false);
      e.currentTarget.value = "";
    }
  }

  return (
    <div className="scanWrap">
      <div className="tabs">
        {allowCamera && (
          <button
            type="button"
            className={`tab ${mode === "camera" ? "active" : ""}`}
            onClick={() => setMode("camera")}
          >
            Camera
          </button>
        )}
        <button
          type="button"
          className={`tab ${mode === "photo" ? "active" : ""}`}
          onClick={() => setMode("photo")}
        >
          Photo
        </button>
      </div>

      {mode === "camera" && allowCamera ? (
        <div className="cam">
          <video ref={videoRef} className="video" />
          <div className="hint">
            If it’s black: use HTTPS, allow camera permissions, and use the Photo tab if your device has no camera.
          </div>
        </div>
      ) : (
        <div className="upload">
          <input
            type="file"
            accept="image/*"
            // lets mobile open rear camera app to take a photo if they want
            capture="environment"
            onChange={handleFile}
            disabled={busy}
          />
          {busy && <div className="hint">Reading image…</div>}
        </div>
      )}

      {err && <p className="err">{err}</p>}

      <style jsx>{`
        .scanWrap { display:grid; gap:10px; }
        .tabs { display:flex; gap:8px; }
        .tab {
          border:1px solid #e5e7eb; background:#fff; padding:6px 10px;
          border-radius:10px; cursor:pointer;
        }
        .tab.active { background:#0f172a; color:#fff; border-color:#0f172a; }
        .cam { display:grid; gap:6px; }
        .video {
          width:100%;
          max-height:360px;
          background:#000;
          border-radius:12px;
          border:1px solid #e5e7eb;
          object-fit:cover;
        }
        .upload { display:grid; gap:8px; }
        .hint { color:#64748b; font-size:12px; }
        .err {
          background:#fef2f2; color:#991b1b;
          border:1px solid #fecaca; border-radius:8px;
          padding:6px 8px; font-size:12px;
        }
      `}</style>
    </div>
  );
}
