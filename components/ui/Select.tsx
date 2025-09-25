"use client";
import React from "react";

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string };

export default function Select({ label, className = "", children, ...rest }: Props) {
  return (
    <label className={`f ${className}`}>
      {label ? <span className="lab">{label}</span> : null}
      <div className="wrap">
        <select className="sel" {...rest}>
          {children}
        </select>
        <svg className="chev" width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      <style jsx>{`
        .f{display:flex;flex-direction:column;gap:6px}
        .lab{font-size:.9rem;color:var(--text);opacity:.88;font-weight:600}
        .wrap{position:relative}
        .sel{
          appearance:none;
          width:100%;
          border:1px solid var(--border);
          background:var(--bg2);
          color:var(--text);
          border-radius:12px;
          padding:10px 36px 10px 12px;
          outline:none;
        }
        .sel:focus{ box-shadow:0 0 0 3px rgba(37,99,235,.25); border-color: var(--ring) }
        .chev{
          position:absolute; right:10px; top:50%; transform:translateY(-50%);
          opacity:.7; pointer-events:none;
        }
        :root[data-theme="dark"] .sel{ background:#0f1629 }
      `}</style>
    </label>
  );
}
