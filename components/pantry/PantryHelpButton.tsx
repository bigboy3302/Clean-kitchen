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
      <button
        type="button"
        className="helpBtn"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-controls="pantry-help"
        title="How to use Pantry"
      >
        <span className="dot" aria-hidden>?</span>
      </button>

      {open && (
        <div
          id="pantry-help"
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-label="How to use Pantry"
          onClick={() => setOpen(false)}
        >
          <div className="modal" onClick={(e)=>e.stopPropagation()}>
            <div className="modalHead">
              <h3 className="title">How to use Pantry</h3>
              <button ref={closeRef} className="x" onClick={() => setOpen(false)} aria-label="Close help">×</button>
            </div>

            <div className="content">
              <ol className="steps">
                <li><strong>Add / Merge:</strong> Scan or type. We auto-clean names and merge by barcode or name.</li>
                <li><strong>Active vs Expired:</strong> Past-dated items move to <em>Expired</em>.</li>
                <li><strong>Camera tips:</strong> HTTPS + camera permission; hold steady 20–30 cm away.</li>
                <li><strong>Edit quickly:</strong> Use the ✎ icon on cards for an inline editor.</li>
              </ol>
              <p className="muted">Only you can see your pantry items.</p>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .helpBtn {
          appearance: none;
          border: 1px solid var(--border);
          background: var(--bg);
          color: var(--text);
          width: 38px; height: 38px; border-radius: 12px;
          display:grid; place-items:center; cursor:pointer;
          box-shadow: 0 10px 28px rgba(2,6,23,.08);
          transition: transform .12s ease, background .2s ease;
        }
        .helpBtn:hover { background: color-mix(in oklab, var(--bg2) 85%, var(--primary) 15%); transform: translateY(-1px); }
        .dot { font-weight: 900; }

        .overlay { position:fixed; inset:0; background:rgba(2,6,23,.45); display:grid; place-items:center; padding:16px; z-index:1000; }
        .modal {
          width:100%; max-width:620px;
          border:1px solid var(--border);
          background:
            radial-gradient(130% 60% at 100% -20%, color-mix(in oklab, var(--primary) 20%, transparent), transparent),
            var(--card-bg);
          backdrop-filter: blur(6px);
          border-radius:18px; box-shadow:0 24px 60px rgba(0,0,0,.25);
          animation: in .18s ease-out both;
        }
        @keyframes in { from{opacity:.0; transform: translateY(10px)} to{opacity:1; transform: translateY(0)} }
        .modalHead { display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid var(--border); background: var(--bg); }
        .title { margin:0; font-size:18px; font-weight:900; color:var(--text); }
        .x { border:none; background:transparent; font-size:22px; line-height:1; cursor:pointer; color:var(--muted); padding:6px; border-radius:8px; }
        .x:hover { background: var(--bg2); }
        .content { padding:14px; display:grid; gap:10px; }
        .steps { margin:0; padding-left:18px; display:grid; gap:8px; }
        .steps li { color:var(--text); }
        .muted { color: var(--muted); font-size:12px; margin-top:6px; }
      `}</style>
    </>
  );
}
