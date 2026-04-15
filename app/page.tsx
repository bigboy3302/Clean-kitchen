"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuthModal } from "@/context/AuthModalContext";

const featureCards = [
  {
    title: "Cook with what you already have",
    copy: "Find recipe ideas from your pantry, then save the ones you want to make again.",
    href: "/recipes",
    cta: "Browse recipes",
  },
  {
    title: "Keep food and fitness together",
    copy: "Check workouts, weekly plans, and simple training ideas in the same place as your meals.",
    href: "/fitness",
    cta: "Open fitness",
  },
  {
    title: "Know what is in your kitchen",
    copy: "Track ingredients, catch food before it expires, and plan meals with less guessing.",
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
          <h1>Plan meals, use your pantry, and stay on track.</h1>
          <p>
            Browse recipes, check fitness plans, and see how Clean Kitchen works before you make an
            account. Sign in only when you want to save your progress or add your own content.
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
            <strong>Try it first</strong>
            <span>Look around before creating an account.</span>
          </div>
          <div className="artCard">
            <strong>Save when ready</strong>
            <span>Sign in when you want to keep something.</span>
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
          <span className="eyebrow">Your account</span>
          <h2>Create an account when you are ready to save.</h2>
          <p>Recipes, pantry items, posts, and plans stay connected to your profile.</p>
        </div>
        <button type="button" className="secondaryCta" onClick={() => openLogin("/")}>
          Sign in
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
          max-width: 12ch;
          font-size: clamp(36px, 5vw, 58px);
          line-height: 1.06;
          letter-spacing: -0.02em;
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
          .heroArt {
            display: none;
          }
          .ctaBand {
            flex-direction: column;
            align-items: flex-start;
          }
        }
        @media (max-width: 560px) {
          .home {
            gap: 18px;
            padding-top: 4px;
          }
          .heroCopy,
          .featureCard,
          .ctaBand {
            border-radius: 18px;
          }
          .heroCopy {
            padding: 24px 20px;
          }
          .heroCopy h1 {
            max-width: 100%;
            font-size: 2.35rem;
          }
          .heroActions > * {
            flex: 1 1 150px;
          }
          .quickLinks :global(a) {
            flex: 1 1 calc(50% - 8px);
            text-align: center;
          }
          .featureCard,
          .ctaBand {
            padding: 20px;
          }
        }
      `}</style>
    </div>
  );
}
