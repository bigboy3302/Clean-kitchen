"use client";

import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export default function Button({ variant = "primary", size = "md", className = "", ...rest }: Props) {
  return (
    <>
      <button
        className={`btn ${variant} ${size} ${className}`}
        {...rest}
      />
      <style jsx>{`
        .btn{
          border-radius: var(--radius-button);
          cursor:pointer;
          border:1px solid var(--btn-border);
          background: var(--btn-bg);
          color: var(--btn-fg);
          transition: filter .15s, transform .02s, box-shadow .15s;
          outline: none;
        }
        .btn:hover{ filter: brightness(1.05); }
        .btn:active{ transform: translateY(1px); }
        .btn:focus-visible{ box-shadow: 0 0 0 4px color-mix(in oklab, var(--ring) 40%, transparent); }

        .primary{}
        .secondary{
          background: var(--bg2);
          color: var(--text);
          border-color: var(--border);
        }
        .secondary:hover{ filter:none; background: color-mix(in oklab, var(--bg2) 90%, var(--text) 10% / 6%); }
        :root[data-theme="dark"] .secondary:hover{ background: color-mix(in oklab, var(--bg2) 90%, #fff 10% / 6%); }

        .ghost{
          background: transparent;
          color: var(--text);
          border-color: var(--border);
        }
        .ghost:hover{ background: color-mix(in oklab, var(--bg2) 85%, var(--primary) 15% / 10%); }

        .danger{
          --btn-bg: #ef4444;
          --btn-fg: #fff;
          border-color: transparent;
        }

        .sm{ padding:6px 10px; font-size:.9rem; }
        .md{ padding:8px 14px; font-size:1rem; }
        .lg{ padding:12px 18px; font-size:1.05rem; }
      `}</style>
    </>
  );
}
