"use client";

import React from "react";

type TrashItem = {
  id: string;
  name: string;
  quantity: number;
};

type Props = {
  items: TrashItem[];
  isOpen: boolean;
  onToggleOpen: (v: boolean) => void;
};

export default function TrashCan({ items, isOpen, onToggleOpen }: Props) {
  return (
    <div className={`can ${isOpen ? "open" : ""}`}>
      <div className="body">
        <button className="lid" onClick={() => onToggleOpen(!isOpen)} aria-label="Toggle trash">
          <span className="label">Trash</span>
          <span className="pill">{isOpen ? "Open" : "Close"}</span>
        </button>

        {/* Only render contents when OPEN */}
        {isOpen && (
          <div className="outs">
            {items.length === 0 ? (
              <div className="empty">Nothing expired</div>
            ) : (
              items.map((it, i) => (
                <div className="crumb" key={it.id} style={{ animationDelay: `${i * 60}ms` }}>
                  <span className="n">{it.name}</span>
                  <span className="q">×{it.quantity}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .can { width: 100%; }
        .body {
          position: relative;
          border-radius: 20px;
          overflow: hidden;
          background: linear-gradient(180deg, #f6f7fb, #e3e8f2);
          border: 1px solid rgba(15,23,42,.08);
          box-shadow: 0 18px 44px rgba(15,23,42,.14), inset 0 0 0 1px rgba(255,255,255,.6);
          min-height: 210px;
        }
        .lid {
          position: relative;
          width: 100%;
          border: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          height: 58px;
          background: linear-gradient(180deg, rgba(255,255,255,.85), rgba(255,255,255,.5));
          border-bottom: 1px solid rgba(15,23,42,.08);
          cursor: pointer;
          padding: 10px 12px;
        }
        .label { font-weight: 900; color: #0f172a; }
        .pill {
          display: inline-flex; align-items: center; height: 28px; padding: 0 12px;
          border-radius: 999px; background: #ffebee; color: #b91c1c; font-weight: 900;
          border: 1px solid rgba(185,28,28,.18);
        }

        .outs { padding: 12px; display: grid; gap: 8px; }
        .crumb {
          display:flex; justify-content:space-between; gap:8px;
          border:1px dashed rgba(15,23,42,.15); background:#fff; border-radius:10px; padding:8px 10px;
          translate: 0 6px; opacity:0; animation: drift .28s ease-out both;
        }
        @keyframes drift{ from { opacity:0; translate:0 8px; } to { opacity:1; translate:0 0; } }
        .n{ font-weight:800; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#0f172a; }
        .q{ color:#64748b; font-weight:900; }
        .empty{ color:#64748b; font-size:12px; text-align:center; border:1px dashed rgba(15,23,42,.18); padding:10px; border-radius:10px; background:#fff; }
      `}</style>
    </div>
  );
}
