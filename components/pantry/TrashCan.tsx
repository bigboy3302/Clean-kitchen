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
      <button className="lid" onClick={() => onToggleOpen(!isOpen)} aria-label="Toggle trash" />
      <div className="outs">
        {items.map((it, i) => (
          <div className="crumb" key={it.id} style={{ animationDelay: `${i * 50}ms` }}>
            <span className="n">{it.name}</span>
            <span className="q">×{it.quantity}</span>
          </div>
        ))}
        {items.length === 0 && <div className="empty">Nothing expired</div>}
      </div>

      <style jsx>{`
        .can{ position:relative; width:100%; aspect-ratio: 3/4; border:1px solid var(--border); background:var(--card-bg); border-radius:16px; overflow:hidden; }
        .lid{
          position:absolute; left:12px; right:12px; top:10px; height:26px;
          background: linear-gradient(180deg, var(--bg2), var(--bg));
          border:1px solid var(--border);
          border-radius:10px;
          cursor:pointer;
          transition: transform .28s ease;
        }
        .can.open .lid{ transform: rotateX(30deg) translateY(-6px); transform-origin: top center; }
        .outs{ position:absolute; inset:12px; padding-top:44px; display:grid; gap:8px; }
        .crumb{
          display:flex; justify-content:space-between; gap:8px; border:1px dashed var(--border); background:var(--bg); border-radius:10px; padding:6px 8px;
          translate: 0 6px; opacity:0; animation: drift .28s ease-out both;
        }
        @keyframes drift{ from { opacity:0; translate:0 8px; } to { opacity:1; translate:0 0; } }
        .n{ font-weight:800; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .q{ color:var(--muted); font-weight:900; }
        .empty{ color:var(--muted); font-size:12px; text-align:center; border:1px dashed var(--border); padding:8px; border-radius:10px; }
      `}</style>
    </div>
  );
}
