"use client";
import React from "react";

type Props = React.PropsWithChildren<{
  title?: string;
  subtitle?: string;
  divider?: boolean;
  className?: string;
  headerActions?: React.ReactNode;
}>;

export default function Section({ title, subtitle, divider=false, className="", headerActions, children }: Props) {
  return (
    <>
      <section className={`sec ${className}`}>
        {(title || subtitle || headerActions) && (
          <div className="sec-head">
            <div>
              {title ? <h2 className="sec-title">{title}</h2> : null}
              {subtitle ? <p className="sec-sub">{subtitle}</p> : null}
            </div>
            {headerActions ? <div className="sec-actions">{headerActions}</div> : null}
          </div>
        )}
        {children}
        {divider ? <hr className="sec-hr" /> : null}
      </section>

      <style jsx>{`
        .sec{ padding: 16px 0 }
        .sec-head{
          display:flex; align-items:flex-end; justify-content:space-between; gap:12px;
          margin-bottom: 12px;
        }
        .sec-title{ margin: 0; font-size: 20px; line-height:1.3; font-weight:700; color:var(--text) }
        .sec-sub{ margin:6px 0 0; color: var(--muted) }
        .sec-actions{ display:flex; gap:8px; flex-wrap:wrap }
        .sec-hr{ height:1px; border:0; background:var(--border); margin:16px 0 0 }
        @media (max-width:720px){ .sec-head{ flex-direction:column; align-items:flex-start } }
      `}</style>
    </>
  );
}
