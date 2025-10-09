"use client";

import * as React from "react";

type Props = {
  src?: string | null;
  alt?: string;
  size?: number;          // px
  name?: string | null;   // used for fallback initial
  className?: string;
};

export default function Avatar({ src, alt = "avatar", size = 70, name, className }: Props) {
  const initial = (name || alt || "U").trim().slice(0, 1).toUpperCase() || "U";
  return (
    <>
      <span
        className={`ui-avatar ${className || ""}`}
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
        aria-label={alt}
      >
        {src ? <img src={src} alt={alt} /> : <span className="ph">{initial}</span>}
      </span>

      <style jsx>{`
        .ui-avatar {
          display: inline-block;
          border-radius: 999px;
          overflow: hidden;
          background: #000;
          border: 1px solid var(--border);
          line-height: 0;
        }
        .ui-avatar img {
          width: 150%;
          height: 150%;
          object-fit: cover;
          display: block;
        }
        .ui-avatar .ph {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          background: var(--bg2, #0f172a);
          color: var(--text, #e5e7eb);
          font-weight: 800;
          font-size: 12px;
          user-select: none;
        }
      `}</style>
    </>
  );
}
