// components/ui/Input.tsx
"use client";
import React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & { label?: string };

export default function Input({ label, className = "", ...rest }: Props) {
  return (
    <label className={`f ${className}`}>
      {label ? <span className="lab">{label}</span> : null}
      <input className="inp" {...rest} />
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
        }
        // change the focus style line:
.inp:focus{ box-shadow: 0 0 0 3px rgba(37,99,235,.25); border-color: var(--ring); }
      `}</style>
    </label>
  );
}
