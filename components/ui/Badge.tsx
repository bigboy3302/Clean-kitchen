"use client";
import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...rest
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <>
      <button
        className={`btn ${variant} ${size} ${isDisabled ? "disabled" : ""} ${className}`}
        disabled={isDisabled}
        {...rest}
      >
        {loading ? (
          <span className="dot" aria-hidden />
        ) : null}
        <span className="lbl">{children}</span>
      </button>

      <style jsx>{`
        .btn{
          border-radius:12px; cursor:pointer; border:1px solid transparent;
          transition: transform .06s ease, box-shadow .15s ease, background .15s ease, opacity .15s ease;
          display:inline-flex; align-items:center; justify-content:center; gap:8px;
          font-weight:700;
          padding: 0; /* size sets padding */
        }
        .btn:active{ transform: translateY(1px) }
        .btn.disabled{ opacity:.6; cursor:not-allowed }

        /* sizes */
        .sm{ padding:6px 10px; font-size:.9rem }
        .md{ padding:8px 14px; font-size:1rem }
        .lg{ padding:12px 18px; font-size:1.05rem }

        /* variants */
        .primary{ background: var(--primary); color: var(--primary-contrast) }
        .primary:hover{ filter: brightness(1.05) }

        .secondary{ background: var(--bg-raised); color: var(--text); border-color: var(--border) }
        .secondary:hover{ background: rgba(2,6,23,.06) }
        :root[data-theme="dark"] .secondary:hover{ background: rgba(255,255,255,.06) }

        .ghost{ background: transparent; color: var(--text); border-color: var(--border) }
        .ghost:hover{ background: rgba(2,6,23,.06) }
        :root[data-theme="dark"] .ghost:hover{ background: rgba(255,255,255,.06) }

        .danger{ background:#e11d48; color:#fff }
        .danger:hover{ filter: brightness(.95) }

        /* loading dot */
        .dot{
          width:10px; height:10px; border-radius:999px; display:inline-block;
          background: currentColor; opacity:.9; animation: pulse .9s infinite ease-in-out alternate;
        }
        @keyframes pulse { from { transform: scale(.7); opacity:.6 } to { transform: scale(1); opacity:1 } }
      `}</style>
    </>
  );
}
