"use client";

import { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
  errorBanner?: ReactNode;
};

export default function AuthShell({ title, subtitle, footer, children, errorBanner }: Props) {
  return (
    <main className="authShell">
      <div className="authShell__backdrop" aria-hidden />

      <section className="authShell__panel">
        <aside className="authShell__brand">
          <div className="authShell__brandTop">
            <span className="authShell__badge">Clean Kitchen</span>
            <h2 className="authShell__brandTitle">
              Cook smarter.
              <br />
              Waste less.
            </h2>
            <p className="authShell__brandCopy">
              Plan meals, track your pantry, and keep nutrition on target with a single dashboard built
              for modern home cooks.
            </p>
          </div>
          <ul className="authShell__brandList">
            <li>Real-time pantry and expiry tracking</li>
            <li>Recipes curated from ingredients you already have</li>
            <li>Personalised fitness and nutrition insights</li>
          </ul>
          <p className="authShell__brandFoot">Join thousands making kitchen routines effortless.</p>
        </aside>

        <div className="authShell__form">
          <div className="authShell__card">
            <header className="authShell__header">
              <h1>{title}</h1>
              {subtitle ? <p className="authShell__subtitle">{subtitle}</p> : null}
            </header>

            <div className="authShell__body">{children}</div>

            {footer ? <footer className="authShell__footer">{footer}</footer> : null}
          </div>

          {errorBanner ? <div className="authShell__banner">{errorBanner}</div> : null}
        </div>
      </section>

      <style jsx>{`
        .authShell {
          position: relative;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(28px, 6vw, 80px) clamp(18px, 5vw, 64px);
          background:
            radial-gradient(1100px 620px at 18% -5%, rgba(37, 99, 235, 0.25), transparent 65%),
            radial-gradient(900px 560px at 82% 110%, rgba(14, 165, 233, 0.18), transparent 70%),
            linear-gradient(180deg, #020617 0%, #0a1020 55%, #0f172a 100%);
          overflow: hidden;
        }

        .authShell__backdrop {
          position: absolute;
          inset: -40%;
          background:
            conic-gradient(from 180deg at 50% 50%, rgba(59, 130, 246, 0.25), rgba(59, 130, 246, 0) 60%),
            radial-gradient(60% 60% at 75% 20%, rgba(14, 165, 233, 0.25), transparent),
            radial-gradient(55% 55% at 20% 80%, rgba(52, 211, 153, 0.18), transparent);
          filter: blur(120px);
          opacity: 0.75;
          pointer-events: none;
        }

        .authShell__panel {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
          width: min(980px, 100%);
          border-radius: 32px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background:
            radial-gradient(140% 140% at 15% 10%, rgba(37, 99, 235, 0.28), transparent 55%),
            linear-gradient(135deg, rgba(10, 16, 32, 0.95) 0%, rgba(8, 13, 28, 0.92) 48%, rgba(8, 11, 23, 0.9) 100%);
          box-shadow:
            0 48px 140px rgba(15, 23, 42, 0.55),
            0 12px 40px rgba(59, 130, 246, 0.25);
          overflow: hidden;
          backdrop-filter: blur(16px);
          isolation: isolate;
        }

        .authShell__brand {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 32px;
          background:
            radial-gradient(90% 110% at 20% 10%, rgba(59, 130, 246, 0.38), transparent 60%),
            linear-gradient(140deg, rgba(11, 25, 54, 0.95) 0%, rgba(23, 63, 133, 0.9) 45%, rgba(40, 96, 178, 0.88) 100%);
          color: #f8fafc;
          padding: clamp(32px, 6vw, 68px);
        }

        .authShell__brand::after {
          content: "";
          position: absolute;
          inset: 12%;
          background: radial-gradient(circle at 22% 22%, rgba(255, 255, 255, 0.28), transparent 65%);
          filter: blur(30px);
          opacity: 0.7;
          pointer-events: none;
        }

        .authShell__brandTop {
          position: relative;
          display: grid;
          gap: 20px;
        }

        .authShell__badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.22);
          border: 1px solid rgba(255, 255, 255, 0.35);
          font-weight: 600;
          font-size: 0.75rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          width: fit-content;
          backdrop-filter: blur(6px);
        }

        .authShell__brandTitle {
          margin: 0;
          font-size: clamp(32px, 5vw, 46px);
          line-height: 1.05;
          font-weight: 800;
        }

        .authShell__brandCopy {
          margin: 0;
          font-size: clamp(15px, 2vw, 18px);
          line-height: 1.6;
          max-width: 36ch;
          color: rgba(248, 250, 252, 0.9);
        }

        .authShell__brandList {
          position: relative;
          display: grid;
          gap: 14px;
          margin: 0;
          padding: 0;
          list-style: none;
          color: rgba(248, 250, 252, 0.92);
        }

        .authShell__brandList li {
          position: relative;
          padding-left: 28px;
          font-weight: 600;
          font-size: 0.95rem;
          line-height: 1.4;
        }

        .authShell__brandList li::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0.45em;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background:
            radial-gradient(circle at 30% 30%, rgba(191, 219, 254, 0.95), rgba(59, 130, 246, 0.35) 70%, transparent),
            rgba(255, 255, 255, 0.18);
          box-shadow:
            0 0 12px rgba(191, 219, 254, 0.7),
            0 0 0 3px rgba(255, 255, 255, 0.15);
        }

        .authShell__brandFoot {
          position: relative;
          margin: 0;
          font-size: 0.85rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(248, 250, 252, 0.7);
        }

        .authShell__form {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 18px;
          padding: clamp(28px, 5vw, 52px);
          background: linear-gradient(150deg, rgba(6, 12, 24, 0.88), rgba(10, 16, 30, 0.85));
          color: #e2e8f0;
        }

        .authShell__form {
          --text: #e2e8f0;
          --muted: rgba(148, 163, 184, 0.85);
          --bg2: rgba(15, 23, 42, 0.65);
          --border: rgba(148, 163, 184, 0.28);
          --ring: rgba(96, 165, 250, 0.36);
          --btn-bg: linear-gradient(135deg, #60a5fa, #3b82f6);
          --btn-fg: #0b1736;
          --btn-border: rgba(59, 130, 246, 0.55);
        }

        .authShell__card {
          display: flex;
          flex-direction: column;
          gap: 24px;
          color: inherit;
        }

        .authShell__header {
          display: grid;
          gap: 12px;
        }

        .authShell__header h1 {
          margin: 0;
          font-size: clamp(26px, 3vw, 34px);
          font-weight: 800;
          color: #f8fafc;
        }

        .authShell__subtitle {
          margin: 0;
          font-size: 0.95rem;
          color: rgba(203, 213, 225, 0.88);
          line-height: 1.55;
        }

        .authShell__body {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .authShell__footer {
          margin-top: 6px;
          padding-top: 16px;
          border-top: 1px solid rgba(148, 163, 184, 0.22);
          color: rgba(203, 213, 225, 0.8);
          font-size: 0.9rem;
          text-align: center;
        }

        .authShell__banner {
          padding: 12px 18px;
          border-radius: 14px;
          background: linear-gradient(140deg, rgba(248, 113, 113, 0.22), rgba(249, 115, 22, 0.1));
          border: 1px solid rgba(248, 113, 113, 0.45);
          color: #fee2e2;
          font-size: 0.9rem;
          text-align: center;
          box-shadow:
            0 20px 60px rgba(248, 113, 113, 0.28),
            0 0 0 1px rgba(248, 113, 113, 0.25) inset;
        }

        @media (max-width: 960px) {
          .authShell__panel {
            grid-template-columns: 1fr;
            border-radius: 28px;
          }

          .authShell__brand {
            align-items: flex-start;
          }

          .authShell__brand::after {
            inset: 16%;
          }
        }

        @media (max-width: 720px) {
          .authShell {
            padding: 24px 14px 48px;
          }

          .authShell__panel {
            box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
          }

          .authShell__brand {
            padding: 26px 24px 32px;
            border-radius: 26px 26px 0 0;
          }

          .authShell__brandList {
            gap: 10px;
          }

          .authShell__brandList li {
            font-size: 0.88rem;
            padding-left: 24px;
          }

          .authShell__brandList li::before {
            width: 12px;
            height: 12px;
          }

          .authShell__form {
            padding: 24px 20px 28px;
          }

          .authShell__footer {
            text-align: left;
          }
        }

        @media (max-width: 480px) {
          .authShell__brandTitle {
            font-size: 30px;
          }

          .authShell__brandList li {
            font-size: 0.85rem;
          }

          .authShell__brandFoot {
            font-size: 0.78rem;
          }

          .authShell__banner {
            font-size: 0.85rem;
            padding: 10px 14px;
          }
        }
      `}</style>
    </main>
  );
}
