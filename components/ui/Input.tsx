"use client";
import React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string };

export default function Input({ label, hint, className = "", ...rest }: Props) {
  return (
    <label className={`f ${className}`}>
      {label ? <span className="lab">{label}</span> : null}
      <input className="inp" {...rest} />
      {hint ? <span className="hint">{hint}</span> : null}
      <style jsx>{`
        .f{display:flex;flex-direction:column;gap:6px}
        .lab{font-size:.9rem;color:var(--text);opacity:.88;font-weight:600}
        .inp{
          border:1px solid var(--border);
          background:var(--bg2);
          color:var(--text);
          border-radius:12px;
          padding:10px 12px;
          outline:none;
          transition: box-shadow .15s, border-color .15s, background .2s;
        }
        .inp:hover{ background: color-mix(in oklab, var(--bg2) 92%, var(--text) 8% / 4%); }
        .inp:focus{ box-shadow: 0 0 0 4px color-mix(in oklab, var(--ring) 35%, transparent); border-color: var(--ring); background: var(--bg); }
        .hint{font-size:12px;color:var(--muted)}
      `}</style>
    </label>
  );
}
