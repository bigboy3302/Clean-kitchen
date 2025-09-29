"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

export default function BarcodeScanner({ onDetected }:{ onDetected?:(text:string)=>void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    let stop = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        while (!stop) {
          const result = await codeReader.decodeOnceFromVideoDevice(undefined, videoRef.current!);
          onDetected?.(result.getText());
          stop = true; 
        }
      } catch (e: any) {
        setError(e?.message ?? "Kameras pieeja liegta.");
      }
    })();

    return () => {
      stop = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [onDetected]);

  return (
    <div>
      <video ref={videoRef} autoPlay playsInline className="w-full rounded-2xl bg-black/5" />
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}
