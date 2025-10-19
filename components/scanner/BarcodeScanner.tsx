
"use client";

import { useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  IScannerControls,
} from "@zxing/browser";

type Props = { onDetected: (code: string) => void };
type TorchConstraintSet = MediaTrackConstraintSet & { torch: boolean };

export default function BarcodeScanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const [running, setRunning] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | "">("");
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  const [torchOn, setTorchOn] = useState(false);
  const [torchCapable, setTorchCapable] = useState(false);

  const [err, setErr] = useState<string | null>(null);

 
  useEffect(() => {
    (async () => {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const list = await navigator.mediaDevices.enumerateDevices();
        const cams = list.filter((d) => d.kind === "videoinput");
        setDevices(cams);
        const rear = cams.find((c) => /back|rear|environment/i.test(c.label || ""));
        if (rear) setDeviceId(rear.deviceId);
      } catch {}
    })();
  }, []);


  useEffect(() => {
    if (!running) return stop();

    let mounted = true;
    const reader = new BrowserMultiFormatReader();

    (async () => {
      setErr(null);
      try {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        };

        const ctrls = await reader.decodeFromConstraints(
          constraints,
          videoRef.current!,
          (result) => {
            if (!mounted) return;
            if (result) {
              try { navigator.vibrate?.(30); } catch {}
              onDetected(result.getText());
              setRunning(false);
            }
          }
        );
        controlsRef.current = ctrls;

        if (videoRef.current) {
          videoRef.current.setAttribute("playsInline", "true");
          videoRef.current.muted = true;
          videoRef.current.autoplay = true;
        }

       
        const track = getVideoTrack();
        const caps = track?.getCapabilities?.();
        setTorchCapable(Boolean(caps && "torch" in caps));
      } catch (error: unknown) {
        const err = (error ?? {}) as { name?: string; message?: string };
        const msg =
          err?.name === "NotAllowedError"
            ? "Camera permission denied. Allow it or type the barcode."
            : err?.message || "Camera failed to start (HTTPS or localhost required).";
        setErr(msg);
        setRunning(false);
      }
    })();

    return () => { mounted = false; stop(); };

  }, [running, deviceId, facing, onDetected]);

  function stop() {
    try { controlsRef.current?.stop(); } catch {}
    controlsRef.current = null;
    setTorchOn(false);
    const v = videoRef.current;
    const stream = v?.srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      if (v) v.srcObject = null;
    }
  }

  function getVideoTrack(): MediaStreamTrack | null {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    return stream?.getVideoTracks?.()[0] || null;
  }

  async function toggleTorch() {
    const track = getVideoTrack();
    const caps = track?.getCapabilities?.();
    if (!track || !caps || !("torch" in caps)) return;
    try {
      const torchConstraints: MediaTrackConstraints = {
        advanced: [{ torch: !torchOn } as TorchConstraintSet],
      };
      await track.applyConstraints(torchConstraints);
      setTorchOn((s) => !s);
    } catch {}
  }

  return (
    <div className="wrap">
      <div className="controls">
        <button className={`btn ${running ? "danger" : ""}`} onClick={() => setRunning((s) => !s)}>
          {running ? "Stop camera" : "Start camera"}
        </button>

        <button
          className="btn"
          onClick={() => {
            setFacing((f) => (f === "environment" ? "user" : "environment"));
            if (running) { setRunning(false); setTimeout(() => setRunning(true), 50); }
          }}
        >
          Flip
        </button>

        {devices.length > 0 && (
          <select
            className="sel"
            value={deviceId}
            onChange={(e) => {
              setDeviceId(e.target.value);
              if (running) { setRunning(false); setTimeout(() => setRunning(true), 50); }
            }}
          >
            <option value="">Auto camera</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${d.deviceId.slice(0,6)}…`}
              </option>
            ))}
          </select>
        )}

        {torchCapable && running && (
          <button className="btn" onClick={toggleTorch}>{torchOn ? "Torch off" : "Torch on"}</button>
        )}
      </div>

      <video ref={videoRef} className="video" />
      {err && <p className="err">{err}</p>}

      <style jsx>{`
        .wrap { display:grid; gap:8px; }
        .controls { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
        .btn { border:1px solid #e5e7eb; background:#fff; border-radius:10px; padding:6px 10px; cursor:pointer; }
        .btn.danger { background:#fee2e2; color:#991b1b; border-color:#fecaca; }
        .sel { border:1px solid #e5e7eb; background:#fff; border-radius:10px; padding:6px 10px; }
        .video { width:100%; max-height:360px; background:#000; border-radius:12px; border:1px solid #e5e7eb; object-fit:cover; }
        .err { background:#fef2f2; color:#991b1b; border:1px solid #fecaca; border-radius:8px; padding:6px 8px; font-size:12px; }
      `}</style>
    </div>
  );
}
