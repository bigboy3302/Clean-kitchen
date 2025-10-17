
"use client";
import React from "react";

export default function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <>
      <section className={`card ${className}`}>{children}</section>
      <style jsx>{`
        .card{
          border:1px solid var(--card-border);
          background: var(--card-bg);
          border-radius: var(--radius-card);
          padding:16px;
          box-shadow: 0 10px 30px rgba(0,0,0,.04);
        }
        :root[data-theme="dark"] .card{
          box-shadow: 0 12px 24px rgba(0,0,0,.25);
        }
      `}</style>
    </>
  );
}
