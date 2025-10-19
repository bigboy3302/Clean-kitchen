"use client";

import React, { useMemo } from "react";
import type { Timestamp } from "firebase/firestore";
import type { NutritionInfo } from "@/lib/nutrition";

export type FridgeItem = {
  id: string;
  uid?: string;
  name: string;
  quantity: number;
  expiresAt?: TimestampLike | null;
  barcode?: string | null;
  nutrition?: NutritionInfo | null;
};

type Props = {
  items: FridgeItem[];
  isOpen: boolean;
  onToggleOpen: (open: boolean) => void;
  minimal?: boolean;
};

type StatusTone = "neutral" | "warn" | "danger" | "good";

type DisplayItem = FridgeItem & {
  expiresOn: Date | null;
  status: { label: string; tone: StatusTone };
};

const DAY_MS = 86_400_000;

type TimestampLike =
  | Timestamp
  | Date
  | { toDate?: () => Date; seconds?: number }
  | string
  | number;

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value);
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }
  if (typeof value === "object" && value !== null) {
    const candidate = value as { toDate?: () => Date; seconds?: number };
    if (typeof candidate.toDate === "function") {
      try {
        return candidate.toDate();
      } catch {
        // fall through; attempt seconds fallback
      }
    }
    if (typeof candidate.seconds === "number") {
      return new Date(candidate.seconds * 1000);
    }
  }
  return null;
}

function describeExpiry(date: Date | null): { label: string; tone: StatusTone } {
  if (!date) return { label: "No expiry date", tone: "neutral" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((date.getTime() - today.getTime()) / DAY_MS);

  if (diffDays < 0) {
    const days = Math.abs(diffDays);
    return { label: `Expired ${days === 1 ? "1 day" : `${days} days`} ago`, tone: "danger" };
  }
  if (diffDays === 0) return { label: "Expires today", tone: "warn" };
  if (diffDays <= 3) {
    return { label: `Expires in ${diffDays === 1 ? "1 day" : `${diffDays} days`}`, tone: "warn" };
  }
  const daysLeft = diffDays === 1 ? "1 day" : `${diffDays} days`;
  return { label: `Fresh for ${daysLeft}`, tone: "good" };
}

export default function Fridge({ items, isOpen, onToggleOpen }: Props) {
  const annotated = useMemo<DisplayItem[]>(() => {
    const withDates = items.map((item) => {
      const expiresOn = toDate(item.expiresAt);
      return {
        ...item,
        expiresOn,
        status: describeExpiry(expiresOn),
      };
    });
    const safeTime = (d: Date | null) => (d ? d.getTime() : Number.POSITIVE_INFINITY);
    return withDates.sort((a, b) => safeTime(a.expiresOn) - safeTime(b.expiresOn));
  }, [items]);

  const count = annotated.length;
  const label = count === 0 ? "Nothing stored" : `${count} ${count === 1 ? "item" : "items"}`;
  const preview = annotated.slice(0, 2);
  const soon = annotated.filter((it) => it.status.tone === "warn").length;
  const overdue = annotated.filter((it) => it.status.tone === "danger").length;

  return (
    <div className={`fridgeUnit ${isOpen ? "open" : "closed"}`}>
      <div className="objectWrap" aria-hidden>
        <div className="shadow" />
        <div className={`fridgeObject ${isOpen ? "swing" : ""}`}>
          <div className="door top">
            <div className="shine" />
            <div className={`handle ${isOpen ? "pulled" : ""}`} />
          </div>
          <div className="door bottom">
            <div className="shine" />
            <div className={`handle ${isOpen ? "pulled" : ""}`} />
          </div>
          <div className="hinge" />
          <div className={`gap ${isOpen ? "visible" : ""}`}>
            <div className="glow" />
          </div>
        </div>
      </div>

      <div className="info">
        <header>
          <div>
            <p className="eyebrow">Fridge</p>
            <h3>{label}</h3>
          </div>
          <button
            type="button"
            className="action"
            onClick={() => onToggleOpen(!isOpen)}
            aria-expanded={isOpen}
          >
            {isOpen ? "Close door" : "Open door"}
          </button>
        </header>

        <div className="chips">
          <span className="chip neutral">Total {count}</span>
          <span className={`chip ${soon > 0 ? "warn" : "good"}`}>Soon {soon}</span>
          <span className={`chip ${overdue > 0 ? "danger" : "good"}`}>Expired {overdue}</span>
        </div>

        {isOpen ? (
          <div className="preview">
            {preview.length === 0 ? (
              <p className="muted">Nothing inside yet. Add an item to keep track of it.</p>
            ) : (
              preview.map((item) => (
                <div key={item.id} className="previewRow">
                  <span className="name">{item.name}</span>
                  <span className={`badgeTone ${item.status.tone}`}>{item.status.label}</span>
                </div>
              ))
            )}
            {count > preview.length && (
              <span className="muted more">+{count - preview.length} more inside</span>
            )}
          </div>
        ) : (
          <p className="muted shutNote">Door closed – open to peek at the shelves.</p>
        )}
      </div>

      <style jsx>{`
        .fridgeUnit {
          position: relative;
          border: 1px solid var(--border);
          background: linear-gradient(180deg, color-mix(in oklab, var(--bg2) 94%, transparent), var(--bg));
          border-radius: 24px;
          padding: 18px 20px;
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
          display: grid;
          gap: 18px;
        }
        .objectWrap {
          display: grid;
          place-items: center;
          position: relative;
          padding-top: 6px;
        }
        .shadow {
          width: 70%;
          height: 14px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(15, 23, 42, 0.25), transparent 70%);
          filter: blur(6px);
          transform: translateY(116px);
        }
        .fridgeObject {
          position: relative;
          width: min(180px, 55vw);
          height: min(250px, 70vw);
          border-radius: 22px;
          background: linear-gradient(135deg, #eef2ff, #e0e7ff 45%, #c7d2fe 85%);
          border: 2px solid rgba(15, 23, 42, 0.1);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.6), 0 22px 40px rgba(15, 23, 42, 0.14);
          display: grid;
          grid-template-rows: 1fr 1fr;
          overflow: hidden;
          transition: transform 0.35s ease;
        }
        .fridgeObject.swing {
          transform: rotateY(-6deg);
        }
        .badge {
          position: absolute;
          top: 12px;
          left: 16px;
          width: 28px;
          height: 28px;
          border-radius: 10px;
          background: rgba(15, 23, 42, 0.1);
          color: #0f172a;
          font-weight: 700;
          font-size: 14px;
          display: grid;
          place-items: center;
          letter-spacing: 0.08em;
        }
        .door {
          position: relative;
          background: linear-gradient(110deg, rgba(255, 255, 255, 0.9), rgba(209, 213, 219, 0.65));
        }
        .fridgeObject.swing .door.top {
          transform: perspective(800px) rotateY(-18deg);
          transform-origin: right center;
          transition: transform 0.35s ease;
        }
        .fridgeObject.swing .door.bottom {
          transform: perspective(800px) rotateY(-12deg);
          transform-origin: right center;
          transition: transform 0.35s ease 40ms;
        }
        .door.top {
          border-bottom: 1px solid rgba(15, 23, 42, 0.12);
        }
        .door.bottom {
          border-top: 1px solid rgba(255, 255, 255, 0.35);
        }
        .shine {
          position: absolute;
          top: 12px;
          left: 12px;
          right: 24px;
          bottom: 12px;
          border-radius: 16px;
          background: linear-gradient(150deg, rgba(255, 255, 255, 0.78), transparent 65%);
          pointer-events: none;
        }
        .door.bottom .shine {
          top: 18px;
        }
        .handle {
          position: absolute;
          right: 18px;
          top: 24px;
          width: 12px;
          height: 60px;
          border-radius: 10px;
          background: linear-gradient(180deg, #f5f7fb, #c7d0de);
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06), 0 6px 12px rgba(15, 23, 42, 0.18);
          transition: transform 0.2s ease;
        }
        .door.bottom .handle {
          top: auto;
          bottom: 24px;
        }
        .handle.pulled {
          transform: translateX(-8px);
        }
        .hinge {
          position: absolute;
          left: -10px;
          top: 40px;
          width: 6px;
          height: calc(100% - 80px);
          border-radius: 6px;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.05), rgba(15, 23, 42, 0.2));
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
        }
        .gap {
          position: absolute;
          top: 0;
          right: -2px;
          bottom: 0;
          width: 8px;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .gap.visible {
          opacity: 1;
        }
        .glow {
          position: absolute;
          inset: 12px 0;
          border-radius: 10px;
          background: radial-gradient(90% 120% at 0% 50%, rgba(255, 255, 255, 0.8), transparent 70%);
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
          margin: 6px 0 0;
          font-size: 20px;
          font-weight: 800;
          color: var(--text);
        }
        .action {
          border: 0;
          border-radius: 999px;
          background: color-mix(in oklab, var(--primary) 18%, #ffffff 20%);
          color: var(--text);
          font-weight: 700;
          padding: 10px 18px;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(37, 99, 235, 0.18);
          transition: transform 0.12s ease, box-shadow 0.18s ease;
        }
        .action:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 34px rgba(37, 99, 235, 0.24);
        }
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .chip {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: var(--bg2);
        }
        .chip.warn {
          color: #92400e;
          border-color: color-mix(in oklab, #fbbf24 40%, transparent);
          background: color-mix(in oklab, #f97316 12%, #fff7ed 88%);
        }
        .chip.danger {
          color: #7f1d1d;
          border-color: color-mix(in oklab, #ef4444 40%, transparent);
          background: color-mix(in oklab, #ef4444 12%, #fef2f2 88%);
        }
        .chip.good {
          color: #047857;
          border-color: color-mix(in oklab, #34d399 40%, transparent);
          background: color-mix(in oklab, #22c55e 12%, #ecfdf5 88%);
        }
        .preview {
          display: grid;
          gap: 10px;
        }
        .previewRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 8px 12px;
          background: var(--bg);
        }
        .name {
          font-weight: 700;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .badgeTone {
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 700;
          border: 1px solid transparent;
        }
        .badgeTone.neutral {
          background: var(--bg2);
          color: var(--muted);
          border-color: var(--border);
        }
        .badgeTone.warn {
          background: color-mix(in oklab, #fbbf24 25%, var(--bg));
          border-color: color-mix(in oklab, #f59e0b 40%, transparent);
          color: #92400e;
        }
        .badgeTone.danger {
          background: color-mix(in oklab, #f87171 25%, var(--bg));
          border-color: color-mix(in oklab, #ef4444 40%, transparent);
          color: #7f1d1d;
        }
        .badgeTone.good {
          background: color-mix(in oklab, #34d399 20%, var(--bg));
          border-color: color-mix(in oklab, #059669 40%, transparent);
          color: #065f46;
        }
        .shutNote {
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px dashed var(--border);
          background: color-mix(in oklab, var(--bg2) 90%, var(--bg));
        }
        .muted {
          color: var(--muted);
          font-size: 13px;
          margin: 0;
        }
        .more {
          font-weight: 600;
        }

        @media (max-width: 640px) {
          .fridgeUnit {
            padding: 16px;
          }
          .fridgeObject {
            width: min(160px, 65vw);
            height: min(220px, 80vw);
          }
          .action {
            padding: 9px 16px;
          }
        }
      `}</style>
    </div>
  );
}
