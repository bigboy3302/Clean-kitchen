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
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:18px;
          padding:12px 0;
          margin:0 0 20px;
          border-bottom:1px solid color-mix(in oklab, var(--border) 85%, transparent);
        }
        .ph-title{
          margin:0;
          font-size:32px;
          line-height:1.18;
          font-weight:800;
          letter-spacing:-0.015em;
          color:var(--text);
        }
        .ph-sub{
          margin:8px 0 0;
          color:var(--muted);
          font-size:15px;
        }
        .ph-actions{
          display:flex;
          gap:10px;
          flex-wrap:wrap;
        }
        @media (max-width:720px){
          .ph{
            flex-direction:column;
            align-items:flex-start;
            padding:10px 0;
          }
          .ph-actions{ width:100%; justify-content:flex-start }
        }
      `}</style>
    </>
  );
}
