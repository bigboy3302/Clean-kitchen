
"use client";

import { useEffect, useRef, useState } from "react";

export default function PantryHelpButton() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    const id = requestAnimationFrame(() => closeRef.current?.focus());
    return () => { window.removeEventListener("keydown", onKey); cancelAnimationFrame(id); };
  }, [open]);

  return (
    <>
      <button type="button" className="helpBtn" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-controls="pantry-help">
        ?
      </button>

      {open && (
        <div id="pantry-help" className="overlay" role="dialog" aria-modal="true" aria-label="How to use Pantry"
             onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e)=>e.stopPropagation()}>
            <div className="modalHead">
              <h3 className="title">How to use Pantry</h3>
              <button ref={closeRef} className="x" onClick={() => setOpen(false)} aria-label="Close help">×</button>
            </div>

            <div className="content">
              <ol className="steps">
                <li><strong>Add / Merge:</strong> Scan a barcode or type it. We auto-clean the name (e.g., “Italiano Pasta” → “Pasta”) and show nutrition. Set quantity & expiry, then press <em>Add / Merge</em>. If the item exists (same barcode or cleaned name), quantity increases.</li>
                <li><strong>Active vs Expired:</strong> Past-dated items move to the Expired section. You can still edit or delete them.</li>
                <li><strong>Camera tips:</strong> Use HTTPS, allow camera permissions, hold steady, and fill the frame. Curved bottles may need extra patience.</li>
                <li><strong>Editing:</strong> Click <em>Edit</em> on a card to change name (auto-Capitalized), quantity, or expiry.</li>
              </ol>
              <p className="muted">Only you can see and manage your pantry items.</p>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .helpBtn {
          border:1px solid #e5e7eb; background:#fff; color:#0f172a;
          width:34px; height:34px; border-radius:999px; font-weight:700;
          cursor:pointer; display:inline-grid; place-items:center;
        }
        .helpBtn:hover { background:#f8fafc; }
        .overlay {
          position:fixed; inset:0; background:rgba(2,6,23,.45);
          display:grid; place-items:center; padding:16px; z-index:1000;
        }
        .modal {
          width:100%; max-width:560px; background:#fff; border-radius:14px;
          border:1px solid #e5e7eb; box-shadow:0 24px 60px rgba(0,0,0,.2);
        }
        .modalHead {
          display:flex; align-items:center; justify-content:space-between;
          padding:12px 14px; border-bottom:1px solid #f1f5f9;
        }
        .title { margin:0; font-size:18px; font-weight:800; color:#0f172a; }
        .x {
          border:none; background:transparent; font-size:22px; line-height:1; cursor:pointer;
          color:#0f172a; padding:6px; border-radius:8px;
        }
        .x:hover { background:#f8fafc; }
        .content { padding:14px; display:grid; gap:10px; }
        .steps { margin:0; padding-left:18px; display:grid; gap:8px; }
        .steps li { color:#0f172a; }
        .muted { color:#64748b; font-size:12px; margin-top:6px; }
      `}</style>
    </>
  );
}
