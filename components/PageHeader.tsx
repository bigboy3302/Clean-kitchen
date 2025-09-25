"use client";
import React from "react";

type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
};

export default function PageHeader({ title, subtitle, actions, className = "" }: Props) {
  return (
    <>
      <div className={`ph ${className}`}>
        <div className="ph-txt">
          <h1 className="ph-title">{title}</h1>
          {subtitle ? <p className="ph-sub">{subtitle}</p> : null}
        </div>
        {actions ? <div className="ph-actions">{actions}</div> : null}
      </div>

      <style jsx>{`
        .ph{
          display:flex; align-items:flex-end; justify-content:space-between; gap:16px;
          margin: 8px 0 16px;
        }
        .ph-title{ margin:0; font-size:32px; line-height:1.2; font-weight:800; color:var(--text) }
        .ph-sub{ margin:6px 0 0; color:var(--muted) }
        .ph-actions{ display:flex; gap:8px; flex-wrap:wrap }
        @media (max-width:720px){
          .ph{ align-items:flex-start; flex-direction:column }
          .ph-actions{ width:100% }
        }
      `}</style>
    </>
  );
}
