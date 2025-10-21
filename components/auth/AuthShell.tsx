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
            radial-gradient(1100px 620px at 18% -5%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 65%),
            radial-gradient(900px 560px at 82% 110%, color-mix(in oklab, var(--ring) 36%, transparent), transparent 70%),
            linear-gradient(180deg, color-mix(in oklab, var(--bg) 92%, var(--primary) 8%), var(--bg));
          overflow: hidden;
        }

        .authShell__backdrop {
          position: absolute;
          inset: -40%;
          background:
            conic-gradient(from 180deg at 50% 50%, color-mix(in oklab, var(--primary) 28%, transparent), transparent 60%),
            radial-gradient(60% 60% at 75% 20%, color-mix(in oklab, var(--ring) 32%, transparent), transparent),
            radial-gradient(55% 55% at 20% 80%, color-mix(in oklab, var(--primary) 18%, transparent), transparent);
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
          border: 1px solid color-mix(in oklab, var(--border) 75%, transparent);
          background:
            radial-gradient(140% 140% at 15% 10%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 55%),
            linear-gradient(135deg, color-mix(in oklab, var(--bg2) 96%, var(--bg) 4%), color-mix(in oklab, var(--bg2) 88%, var(--primary) 12%));
          box-shadow:
            0 48px 140px color-mix(in oklab, rgba(0, 0, 0, 0.7) 35%, transparent),
            0 12px 40px color-mix(in oklab, var(--primary) 18%, transparent);
          overflow: hidden;
          backdrop-filter: blur(16px);
          isolation: isolate;
          color: var(--text);
        }

        .authShell__brand {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 32px;
          background:
            radial-gradient(90% 110% at 20% 10%, color-mix(in oklab, var(--primary) 38%, transparent), transparent 60%),
            linear-gradient(140deg, color-mix(in oklab, var(--primary) 28%, var(--bg2) 72%), color-mix(in oklab, var(--primary) 46%, var(--bg2) 54%));
          color: var(--primary-contrast);
          padding: clamp(32px, 6vw, 68px);
        }

        .authShell__brand::after {
          content: "";
          position: absolute;
          inset: 12%;
          background: radial-gradient(circle at 22% 22%, color-mix(in oklab, var(--primary-contrast) 32%, transparent), transparent 65%);
          filter: blur(30px);
          opacity: 0.55;
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
          background: color-mix(in oklab, var(--primary-contrast) 20%, transparent);
          border: 1px solid color-mix(in oklab, var(--primary-contrast) 35%, transparent);
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
          color: color-mix(in oklab, var(--primary-contrast) 88%, transparent);
        }

        .authShell__brandList {
          position: relative;
          display: grid;
          gap: 14px;
          margin: 0;
          padding: 0;
          list-style: none;
          color: color-mix(in oklab, var(--primary-contrast) 92%, transparent);
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
          border-radius: 999px;
          background: color-mix(in oklab, var(--primary-contrast) 38%, transparent);
          box-shadow:
            0 0 0 3px color-mix(in oklab, var(--primary-contrast) 16%, transparent),
            0 0 12px color-mix(in oklab, var(--primary-contrast) 24%, transparent);
        }

        .authShell__brandFoot {
          position: relative;
          margin: 0;
          font-size: 0.85rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: color-mix(in oklab, var(--primary-contrast) 72%, transparent);
        }

        .authShell__form {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 18px;
          padding: clamp(28px, 5vw, 52px);
          background: linear-gradient(150deg, color-mix(in oklab, var(--bg2) 92%, transparent), color-mix(in oklab, var(--bg2) 80%, var(--primary) 20%));
          color: var(--text);
          --text: var(--text);
          --muted: color-mix(in oklab, var(--muted) 86%, transparent);
          --bg2: color-mix(in oklab, var(--bg2) 96%, transparent);
          --border: color-mix(in oklab, var(--border) 82%, transparent);
          --ring: color-mix(in oklab, var(--ring) 92%, transparent);
          --btn-bg: color-mix(in oklab, var(--primary) 92%, transparent);
          --btn-fg: var(--primary-contrast);
          --btn-border: transparent;
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
          color: var(--text);
        }

        .authShell__subtitle {
          margin: 0;
          font-size: 0.95rem;
          color: var(--muted);
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
          border-top: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
          color: var(--muted);
          font-size: 0.9rem;
          text-align: center;
        }

        .authShell__banner {
          padding: 12px 18px;
          border-radius: 14px;
          background: linear-gradient(140deg, color-mix(in oklab, var(--primary) 18%, transparent), color-mix(in oklab, var(--ring) 22%, transparent));
          border: 1px solid color-mix(in oklab, var(--primary) 38%, transparent);
          color: color-mix(in oklab, var(--primary-contrast) 90%, transparent);
          font-size: 0.9rem;
          text-align: center;
          box-shadow:
            0 20px 60px color-mix(in oklab, var(--primary) 28%, transparent),
            0 0 0 1px color-mix(in oklab, var(--primary) 24%, transparent) inset;
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
            box-shadow: 0 24px 60px color-mix(in oklab, rgba(0, 0, 0, 0.7) 22%, transparent);
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
