// components/pantry/TrashCan.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";

type Item = { id: string; name: string };

export default function TrashCan({
  items = [],
  isOpen,
  onToggleOpen,
  label = "Expired",
}: {
  items: Item[];
  isOpen: boolean;
  onToggleOpen: (open: boolean) => void;
  label?: string;
}) {
  const [shake, setShake] = useState(false);
  const prev = useRef(items.length);
  useEffect(() => {
    if (items.length > prev.current) { setShake(true); const t=setTimeout(()=>setShake(false), 500); return ()=>clearTimeout(t); }
    prev.current = items.length;
  }, [items.length]);

  return (
    <section className={`bin ${isOpen ? "open" : ""}`}>
      <div className={`can ${shake ? "shake" : ""}`} onClick={() => onToggleOpen(!isOpen)} role="button" aria-label={isOpen?`Close ${label}`:`Open ${label}`}>
        <div className="lid" />
        <div className="box" />
      </div>
      <div className="label">{label}</div>

      {isOpen && (
        <div className="rail">
          {items.map((it) => (
            <div key={it.id} className="pill"><span className="name">{it.name}</span></div>
          ))}
        </div>
      )}

      <style jsx>{`
        .bin { display:grid; gap:10px; }
        .can { width:220px; height:220px; position:relative; cursor:pointer; }
        .box {
          position:absolute; inset:34px 12px 12px 12px; border-radius:14px;
          background: linear-gradient(180deg, color-mix(in oklab, #ef4444 24%, var(--bg2)), var(--bg2));
          border:1px solid var(--border); box-shadow: 0 14px 28px rgba(0,0,0,.12);
        }
        .lid {
          position:absolute; left:10px; right:10px; top:8px; height:28px; border-radius:10px;
          background: color-mix(in oklab, #ef4444 30%, var(--bg2));
          border:1px solid var(--border);
          transform-origin: left bottom; transition: transform .45s cubic-bezier(.19,1,.22,1);
        }
        .open .lid { transform: rotate(-20deg) translateY(-2px); }
        .shake { animation: shake .5s ease; }
        @keyframes shake { 0%{transform:rotate(0)} 25%{transform:rotate(-3deg)} 50%{transform:rotate(3deg)} 100%{transform:rotate(0)} }

        .label { font-weight:800; color:var(--text); }

        .rail {
          display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap:8px; animation: rise .3s ease both .2s; max-width:520px;
        }
        @keyframes rise { from { opacity:0; transform: translateY(6px) } to { opacity:1; transform: translateY(0) } }
        .pill { border:1px solid var(--border); background: var(--card-bg); padding:8px 10px; border-radius:12px; box-shadow: var(--shadow); }
        .name { font-weight:700; color:var(--text); }
      `}</style>
    </section>
  );
}
