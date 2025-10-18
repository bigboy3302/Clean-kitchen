"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useState } from "react";

export default function Splash() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [go, setGo] = useState(false);

  const handleEnter = useCallback(() => {
    if (go) return;
    setGo(true);
    setTimeout(() => router.push("/auth/login"), 850);
  }, [go, router]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleEnter();
    }
  };

  return (
    <div
      className="splash"
      role="button"
      tabIndex={0}
      aria-label="Enter"
      onClick={handleEnter}
      onKeyDown={onKeyDown}
    >
      <div className="bg">
        <div className="grad" />
        {!prefersReducedMotion && (
          <div className="orbs">
            <span />
            <span />
            <span />
          </div>
        )}
        <div className="noise" />
      </div>

      <motion.div
        className="stack"
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: go ? 1.04 : 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <motion.div
          className="logoWrap"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.99 }}
          animate={{
            filter: go
              ? "drop-shadow(0 12px 40px rgba(15,23,42,0.35))"
              : "drop-shadow(0 8px 24px rgba(15,23,42,0.25))",
          }}
          transition={{ duration: 0.35 }}
        >
          <Image
            src="/logo.svg"
            alt="Clean Kitchen Logo"
            width={220}
            height={220}
            priority
          />
        </motion.div>

        <motion.h1
          className="brand"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: go ? -2 : 0 }}
          transition={{ duration: 0.45 }}
        >
          Cook with clarity. Live with intention.
        </motion.h1>

        <motion.p
          className="hint"
          initial={{ opacity: 0 }}
          animate={{ opacity: go ? 0 : 0.78 }}
          transition={{ duration: 0.4, delay: 0.12 }}
        >
          Auto-sorted pantry, smart recipes from what you have, gentle nudges to move.
          <br/>
          Tap to continue
        </motion.p>
      </motion.div>

      {!prefersReducedMotion && go && (
        <motion.div
          className="flash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45 }}
        />
      )}

      <style jsx>{`
        .splash {
          min-height: 100dvh;
          display: grid;
          place-items: center;
          position: relative;
          overflow: hidden;
          background: var(--bg);
          color: var(--text);
          cursor: pointer;
          isolation: isolate;
        }
        .bg {
          position: absolute;
          inset: 0;
          z-index: -1;
        }
        .grad {
          position: absolute;
          inset: -20%;
          background:
            radial-gradient(55% 60% at 50% 30%, rgba(14, 165, 233, 0.22), transparent 62%),
            radial-gradient(40% 40% at 80% 20%, rgba(59, 130, 246, 0.16), transparent 60%),
            radial-gradient(50% 50% at 20% 80%, rgba(16, 185, 129, 0.18), transparent 65%);
          filter: blur(50px);
        }
        .orbs {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }
        .orbs span {
          position: absolute;
          width: clamp(32vmax, 48vw, 52vmax);
          height: clamp(32vmax, 48vw, 52vmax);
          border-radius: 50%;
          filter: blur(60px);
          opacity: 0.2;
          background: conic-gradient(
            from 0deg,
            rgba(255, 255, 255, 0.2),
            rgba(255, 255, 255, 0)
          );
          animation: float 24s linear infinite;
        }
        .orbs span:nth-child(1) {
          top: -15%;
          left: -20%;
          animation-duration: 28s;
        }
        .orbs span:nth-child(2) {
          bottom: -18%;
          right: -22%;
          animation-duration: 32s;
        }
        .orbs span:nth-child(3) {
          top: 16%;
          right: -12%;
          animation-duration: 36s;
        }
        @keyframes float {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .noise {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: url("/noise.png");
          opacity: 0.06;
          mix-blend-mode: soft-light;
        }
        .stack {
          text-align: center;
          display: grid;
          gap: 12px;
          padding: 24px;
          border-radius: 28px;
          backdrop-filter: blur(18px);
          background: rgba(15, 23, 42, 0.14);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 24px 80px rgba(15, 23, 42, 0.45);
        }
        :global([data-theme="light"]) .stack {
          background: rgba(255, 255, 255, 0.32);
          border: 1px solid rgba(148, 163, 184, 0.28);
          box-shadow: 0 24px 64px rgba(148, 163, 184, 0.25);
        }
        .logoWrap {
          width: clamp(170px, 28vw, 220px);
          height: clamp(170px, 28vw, 220px);
          margin: 0 auto;
          border-radius: 32px;
          display: grid;
          place-items: center;
          transition: transform 0.3s ease;
        }
        .brand {
          margin: 0;
          font-size: clamp(32px, 6vw, 58px);
          letter-spacing: 0.36px;
          font-weight: 800;
        }
        .hint {
          margin: 6px 0 0;
          font-size: 15px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .flash {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(
            ellipse at center,
            rgba(255, 255, 255, 0.22),
            transparent 65%
          );
        }
        @media (max-width: 480px) {
          .stack {
            gap: 10px;
            padding: 20px;
          }
          .hint {
            font-size: 13px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .orbs span {
            animation: none;
          }
          .stack {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
