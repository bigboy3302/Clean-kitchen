
"use client";
import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};
const VARIANT = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger", 
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
          border-radius:12px;
          cursor:pointer;
          border:1px solid var(--btn-border);
          background: var(--btn-bg);
          color: var(--btn-fg);
          transition: filter .15s, transform .02s;
        }
        .btn:hover{ filter: brightness(1.05); }
        .btn:active{ transform: translateY(1px); }

        .primary{}
        .secondary{
          background: var(--bg2);
          color: var(--text);
          border-color: var(--border);
        }
        .secondary:hover{ filter:none; background: rgba(0,0,0,.04); }
        :root[data-theme="dark"] .secondary:hover{ background: rgba(255,255,255,.06); }

        .ghost{
          background: transparent;
          color: var(--text);
          border-color: var(--border);
        }
        .ghost:hover{ background: rgba(0,0,0,.04); }
        :root[data-theme="dark"] .ghost:hover{ background: rgba(255,255,255,.06); }

        .sm{ padding:6px 10px; font-size:.9rem; }
        .md{ padding:8px 14px; font-size:1rem; }
        .lg{ padding:12px 18px; font-size:1.05rem; }
      `}</style>
    </>
  );
}
