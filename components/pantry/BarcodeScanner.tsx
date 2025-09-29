
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";

type Props = {
  onDetected: (code: string) => void;
  autoStart?: boolean;
  maxHeight?: number;
};

export default function BarcodeScanner({
  onDetected,
  autoStart = true,
  maxHeight = 560, 
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);


  const hints = useMemo(() => {
    const m = new Map();
    m.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.EAN_8,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
    ]);
    m.set(DecodeHintType.TRY_HARDER, true);
    return m;
  }, []);

 
  const readerOpts = useMemo(
    () => ({
      delayBetweenScanAttempts: 200,  
      delayBetweenScanSuccess: 500,   
    }),
    []
  );

  useEffect(() => {
    if (autoStart) startCamera();
    return () => stopCamera();
  }, []);

  async function startCamera() {
    if (running) return;
    setErr(null);
    try {
      if (videoRef.current) {
        videoRef.current.setAttribute("playsInline", "true");
        videoRef.current.autoplay = true;
        videoRef.current.muted = true;
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      };

      const reader = new BrowserMultiFormatReader(hints, readerOpts);
      const controls = await reader.decodeFromConstraints(
        constraints,
        videoRef.current!,
        (result) => {
          if (result) {
            stopCamera();                
            onDetected(result.getText()); 
          }
        }
      );
      controlsRef.current = controls;
      setRunning(true);
    } catch (e: any) {
      setErr(
        e?.name === "NotAllowedError"
          ? "Camera permission was denied. Allow it in the browser settings."
          : e?.message || "Camera failed to start. Check HTTPS or try again."
      );
      setRunning(false);
    }
  }

  function stopCamera() {
    try { controlsRef.current?.stop(); } catch {}
    controlsRef.current = null;

    const v = videoRef.current;
    const stream = (v?.srcObject as MediaStream | null) || null;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      if (v) v.srcObject = null;
    }
    setRunning(false);
  }

  return (
    <div className="scanWrap">
      <div className="row">
        {!running ? (
          <button type="button" className="btn" onClick={startCamera}>Start camera</button>
        ) : (
          <button type="button" className="btn" onClick={stopCamera}>Stop camera</button>
        )}
      </div>

      <div className="cam">
        <video ref={videoRef} className="video" />
        <div className="hint">
          Tip: fill most of the frame, keep lines horizontal, avoid glare. Works best over HTTPS.
        </div>
      </div>

      {err && <p className="err">{err}</p>}

      <style jsx>{`
        .scanWrap { display:grid; gap:10px; }
        .row { display:flex; gap:8px; }
        .btn { border:1px solid #e5e7eb; background:#fff; padding:8px 12px; border-radius:10px; cursor:pointer; }
        .cam { display:grid; gap:6px; }
        .video {
          width: 100%;
          max-height: ${maxHeight}px;
          background:#000;
          border-radius:12px;
          border:1px solid #e5e7eb;
          object-fit: cover;
          aspect-ratio: 16 / 9;
        }
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
