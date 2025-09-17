"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";

type Props = {
  onDetected: (code: string) => void;
  onClose: () => void;
};

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        const cams = all.filter((d) => d.kind === "videoinput");
        setDevices(cams);
        setDeviceId((cams[0] && cams[0].deviceId) || null);
      } catch (e: any) {
        setErr(e?.message || "Camera enumeration failed.");
      }
    })();
  }, []);

  useEffect(() => {
    start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  async function start() {
    if (!deviceId || !videoRef.current) return;
    setErr(null);
    setStarting(true);
    stop();
    try {
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(
        deviceId,
        videoRef.current,
        (result, error) => {
          if (result) {
            onDetected(result.getText());
            // freeze until parent closes modal
          }
        }
      );
      controlsRef.current = controls;
    } catch (e: any) {
      setErr(e?.message || "Failed to start scanner.");
    } finally {
      setStarting(false);
    }
  }

  function stop() {
    try {
      controlsRef.current?.stop();
      controlsRef.current = null;
    } catch {}
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="title">Scan barcode</h3>

        <div className="row">
          <select
            value={deviceId || ""}
            onChange={(e) => setDeviceId(e.currentTarget.value || null)}
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || "Camera"}
              </option>
            ))}
          </select>
          <button className="btn" onClick={start} disabled={!deviceId || starting}>
            {starting ? "Starting…" : "Restart"}
          </button>
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        <div className="videoWrap">
          <video ref={videoRef} className="video" autoPlay muted playsInline />
          <div className="hint">Point camera at barcode (EAN/UPC)</div>
        </div>

        {err && <p className="err">{err}</p>}

        <style jsx>{`
          .overlay{position:fixed; inset:0; background:rgba(2,6,23,.6); display:grid; place-items:center; padding:16px; z-index:1000;}
          .modal{width:100%; max-width:700px; background:#fff; border:1px solid #e5e7eb; border-radius:14px; padding:16px; box-shadow:0 24px 60px rgba(0,0,0,.25);}
          .title{margin:0 0 10px; font-size:18px; font-weight:800; color:#0f172a;}
          .row{display:flex; gap:8px; align-items:center; margin-bottom:10px;}
          select{border:1px solid #d1d5db; border-radius:10px; padding:8px 10px;}
          .btn{border:1px solid #e5e7eb; background:#fff; border-radius:10px; padding:6px 10px; cursor:pointer;}
          .videoWrap{position:relative; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; background:#000;}
          .video{width:100%; height:380px; object-fit:cover;}
          .hint{position:absolute; bottom:8px; left:8px; color:#fff; background:rgba(0,0,0,.35); padding:4px 8px; border-radius:8px; font-size:12px;}
          .err{margin-top:8px; background:#fef2f2; color:#991b1b; border:1px solid #fecaca; border-radius:8px; padding:6px 8px; font-size:12px;}
        `}</style>
      </div>
    </div>
  );
}
