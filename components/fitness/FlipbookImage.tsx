"use client";

import { useState, useEffect } from "react";

type Props = {
  src0: string;
  src1?: string | null;
  alt: string;
  className?: string;
  intervalMs?: number;
};

export default function FlipbookImage({ src0, src1, alt, className, intervalMs = 1400 }: Props) {
  const [frame, setFrame] = useState(0);
  const [ready0, setReady0] = useState(false);
  const [ready1, setReady1] = useState(false);
  const [err0, setErr0] = useState(false);
  const [err1, setErr1] = useState(false);

  const canAnimate = !!src1 && !err1 && ready0 && ready1;

  useEffect(() => {
    if (!canAnimate) return;
    const id = setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), intervalMs);
    return () => clearInterval(id);
  }, [canAnimate, intervalMs]);

  if (err0) {
    return (
      <div className={`flipWrap ${className ?? ""}`}>
        <div className="flipPlaceholder">
          <span>{alt.charAt(0).toUpperCase()}</span>
        </div>
        <style jsx>{`
          .flipWrap { width: 100%; height: 100%; }
          .flipPlaceholder {
            width: 100%; height: 100%;
            display: flex; align-items: center; justify-content: center;
            background: color-mix(in oklab, var(--bg) 80%, #111 20%);
            font-size: 3rem; font-weight: 900; color: var(--muted);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`flipWrap ${className ?? ""}`}>
      {canAnimate && (
        <span className="animBadge">
          <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
            <circle cx="4" cy="4" r="4" fill="currentColor" />
          </svg>
          Animated
        </span>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src0}
        alt={alt}
        className={`flipFrame ${frame === 0 || !canAnimate ? "visible" : "hidden"}`}
        onLoad={() => setReady0(true)}
        onError={() => setErr0(true)}
        draggable={false}
      />

      {src1 && !err1 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src1}
          alt={alt}
          className={`flipFrame ${frame === 1 && canAnimate ? "visible" : "hidden"}`}
          onLoad={() => setReady1(true)}
          onError={() => setErr1(true)}
          draggable={false}
        />
      )}

      <style jsx>{`
        .flipWrap {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
        .flipFrame {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          transition: opacity 0.25s ease;
        }
        .flipFrame.visible { opacity: 1; }
        .flipFrame.hidden  { opacity: 0; }
        .animBadge {
          position: absolute;
          top: 12px;
          left: 12px;
          z-index: 2;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 9px;
          border-radius: 999px;
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #fff;
          background: rgba(0,0,0,0.42);
          backdrop-filter: blur(6px);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
