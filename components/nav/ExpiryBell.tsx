"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, Clock4 } from "lucide-react";
import clsx from "clsx";
import { useExpiringAlerts } from "@/hooks/useExpiringAlerts";

type Props = {
  className?: string;
};

export default function ExpiryBell({ className }: Props) {
  const { alerts, loading, hasAlerts, soonCount, expiredCount } = useExpiringAlerts();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [open]);

  const badgeCount = alerts.length;
  const headline = expiredCount > 0
    ? `${expiredCount} item${expiredCount === 1 ? "" : "s"} expired`
    : soonCount > 0
      ? `${soonCount} item${soonCount === 1 ? "" : "s"} expiring soon`
      : "Everything fresh";

  return (
    <div className={clsx("expiry-bell", className)} ref={wrapRef}>
      <button
        type="button"
        className={clsx("bellBtn", open && "open", hasAlerts && "hasAlerts")}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={hasAlerts ? `${headline}. View details.` : "No expiring items"}
      >
        {hasAlerts ? <Bell aria-hidden /> : <BellOff aria-hidden />}
        {badgeCount > 0 ? <span className="badge" aria-live="polite">{badgeCount}</span> : null}
      </button>

      <div className={clsx("panel", open && "open")} role="dialog" aria-modal="false">
        <header className="panelHead">
          <Clock4 size={16} strokeWidth={2} aria-hidden />
          <span>{headline}</span>
        </header>

        <div className="panelBody">
          {loading ? (
            <p className="muted">Checking your pantry...</p>
          ) : hasAlerts ? (
            <ul className="list">
              {alerts.map((alert) => (
                <li key={alert.id} className={clsx("item", alert.status)}>
                  <span className="itemName">{alert.name}</span>
                  <span className="status">
                    {alert.status === "expired"
                      ? "Expired"
                      : alert.daysDiff === 0
                        ? "Expires today"
                        : `In ${alert.daysDiff} day${alert.daysDiff === 1 ? "" : "s"}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Everything in your fridge looks good.</p>
          )}
        </div>

        <footer className="panelFoot">
          <Link href="/pantry" onClick={() => setOpen(false)}>
            Manage pantry
          </Link>
        </footer>
      </div>

      <style jsx>{`
        .expiry-bell {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .bellBtn {
          position: relative;
          width: 44px;
          height: 44px;
          border-radius: 14px;
          border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
          background: linear-gradient(180deg, color-mix(in oklab, var(--bg) 92%, transparent), var(--bg2));
          color: var(--text);
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: transform .15s ease, box-shadow .2s ease, border-color .2s ease;
        }
        .bellBtn svg { width: 20px; height: 20px; }
        .bellBtn:hover { transform: translateY(-1px); box-shadow: 0 12px 28px rgba(15,23,42,.12); }
        .bellBtn:active { transform: translateY(0); }
        .bellBtn.hasAlerts { color: var(--primary); border-color: color-mix(in oklab, var(--primary) 45%, var(--border)); }

        .badge {
          position: absolute;
          top: -6px;
          right: -4px;
          min-width: 18px;
          height: 18px;
          padding: 0 4px;
          border-radius: 999px;
          background: #ef4444;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          display: grid;
          place-items: center;
          box-shadow: 0 10px 20px rgba(239, 68, 68, 0.35);
        }

        .panel {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: min(320px, 80vw);
          border-radius: 16px;
          border: 1px solid var(--border);
          background: var(--card-bg);
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.18);
          opacity: 0;
          transform: translateY(-4px);
          pointer-events: none;
          transition: opacity .18s ease, transform .18s ease;
          display: grid;
          grid-template-rows: auto 1fr auto;
          overflow: hidden;
          z-index: 40;
        }
        .panel.open {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }
        .panelHead {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          font-weight: 700;
        }
        .panelBody {
          padding: 12px 16px;
          max-height: 220px;
          overflow-y: auto;
        }
        .muted {
          color: var(--muted);
          font-size: 13px;
          margin: 0;
        }
        .list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 10px;
        }
        .item {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: baseline;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--bg);
        }
        .item.expired {
          border-color: color-mix(in oklab, #f87171 45%, var(--border));
          background: color-mix(in oklab, #fee2e2 55%, var(--bg));
          color: #7f1d1d;
        }
        .item.soon {
          border-color: color-mix(in oklab, #facc15 40%, var(--border));
          background: color-mix(in oklab, #fef3c7 50%, var(--bg));
          color: #92400e;
        }
        .itemName {
          font-weight: 600;
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .status {
          font-size: 12px;
          font-weight: 600;
        }
        .panelFoot {
          padding: 12px 16px;
          border-top: 1px dashed var(--border);
          text-align: right;
        }
        .panelFoot a {
          font-weight: 600;
          color: var(--primary);
        }

        @media (max-width: 768px) {
          .panel {
            right: auto;
            left: 50%;
            transform: translate(-50%, -4px);
          }
          .panel.open { transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}
