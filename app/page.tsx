"use client";

import Link from "next/link";
import { ArrowRight, ChefHat, Dumbbell, Leaf, Refrigerator, Sparkles, UtensilsCrossed } from "lucide-react";
import { useAuthModal } from "@/context/AuthModalContext";

const featureCards = [
  {
    title: "Recipes that make sense",
    copy: "Search meals, save your favourites, and build a small library of food you actually want to cook.",
    href: "/recipes",
    cta: "Browse recipes",
    Icon: ChefHat,
  },
  {
    title: "Pantry without guessing",
    copy: "Track what you have, what is expiring, and what ingredients can turn into a meal today.",
    href: "/pantry",
    cta: "Open pantry",
    Icon: Refrigerator,
  },
  {
    title: "Food and fitness together",
    copy: "Keep meals, weekly planning, and simple training goals in one place instead of jumping between apps.",
    href: "/fitness",
    cta: "View training",
    Icon: Dumbbell,
  },
];

const stats = [
  { label: "Saved recipes", value: "128", hint: "recipes ready" },
  { label: "Pantry match", value: "82%", hint: "less food waste" },
  { label: "Weekly plan", value: "7", hint: "days covered" },
];

export default function HomePage() {
  const { openLogin, openRegister } = useAuthModal();

  return (
    <div className="ck-page home-page">
      <div className="ck-page-pad">
        <section className="landing-hero">
          <div className="landing-copy">
            <p className="ck-eyebrow">Clean Kitchen</p>
            <h1 className="ck-display">
              Cook <em>smarter,</em>
              <br />
              waste less, and stay on track.
            </h1>
            <p className="ck-copy">
              Clean Kitchen helps users understand exactly what they can do: find recipes, use pantry items before they expire,
              save favourite meals, and build a weekly plan without confusion.
            </p>

            <div className="landing-actions">
              <button type="button" className="ck-btn ck-btn-primary" onClick={() => openRegister("/recipes")}>Create account</button>
              <button type="button" className="ck-btn ck-btn-soft" onClick={() => openLogin("/recipes")}>Sign in</button>
              <Link href="/dashboard" className="ck-btn ck-btn-dark">
                Explore first <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <div className="landing-showcase" aria-label="Clean Kitchen preview">
            <div className="food-orbit" aria-hidden>
              <span className="plate" />
              <span className="leaf leaf-one" />
              <span className="leaf leaf-two" />
              <span className="crumb crumb-one" />
              <span className="crumb crumb-two" />
            </div>

            <div className="showcase-title">
              <Sparkles size={20} />
              <span>What users see first</span>
            </div>

            <div className="showcase-grid">
              {stats.map((item) => (
                <article key={item.label} className="mini-stat">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.hint}</small>
                </article>
              ))}
            </div>

          </div>
        </section>

        <section className="landing-section-head">
          <p className="ck-eyebrow">Simple and clear</p>
          <h2>Users should instantly understand where to go next.</h2>
        </section>

        <section className="ck-grid-3">
          {featureCards.map(({ title, copy, href, cta, Icon }) => (
            <article key={href} className="ck-card ck-info-card landing-feature">
              <span className="feature-icon"><Icon size={24} /></span>
              <h3>{title}</h3>
              <p>{copy}</p>
              <Link href={href} className="feature-link">
                {cta} <ArrowRight size={15} />
              </Link>
            </article>
          ))}
        </section>

        <section className="landing-band ck-panel">
          <div>
            <p className="ck-eyebrow">Built around your sidebar</p>
            <h2>Same colors, same cards, same rounded premium style across every page.</h2>
            <p>The theme picker now changes the app surfaces and the sidebar because the design uses shared CSS variables.</p>
          </div>
          <Link href="/settings" className="ck-btn ck-btn-primary">
            Change theme <Leaf size={16} />
          </Link>
        </section>
      </div>

      <style jsx>{`
        .landing-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(340px, 0.95fr);
          gap: clamp(18px, 3vw, 30px);
          align-items: stretch;
        }

        .landing-copy,
        .landing-showcase {
          border-radius: var(--ck-radius-xl);
          min-height: 540px;
        }

        .landing-copy {
          padding: clamp(30px, 5vw, 58px);
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 22px;
          background:
            radial-gradient(circle at 0% 0%, color-mix(in oklab, var(--ck-accent) 15%, transparent), transparent 40%),
            color-mix(in oklab, var(--text) 90%, black 10%);
          color: color-mix(in oklab, var(--bg) 92%, white 8%);
          box-shadow: var(--ck-soft-shadow);
        }

        .landing-copy :global(.ck-display),
        .landing-copy :global(.ck-copy) {
          color: inherit;
        }

        .landing-copy :global(.ck-copy) {
          max-width: 62ch;
          opacity: .72;
        }

        .landing-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 4px;
        }

        .landing-showcase {
          position: relative;
          overflow: hidden;
          padding: clamp(24px, 4vw, 36px);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          gap: 18px;
          background:
            radial-gradient(circle at 80% 8%, color-mix(in oklab, var(--ck-accent) 18%, transparent), transparent 30%),
            linear-gradient(145deg, var(--ck-card), color-mix(in oklab, var(--ck-page-surface) 78%, var(--ck-accent) 22%));
          box-shadow: var(--ck-soft-shadow);
        }

        .food-orbit {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .plate {
          position: absolute;
          right: -50px;
          top: -45px;
          width: 220px;
          height: 220px;
          border-radius: 999px;
          border: 28px solid color-mix(in oklab, var(--ck-page-surface) 85%, white 15%);
          box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--border) 65%, transparent), 0 22px 60px rgba(0,0,0,.10);
        }

        .leaf,
        .crumb {
          position: absolute;
          display: block;
        }

        .leaf {
          width: 42px;
          height: 18px;
          border-radius: 100% 0 100% 0;
          background: color-mix(in oklab, var(--ck-accent) 62%, #5f8e3a 38%);
        }
        .leaf-one { right: 124px; top: 114px; transform: rotate(-24deg); }
        .leaf-two { right: 58px; top: 170px; transform: rotate(28deg); }
        .crumb { width: 7px; height: 7px; border-radius: 999px; background: color-mix(in oklab, var(--text) 70%, #8a5a2b 30%); }
        .crumb-one { right: 174px; top: 174px; }
        .crumb-two { right: 210px; top: 138px; width: 4px; height: 4px; }

        .showcase-title {
          position: relative;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          width: fit-content;
          border-radius: 999px;
          padding: 10px 13px;
          background: color-mix(in oklab, var(--ck-accent) 12%, transparent);
          color: var(--text);
          font-weight: 900;
        }

        .showcase-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }

        .mini-stat {
          min-height: 148px;
          border-radius: 24px;
          padding: 18px;
          display: grid;
          align-content: end;
          gap: 6px;
          background: color-mix(in oklab, var(--bg-raised) 90%, white 10%);
          box-shadow: var(--ck-card-shadow);
        }
        .mini-stat span { color: var(--muted); font-size: 13px; font-weight: 800; }
        .mini-stat strong { color: var(--text); font-family: Georgia, 'Times New Roman', serif; font-size: 46px; letter-spacing: -.08em; line-height: .9; }
        .mini-stat small { color: var(--muted); font-weight: 700; }


        .landing-section-head {
          margin: 34px 0 18px;
          display: grid;
          gap: 8px;
        }
        .landing-section-head h2 {
          margin: 0;
          max-width: 760px;
          color: var(--text);
          font-size: clamp(30px, 4vw, 48px);
          letter-spacing: -.065em;
          line-height: 1;
        }
        .feature-icon { width: 56px; height: 56px; border-radius: 999px; display: grid; place-items: center; color: var(--ck-accent); background: color-mix(in oklab, var(--ck-accent) 14%, transparent); }
        .feature-link { width: fit-content; display: inline-flex; align-items: center; gap: 8px; margin-top: 6px; color: var(--text); font-weight: 900; text-decoration: none; }
        .feature-link:hover { color: var(--ck-accent); text-decoration: none; }

        .landing-band {
          margin-top: 22px;
          padding: clamp(22px, 3vw, 32px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }
        .landing-band h2 { margin: 8px 0; max-width: 760px; font-size: clamp(26px, 3vw, 40px); line-height: 1; letter-spacing: -.06em; color: var(--text); }
        .landing-band p:not(.ck-eyebrow) { max-width: 68ch; color: var(--muted); margin: 0; }

        @media (max-width: 980px) {
          .landing-hero { grid-template-columns: 1fr; }
          .landing-copy, .landing-showcase { min-height: auto; }
          .showcase-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 660px) {
          .landing-copy { padding: 28px 22px; }
          .landing-copy :global(.ck-display) { font-size: 46px; }
          .landing-band { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}
