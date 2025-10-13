"use client";

import React, { useMemo } from "react";

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
  const summary = useMemo(() => {
    const totalQuantity = items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
    return {
      totalQuantity,
      preview: items.slice(0, 3),
    };
  }, [items]);

  const count = items.length;
  const headline = count === 0 ? "Trash is empty" : `${count} ${count === 1 ? "item" : "items"} tossed`;
  const quantityLabel = `${summary.totalQuantity} ${summary.totalQuantity === 1 ? "unit" : "units"}`;

  return (
    <div className={`trashUnit ${isOpen ? "open" : "closed"}`}>
      <div className="objectWrap" aria-hidden>
        <div className="shadow" />
        <div className={`bin ${isOpen ? "tilt" : ""}`}>
          <div className="lid">
            <div className="shine" />
            <div className={`hinge ${isOpen ? "raised" : ""}`} />
          </div>
          <div className="binBody">
            <div className="lip" />
            <div className="texture" />
            
          </div>
          <div className={`pedal ${isOpen ? "pressed" : ""}`} />
        </div>
      </div>

      <div className="info">
        <header>
          <div>
            <p className="eyebrow">Trash can</p>
            <h3>{headline}</h3>
            <p className="muted">{quantityLabel} removed</p>
          </div>
          <button type="button" className="action" onClick={() => onToggleOpen(!isOpen)} aria-expanded={isOpen}>
            {isOpen ? "Close lid" : "Open lid"}
          </button>
        </header>

        {isOpen ? (
          <div className="preview">
            {summary.preview.length === 0 ? (
              <p className="muted success">You&apos;re all caught up – nothing spoiled.</p>
            ) : (
              summary.preview.map((item, idx) => (
                <div key={item.id} className="previewRow">
                  <span className="dot" aria-hidden>{idx + 1}</span>
                  <span className="name">{item.name}</span>
                  <span className="pill">Qty {item.quantity}</span>
                </div>
              ))
            )}
            {count > summary.preview.length && (
              <span className="muted more">+{count - summary.preview.length} more to clear</span>
            )}
          </div>
        ) : (
          <p className="muted shutNote">Lid closed – open to see tossed items.</p>
        )}
      </div>

      <style jsx>{`
        .trashUnit {
          position: relative;
          border: 1px solid var(--border);
          background: linear-gradient(180deg, color-mix(in oklab, var(--bg2) 94%, transparent), var(--bg));
          border-radius: 24px;
          padding: 18px 20px;
          box-shadow: 0 18px 36px rgba(15, 23, 42, 0.08);
          display: grid;
          gap: 18px;
        }
        .objectWrap {
          display: grid;
          place-items: center;
          padding-top: 6px;
        }
        .shadow {
          width: 68%;
          height: 12px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(15, 23, 42, 0.25), transparent 70%);
          filter: blur(6px);
          transform: translateY(90px);
        }
        .bin {
          position: relative;
          width: min(150px, 52vw);
          height: min(200px, 70vw);
          display: grid;
          grid-template-rows: 44px 1fr 24px;
          justify-items: center;
          transition: transform 0.35s ease;
        }
        .bin.tilt {
          transform: translateY(-4px) rotateX(4deg);
        }
        .lid {
          position: relative;
          width: 100%;
          height: 44px;
          border-radius: 22px 22px 0 0;
          background: linear-gradient(135deg, #f1f5f9, #e2e8f0 45%, #cbd5f5 90%);
          border: 2px solid rgba(15, 23, 42, 0.1);
          border-bottom: 0;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.6), 0 16px 24px rgba(15, 23, 42, 0.18);
        }
        .hinge {
          position: absolute;
          left: 24px;
          right: 24px;
          bottom: -6px;
          height: 10px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.2), rgba(15, 23, 42, 0.05));
          transform-origin: center;
          transition: transform 0.25s ease;
        }
        .hinge.raised {
          transform: translateY(-6px);
        }
        .shine {
          position: absolute;
          inset: 6px 18px 8px 12px;
          border-radius: 18px;
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.85), transparent 70%);
        }
        .binBody {
          position: relative;
          width: 84%;
          height: 100%;
          border-radius: 0 0 26px 26px;
          background: linear-gradient(160deg, #f8fafc, #dbeafe 45%, #c7d2fe 85%);
          border: 2px solid rgba(15, 23, 42, 0.08);
          border-top: 0;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.55);
        }
        .lip {
          position: absolute;
          top: -10px;
          left: -8%;
          right: -8%;
          height: 14px;
          border-radius: 12px;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.2), rgba(15, 23, 42, 0.06));
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4);
        }
        .texture {
          position: absolute;
          inset: 18px 18px 28px;
          border-radius: 18px;
          background-image: linear-gradient(
            0deg,
            rgba(148, 163, 184, 0.12) 0,
            rgba(148, 163, 184, 0.12) 50%,
            transparent 50%,
            transparent 100%
          );
          background-size: 100% 16px;
          opacity: 0.45;
        }
        .badge {
          position: absolute;
          top: 20px;
          right: 16px;
          padding: 6px 10px;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.12);
          color: #0f172a;
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.08em;
        }
        .pedal {
          width: 56px;
          height: 20px;
          border-radius: 10px 10px 14px 14px;
          background: linear-gradient(180deg, #e2e8f0, #94a3b8);
          border: 2px solid rgba(15, 23, 42, 0.12);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.55), 0 6px 12px rgba(15, 23, 42, 0.18);
          transform: translateY(-10px);
          transition: transform 0.25s ease;
        }
        .pedal.pressed {
          transform: translateY(-4px);
        }

        .info {
          display: grid;
          gap: 14px;
        }
        header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .eyebrow {
          margin: 0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
        }
        h3 {
          margin: 6px 0 4px;
          font-size: 20px;
          font-weight: 800;
          color: var(--text);
        }
        .muted {
          color: var(--muted);
          font-size: 13px;
          margin: 0;
        }
        .muted.success {
          color: #047857;
          background: color-mix(in oklab, #34d399 22%, var(--bg));
          border: 1px solid color-mix(in oklab, #047857 28%, transparent);
          border-radius: 12px;
          padding: 10px 12px;
        }
        .action {
          border: 0;
          border-radius: 999px;
          background: color-mix(in oklab, #f87171 18%, #ffffff 25%);
          color: #7f1d1d;
          font-weight: 700;
          padding: 10px 18px;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(248, 113, 113, 0.25);
          transition: transform 0.12s ease, box-shadow 0.18s ease;
        }
        .action:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 32px rgba(248, 113, 113, 0.28);
        }
        .preview {
          display: grid;
          gap: 10px;
        }
        .previewRow {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 10px;
          border: 1px solid color-mix(in oklab, #ef4444 24%, var(--border));
          border-radius: 12px;
          padding: 8px 12px;
          background: color-mix(in oklab, #fee2e2 65%, var(--bg));
        }
        .dot {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 999px;
          background: color-mix(in oklab, #ef4444 18%, #fff1f1);
          color: #b91c1c;
          font-size: 12px;
          font-weight: 700;
        }
        .name {
          font-weight: 700;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          height: 26px;
          padding: 0 12px;
          border-radius: 999px;
          background: #fff5f5;
          color: #b91c1c;
          font-weight: 700;
          border: 1px solid color-mix(in oklab, #ef4444 35%, transparent);
        }
        .shutNote {
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px dashed var(--border);
          background: color-mix(in oklab, var(--bg2) 90%, var(--bg));
        }
        .more {
          font-weight: 600;
        }

        @media (max-width: 640px) {
          .trashUnit {
            padding: 16px;
          }
          .bin {
            width: min(140px, 60vw);
            height: min(190px, 78vw);
          }
          .action {
            padding: 9px 16px;
          }
        }
      `}</style>
    </div>
  );
}
