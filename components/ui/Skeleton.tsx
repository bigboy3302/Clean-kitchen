"use client";
import React from "react";

type Props = {
  width?: number | string;
  height?: number | string;
  rounded?: number | string;
  className?: string;
  style?: React.CSSProperties;
};

export default function Skeleton({ width="100%", height=14, rounded=8, className="", style }: Props) {
  return (
    <>
      <span
        className={`skel ${className}`}
        style={{ width, height, borderRadius: typeof rounded === "number" ? `${rounded}px` : rounded, ...style }}
        aria-hidden
      />
      <style jsx>{`
        .skel{
          display:inline-block;
          background: linear-gradient(90deg, rgba(148,163,184,.15), rgba(148,163,184,.28), rgba(148,163,184,.15));
          background-size: 200% 100%;
          animation: shimmer 1.2s infinite;
        }
        @keyframes shimmer {
          0% { background-position: 0% 0% }
          100% { background-position: -200% 0% }
        }
        :root[data-theme="dark"] .skel{
          background: linear-gradient(90deg, rgba(148,163,184,.12), rgba(148,163,184,.22), rgba(148,163,184,.12));
        }
      `}</style>
    </>
  );
}
