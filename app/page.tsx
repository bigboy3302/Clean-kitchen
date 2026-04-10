"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuthModal } from "@/context/AuthModalContext";

const featureCards = [
  {
    title: "Recipes from what you have",
    copy: "Browse ideas, save favorites, and turn pantry ingredients into meals without blocking guests out of the app.",
    href: "/recipes",
    cta: "Browse recipes",
  },
  {
    title: "Fitness that stays attached to food",
    copy: "Explore workouts, weekly plans, and training ideas before you ever create an account.",
    href: "/fitness",
    cta: "Open fitness",
  },
  {
    title: "Pantry-first planning",
    copy: "Track ingredients, spot expiry risk, and see the system that ties your kitchen together.",
    href: "/pantry",
    cta: "View pantry",
  },
];

export default function HomePage() {
  const { openLogin, openRegister } = useAuthModal();

  return (
    <div className="home">
      <section className="hero">
        <div className="heroCopy">
          <span className="eyebrow">Clean Kitchen</span>
          <h1>Explore the app before you sign in.</h1>
          <p>
            Browse recipes, check fitness plans, and look through the product without the modal hijacking the page.
            Account creation is only required when you want to save, post, or publish.
          </p>
          <div className="heroActions">
            <button type="button" className="primaryCta" onClick={() => openRegister("/")}>
              Create account
            </button>
            <button type="button" className="secondaryCta" onClick={() => openLogin("/")}>
              Sign in
            </button>
          </div>
          <div className="quickLinks">
            <Link href="/recipes">Recipes</Link>
            <Link href="/fitness">Fitness</Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/pantry">Pantry</Link>
          </div>
        </div>

        <div className="heroArt" aria-hidden>
          <div className="logoFrame">
            <Image src="/logo.svg" alt="" width={220} height={220} priority />
          </div>
          <div className="artCard">
            <strong>Public browsing</strong>
            <span>Users can inspect the product first.</span>
          </div>
          <div className="artCard">
            <strong>Modal gating</strong>
            <span>Only restricted actions trigger auth.</span>
          </div>
        </div>
      </section>

      <section className="featureGrid">
        {featureCards.map((card) => (
          <article key={card.href} className="featureCard">
            <h2>{card.title}</h2>
            <p>{card.copy}</p>
            <Link href={card.href}>{card.cta}</Link>
          </article>
        ))}
      </section>

      <section className="ctaBand">
        <div>
          <span className="eyebrow">Restricted actions</span>
          <h2>Saving, posting, and publishing still require auth.</h2>
          <p>That keeps the app explorable while protecting state-changing actions.</p>
        </div>
        <button type="button" className="secondaryCta" onClick={() => openLogin("/")}>
          Open auth modal
        </button>
      </section>

      <style jsx>{`
        .home {
          display: grid;
          gap: 28px;
          width: min(1120px, 100%);
          margin: 0 auto;
          padding: 12px 0 24px;
        }
        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
          gap: 22px;
          align-items: stretch;
        }
        .heroCopy,
        .heroArt,
        .featureCard,
        .ctaBand {
          border: 1px solid color-mix(in oklab, var(--border) 78%, transparent);
          background:
            linear-gradient(145deg, color-mix(in oklab, var(--bg2) 96%, transparent), color-mix(in oklab, var(--bg) 94%, var(--primary) 6%));
          box-shadow: 0 22px 60px rgba(15, 23, 42, 0.08);
        }
        .heroCopy {
          border-radius: 28px;
          padding: clamp(28px, 5vw, 48px);
          display: grid;
          gap: 18px;
        }
        .eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-size: 0.75rem;
          font-weight: 800;
          color: var(--primary);
        }
        .heroCopy h1 {
          margin: 0;
          font-size: clamp(36px, 5vw, 62px);
          line-height: 0.98;
          letter-spacing: -0.04em;
        }
        .heroCopy p {
          margin: 0;
          max-width: 56ch;
          color: var(--muted);
          line-height: 1.7;
          font-size: 1rem;
        }
        .heroActions,
        .quickLinks {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .primaryCta,
        .secondaryCta,
        .featureCard :global(a),
        .quickLinks :global(a) {
          border-radius: 999px;
          font-weight: 700;
          text-decoration: none;
        }
        .primaryCta,
        .secondaryCta {
          border: 0;
          cursor: pointer;
          padding: 12px 18px;
          font: inherit;
        }
        .primaryCta {
          background: linear-gradient(135deg, #0f766e, #0f172a);
          color: #fff;
        }
        .secondaryCta {
          background: color-mix(in oklab, var(--bg2) 96%, transparent);
          color: var(--text);
          border: 1px solid color-mix(in oklab, var(--border) 85%, transparent);
        }
        .quickLinks :global(a) {
          padding: 10px 14px;
          color: var(--text);
          background: color-mix(in oklab, var(--bg2) 92%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 72%, transparent);
        }
        .heroArt {
          border-radius: 28px;
          padding: clamp(24px, 4vw, 32px);
          display: grid;
          gap: 16px;
          align-content: center;
          background:
            radial-gradient(120% 120% at 10% 10%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 55%),
            linear-gradient(155deg, color-mix(in oklab, var(--bg2) 92%, transparent), color-mix(in oklab, var(--primary) 10%, var(--bg) 90%));
        }
        .logoFrame {
          min-height: 240px;
          display: grid;
          place-items: center;
          border-radius: 24px;
          background:
            radial-gradient(circle at center, rgba(255,255,255,0.16), transparent 60%),
            linear-gradient(145deg, rgba(15, 23, 42, 0.9), rgba(15, 118, 110, 0.75));
        }
        .artCard {
          display: grid;
          gap: 4px;
          padding: 14px 16px;
          border-radius: 18px;
          background: color-mix(in oklab, var(--bg2) 94%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 72%, transparent);
        }
        .artCard span {
          color: var(--muted);
        }
        .featureGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }
        .featureCard {
          border-radius: 24px;
          padding: 22px;
          display: grid;
          gap: 12px;
        }
        .featureCard h2,
        .ctaBand h2 {
          margin: 0;
          font-size: 1.35rem;
        }
        .featureCard p,
        .ctaBand p {
          margin: 0;
          color: var(--muted);
          line-height: 1.65;
        }
        .featureCard :global(a) {
          width: fit-content;
          color: var(--text);
          padding: 10px 14px;
          border: 1px solid color-mix(in oklab, var(--border) 75%, transparent);
          background: color-mix(in oklab, var(--bg2) 94%, transparent);
        }
        .ctaBand {
          border-radius: 28px;
          padding: 24px;
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
        }
        @media (max-width: 920px) {
          .hero,
          .featureGrid {
            grid-template-columns: minmax(0, 1fr);
          }
          .ctaBand {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
