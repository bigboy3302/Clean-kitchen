"use client";

import { useEffect } from "react";
import BarcodeScanner from "@/components/pantry/BarcodeScanner";

export default function CameraModal({
  open,
  onClose,
  onDetected,
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}) {

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = open ? "hidden" : prev || "";
    return () => { document.body.style.overflow = prev || ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(e)=>e.stopPropagation()}>
        <div className="head">
          <div className="t">Scan barcode</div>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>

 
        <div className="body">
          <BarcodeScanner autoStart onDetected={onDetected} maxHeight={420} />
        </div>
      </div>

      <style jsx>{`
        .overlay {
          position: fixed; inset: 0;
          background: rgba(2,6,23,.55);
          display: grid; place-items: center;
          padding: 16px; z-index: 1200;
        }
        .modal {
          width: 100%; max-width: 860px;
          background: var(--card-bg); border-radius: 16px; overflow: hidden;
          border: 1px solid var(--border);
          box-shadow: 0 24px 60px rgba(0,0,0,.35);
        }
        .head {
          display: grid; grid-template-columns: 1fr auto; align-items: center;
          padding: 12px 14px; border-bottom: 1px solid var(--border);
          background: var(--bg2);
        }
        .t { font-weight: 800; color: var(--text); }
        .x { border: none; background: transparent; font-size: 22px; color: var(--muted); cursor: pointer; padding: 6px; }
        .x:hover { background: color-mix(in oklab, var(--bg2) 85%, var(--primary) 15%); border-radius: 8px; }
        .body { padding: 12px; }
      `}</style>
    </div>
  );
}
