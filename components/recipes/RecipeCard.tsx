"use client";

import { useEffect, useMemo, useState } from "react";

export type IngredientObj = { name: string; measure?: string | null };
type PanelPlacement = "push" | "overlay-left" | "overlay-right";

export type RecipeCardProps = {
  title: string;
  imageUrl: string;
  description?: string;
  ingredients?: IngredientObj[];
  steps?: string[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  panelPlacement: PanelPlacement;
  minutes?: number | null;
  baseServings?: number | null;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  editHref?: string;
};

function parseNumber(txt: string): number | null {
  const t = txt.trim();
  if (!t) return null;
  const parts = t.split(/\s+/);
  let total = 0;
  for (const p of parts) {
    if (/^\d+(\.\d+)?$/.test(p)) total += parseFloat(p);
    else if (/^\d+\/\d+$/.test(p)) {
      const [a, b] = p.split("/").map(Number);
      if (b) total += a / b;
    }
  }
  return total > 0 ? total : null;
}

function splitMeasure(m?: string | null) {
  if (!m) return { value: null as number | null, unit: "" };
  const match = m.match(/^\s*([0-9.\s/]+)\s*(.*)$/);
  if (!match) return { value: null, unit: (m || "").trim() };
  const value = parseNumber(match[1] || "");
  const unit = (match[2] || "").trim();
  return { value, unit };
}

function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Math.abs(r - Math.round(r)) < 1e-9 ? String(Math.round(r)) : String(r);
}

export default function RecipeCard({
  title,
  imageUrl,
  description,
  ingredients = [],
  steps = [],
  open,
  onOpen,
  onClose,
  panelPlacement,
  minutes = null,
  baseServings = 2,
  isFavorite = false,
  onToggleFavorite,
  editHref,
}: RecipeCardProps) {
  const [servings, setServings] = useState<number>(Math.max(1, baseServings || 2));
  const [tab, setTab] = useState<"ingredients" | "preparation">("ingredients");

  const factor = useMemo(() => {
    const base = baseServings && baseServings > 0 ? baseServings : 2;
    return servings / base;
  }, [servings, baseServings]);

  const scaled = useMemo(() => {
    return ingredients.map((ing) => {
      const raw = ing.measure || "";
      const { value, unit } = splitMeasure(raw);
      const measure = value != null ? `${fmt(value * factor)} ${unit}`.trim() : raw.trim();
      return { name: ing.name, measure };
    });
  }, [ingredients, factor]);

  const dec = () => setServings((s) => Math.max(1, s - 1));
  const inc = () => setServings((s) => Math.min(99, s + 1));

  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    if (!isMobile) return;

    const bodyStyle = document.body.style;
    const htmlStyle = document.documentElement.style;

    const prev = {
      bodyOverflow: bodyStyle.overflow,
      bodyTouch: bodyStyle.touchAction,
      bodyOverscroll: bodyStyle.overscrollBehavior,
      bodyPosition: bodyStyle.position,
      bodyWidth: bodyStyle.width,
      htmlOverflow: htmlStyle.overflow,
      htmlOverscroll: htmlStyle.overscrollBehavior,
      htmlTouch: htmlStyle.touchAction,
    };

    bodyStyle.overflow = "hidden";
    bodyStyle.touchAction = "none";
    bodyStyle.overscrollBehavior = "contain";
    bodyStyle.position = "relative";
    bodyStyle.width = "100%";
    htmlStyle.overflow = "hidden";
    htmlStyle.overscrollBehavior = "contain";
    htmlStyle.touchAction = "none";

    return () => {
      bodyStyle.overflow = prev.bodyOverflow;
      bodyStyle.touchAction = prev.bodyTouch;
      bodyStyle.overscrollBehavior = prev.bodyOverscroll;
      bodyStyle.position = prev.bodyPosition;
      bodyStyle.width = prev.bodyWidth;
      htmlStyle.overflow = prev.htmlOverflow;
      htmlStyle.overscrollBehavior = prev.htmlOverscroll;
      htmlStyle.touchAction = prev.htmlTouch;
    };
  }, [open]);

  return (
    <div className={`rk-card ${open ? "open" : ""} ${panelPlacement}`}>
      <div
        className="photo"
        onClick={() => (open ? onClose() : onOpen())}
        role="button"
        aria-label={open ? "Close details" : "Open details"}
      >
        <img src={imageUrl} alt={title} className="img" />
        <div className="chips">
          {typeof minutes === "number" && (
            <div className="pill">
              <h3>{minutes}</h3>
              <span>MINS</span>
            </div>
          )}
          <div className="pill">
            <h3>{servings}</h3>
            <span>SERVINGS</span>
          </div>
        </div>

        <div className="details">
          <h3 className="t">{title}</h3>
          {description ? <p className="d">{description}</p> : null}
        </div>
      </div>

      {open && (
        <button className="closeMobile" onClick={onClose} type="button" aria-label="Close recipe details">
          <span aria-hidden>X</span>
        </button>
      )}

      {open && (
        <aside className={`panel ${panelPlacement}`} aria-hidden={!open}>

          <div className="tabs" role="tablist" aria-label="Recipe sections">
            <button
              role="tab"
              aria-selected={tab === "ingredients"}
              className={`tab ${tab === "ingredients" ? "active" : ""}`}
              onClick={() => setTab("ingredients")}
            >
              INGREDIENTS
            </button>
            <button
              role="tab"
              aria-selected={tab === "preparation"}
              className={`tab ${tab === "preparation" ? "active" : ""}`}
              onClick={() => setTab("preparation")}
            >
              PREPARATION
            </button>
          </div>

          <div className="content">

            <div className="servingsRow">
              <label>Servings</label>
              <div className="svCtrls">
                <button type="button" className="svBtn" onClick={dec} aria-label="Decrease servings">
                  -
                </button>
                <input
                  className="svInput"
                  type="number"
                  min={1}
                  max={99}
                  value={servings}
                  onChange={(e) =>
                    setServings(Math.max(1, Math.min(99, Number(e.currentTarget.value) || 1)))
                  }
                />
                <button type="button" className="svBtn" onClick={inc} aria-label="Increase servings">
                  +
                </button>
              </div>

              <div className="actionCluster">
                <button
                  type="button"
                  aria-pressed={isFavorite}
                  title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                  className={`favBtn ${isFavorite ? "on" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite?.();
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 21s-6-4.35-8.4-8.11C1.43 10.12 2.68 6.5 6 6.5c2 0 3.09 1.36 3.78 2.44.18.28.26.4.22.4s.04-.12.22-.4C10.91 7.86 12 6.5 14 6.5c3.32 0 4.57 3.62 2.4 6.39C18 16.65 12 21 12 21z"
                      fill="currentColor"
                    />
                  </svg>
                  <span>{isFavorite ? "Saved" : "Favorite"}</span>
                </button>

                {editHref ? (
                  <a href={editHref} className="editBtn" onClick={(e) => e.stopPropagation()}>
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12.78 5.22l6 6L8.5 21.5H2.5v-6z" fill="currentColor" />
                      <path
                        d="M17.81 3.31a2.25 2.25 0 0 1 3.18 3.18l-1.3 1.3-3.18-3.18 1.3-1.3z"
                        fill="currentColor"
                      />
                    </svg>
                    <span>Edit recipe</span>
                  </a>
                ) : null}
              </div>
            </div>

            {tab === "ingredients" ? (
              <div className="col">
                <p className="step">INGREDIENTS</p>
                <div className="text">
                  {scaled.length ? (
                    <ul className="ul">
                      {scaled.map((it, i) => (
                        <li key={i}>
                          <strong>{it.name}</strong>
                          {it.measure ? `  ${it.measure}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No ingredients</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="col">
                <p className="step">PREPARATION</p>
                <div className="text">
                  {steps.length ? (
                    <ol className="ol">
                      {steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  ) : (
                    <p className="muted">No steps yet</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <button className="toggle" onClick={onClose} type="button" aria-label="Close details">
            <span className="chev">×</span>
          </button>
        </aside>
      )}

      <style jsx>{`
        .rk-card {
          position: relative;
          height: 440px;
          display: flex;
          align-items: stretch;
          overflow: visible;
        }

        .photo {
          width: 300px;
          height: 440px;
          border-radius: 10px;
          overflow: hidden;
          background: #eee;
          box-shadow: 1px 1px 20px -5px rgba(0, 0, 0, 0.5);
          cursor: pointer;
          position: relative;
          flex: 0 0 300px;
        }
        .img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.8s ease;
        }
        .rk-card:hover .img {
          transform: scale(1.06);
        }

        .chips {
          position: absolute;
          left: 0;
          top: 0;
          display: flex;
          gap: 8px;
          padding: 16px;
          z-index: 1;
        }
        .pill {
          width: 60px;
          height: 60px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: rgba(159, 229, 53, 0.85);
          text-align: center;
          box-shadow: 0 6px 16px rgba(122, 82, 82, 0.18);
        }
        .pill h3 {
          margin: 0;
          font-size: 22px;
          line-height: 1;
          margin-top: 2px;
        }
        .pill span {
          font-size: 9px;
          font-weight: 800;
          margin-top: -6px;
        }

        .details {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          padding: 14px;
          background: linear-gradient(
            to bottom,
            rgba(239, 231, 231, 0) 0%,
            rgba(218, 160, 160, 0.65) 68%,
            rgba(200, 168, 168, 0.65) 100%
          );
          min-height: 120px;
          color: #fff;
        }
        .t {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
        }
        .d {
          margin: 6px 0 0;
          font-size: 13px;
          line-height: 1.35;
          opacity: 0.92;
        }

        .panel {
          height: 400px;
          border-radius: 10px;
          background: linear-gradient(135deg, #fbf9f9 28%, #e8eaed 100%);
          border: 1px solid rgba(169, 129, 129, 0.06);
          box-shadow: 1px 1px 20px -5px rgba(164, 153, 153, 0.2);
        }
        .panel.push {
          position: relative;
          margin-left: 10px;
          width: 320px;
          display: flex;
          flex-direction: column;
        }
        .panel.overlay-right {
          position: absolute;
          top: 0;
          left: 310px;
          width: 320px;
          display: flex;
          flex-direction: column;
        }
        .panel.overlay-left {
          position: absolute;
          top: 0;
          left: -350px;
          width: 320px;
          display: flex;
          flex-direction: column;
        }

        .tabs {
          height: 60px;
          display: flex;
          border-bottom: 3px solid #ededef;
          background: #f4f4f6;
        }
        .tab {
          flex: 1;
          padding: 15px 0;
          text-align: center;
          font-weight: 800;
          color: #9a96a4;
          border-top: 7px solid rgba(218, 120, 149, 0);
          background: #fff;
          cursor: pointer;
          transition: 0.2s;
        }
        .tab.active {
          color: #241c3e;
          border-top-color: #ed346c;
        }
        .tab:hover {
          color: #241c3e;
        }

        .content {
          padding: 10px 0;
          height: calc(100% - 60px);
          overflow: auto;
        }

        .servingsRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 20px;
          margin-bottom: 12px;
          position: sticky;
          top: 0;
          z-index: 5;
          background: linear-gradient(
            180deg,
            rgba(248, 250, 252, 0.96) 0%,
            rgba(241, 245, 249, 0.86) 100%
          );
          border-bottom: 1px solid rgba(148, 163, 184, 0.25);
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.12);
          flex-wrap: wrap;
        }
        .servingsRow label {
          font-weight: 800;
          color: #36354e;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-size: 12px;
        }

        .svCtrls {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .svBtn {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: 0;
          cursor: pointer;
          background: #ed2460;
          color: #fff;
          font-weight: 800;
          line-height: 1;
        }
        .svInput {
          width: 52px;
          text-align: center;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 6px 8px;
          background: #fff;
        }

        .actionCluster {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .favBtn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 6px 12px;
          background: var(--bg2);
          color: var(--text);
          font-weight: 700;
          cursor: pointer;
          transition: 0.2s transform, 0.2s background, 0.2s border-color;
        }
        .favBtn svg {
          width: 16px;
          height: 16px;
        }
        .favBtn:hover {
          transform: translateY(-1px);
        }
        .favBtn.on {
          background: #fde68a;
          border-color: #f59e0b;
        }

        .editBtn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 8px 18px;
          background: var(--primary);
          color: var(--primary-contrast);
          font-weight: 700;
          text-decoration: none;
          border: 1px solid var(--primary);
          transition: 0.15s transform, 0.2s filter, 0.2s box-shadow;
        }
        .editBtn:hover {
          transform: translateY(-1px);
          filter: brightness(1.04);
          box-shadow: 0 14px 30px rgba(37, 99, 235, 0.18);
        }

        .col {
          padding: 0 20px 8px 20px;
          text-align: left;
        }
        .step {
          font-weight: 800;
          font-size: 14px;
          color: #36354e;
          margin: 10px 0 6px;
        }
        .text {
          border-left: 2px solid #e3e3e3;
          padding: 10px 16px;
          color: #565656;
          font-size: 13px;
        }
        .ul {
          margin: 0;
          padding-left: 16px;
          display: grid;
          gap: 6px;
        }
        .ol {
          margin: 0;
          padding-left: 18px;
          display: grid;
          gap: 8px;
        }
        .muted {
          opacity: 0.6;
        }

        .toggle {
          position: absolute;
          right: -15px;
          top: 50%;
          transform: translateY(-50%);
          width: 30px;
          height: 30px;
          border-radius: 999px;
          border: 0;
          cursor: pointer;
          background: #ed2460;
          color: #fff;
          box-shadow: 0 0 20px -2px rgba(237, 36, 96, 1);
          display: grid;
          place-items: center;
        }
        .chev {
          display: inline-block;
          font-size: 16px;
        }

        .closeMobile {
          display: none;
        }

        @media (max-width: 820px) {
          .rk-card {
            height: auto;
            flex-direction: column;
            gap: 16px;
          }
          .photo {
            width: 100%;
            flex: none;
            height: 360px;
            max-width: none;
          }
          .panel {
            width: 100%;
            height: auto;
            min-height: 0;
          }
          .panel.push,
          .panel.overlay-right,
          .panel.overlay-left {
            position: relative;
            left: auto;
            top: auto;
            margin-left: 0;
          }
          .content {
            max-height: none;
          }
        }

        @media (max-width: 640px) {
          .rk-card {
            position: relative;
            padding: 22px 20px 28px;
            border-radius: 28px;
            background: linear-gradient(
                160deg,
                rgba(255, 255, 255, 0.82) 0%,
                rgba(245, 244, 255, 0.7) 40%,
                rgba(223, 229, 255, 0.6) 100%
              )
              var(--card-bg);
            border: 1px solid color-mix(in oklab, var(--border) 68%, transparent);
            box-shadow: 0 26px 46px rgba(15, 23, 42, 0.18);
            overflow: hidden;
          }
          .rk-card::before {
            content: "";
            position: absolute;
            inset: -34% 36% auto -32%;
            height: 150px;
            background: radial-gradient(
              130px 130px at center,
              rgba(96, 165, 250, 0.45),
              transparent 70%
            );
            opacity: 0.82;
            pointer-events: none;
            filter: blur(0.5px);
          }
          .rk-card::after {
            content: "";
            position: absolute;
            inset: auto -30% -55% 38%;
            height: 190px;
            background: radial-gradient(
              150px 150px at center,
              rgba(244, 114, 182, 0.38),
              transparent 74%
            );
            pointer-events: none;
            opacity: 0.88;
            filter: blur(0.5px);
          }
          .photo {
            width: 100%;
            height: 240px;
            border-radius: 24px;
            box-shadow: 0 22px 38px rgba(15, 23, 42, 0.28);
            overflow: hidden;
            z-index: 1;
          }
          .photo::after {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(
              180deg,
              rgba(15, 23, 42, 0) 42%,
              rgba(15, 23, 42, 0.78) 100%
            );
            z-index: 0;
          }
          .chips {
            top: auto;
            bottom: 22px;
            right: 22px;
            left: auto;
            flex-direction: column;
            gap: 12px;
            z-index: 2;
          }
          .pill {
            width: 62px;
            height: 62px;
            background: linear-gradient(135deg, rgba(236, 72, 153, 0.92), rgba(59, 130, 246, 0.92));
            color: #fff;
            box-shadow: 0 14px 32px rgba(236, 72, 153, 0.3);
          }
          .pill span {
            font-size: 10px;
            letter-spacing: 0.18em;
          }
          .details {
            z-index: 1;
            padding: 20px;
            background: linear-gradient(180deg, rgba(15, 23, 42, 0.05) 0%, rgba(15, 23, 42, 0.72) 100%);
            border-radius: 0 0 24px 24px;
          }
          .details .t {
            font-size: 22px;
            letter-spacing: -0.01em;
          }
          .details .d {
            opacity: 0.9;
            font-size: 14px;
          }

          .rk-card.open {
            position: fixed;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 32px 18px 40px;
            background: radial-gradient(circle at top, rgba(96, 165, 250, 0.38), transparent 68%) rgba(7, 12, 22, 0.94);
            backdrop-filter: blur(18px);
            overflow: hidden;
            height: 100vh;
            z-index: 3500;
          }
          .rk-card.open::before,
          .rk-card.open::after {
            opacity: 0;
          }
          .rk-card.open .photo {
            width: clamp(280px, 88vw, 420px);
            height: min(320px, 45vh);
            border-radius: 28px;
            box-shadow: 0 34px 68px rgba(0, 0, 0, 0.36);
            transform: translateY(4px);
            transition: transform 0.4s ease;
          }
          .rk-card.open .chips {
            padding: 16px;
          }
          .rk-card.open .pill {
            width: 66px;
            height: 66px;
            font-size: 24px;
            box-shadow: 0 18px 40px rgba(236, 72, 153, 0.34);
          }
          .rk-card.open .details {
            min-height: 132px;
            padding: 22px 24px;
            border-radius: 0 0 28px 28px;
            background: linear-gradient(180deg, rgba(15, 23, 42, 0.12) 0%, rgba(15, 23, 42, 0.82) 100%);
          }
          .rk-card.open .panel {
            margin-top: 24px;
            width: clamp(300px, 92vw, 460px);
            background: transparent;
            border-radius: 34px;
            border: 0;
            box-shadow: none;
            padding: 0;
            flex: 1 1 auto;
            min-height: 0;
            max-height: calc(100vh - 200px);
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .rk-card.open .tabs {
            margin: 0 24px 18px;
            border-radius: 24px;
            overflow: hidden;
            background: linear-gradient(90deg, rgba(255, 255, 255, 0.88), rgba(240, 249, 255, 0.82));
            border: 1px solid rgba(148, 163, 184, 0.28);
            padding: 6px;
            gap: 6px;
            flex: 0 0 auto;
          }
          .rk-card.open .tab {
            font-size: 12px;
            letter-spacing: 0.22em;
            border-radius: 16px;
            background: transparent;
            color: #475569;
            border: 0;
            padding: 12px 0;
          }
          .rk-card.open .tab.active {
            color: #0f172a;
            background: rgba(226, 232, 240, 0.92);
            box-shadow: 0 1px 8px rgba(148, 163, 184, 0.18) inset;
          }
          .rk-card.open .content {
            flex: 1 1 0;
            min-height: 0;
            padding: 32px 28px 38px;
            background: linear-gradient(
              185deg,
              rgba(248, 250, 252, 0.97) 0%,
              rgba(226, 232, 240, 0.92) 70%,
              rgba(241, 245, 249, 0.99) 100%
            );
            border-radius: 30px;
            box-shadow: 0 32px 72px rgba(15, 23, 42, 0.32);
            display: flex;
            flex-direction: column;
            gap: 22px;
            overflow-y: auto;
          }
          .rk-card.open .content::-webkit-scrollbar {
            width: 6px;
          }
          .rk-card.open .content::-webkit-scrollbar-thumb {
            background: rgba(148, 163, 184, 0.45);
            border-radius: 999px;
          }
          .rk-card.open .servingsRow {
            display: flex;
            flex-wrap: wrap;
            gap: 18px;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            min-height: 64px;
            position: sticky;
            top: 0;
            z-index: 5;
            padding: 16px 0;
            margin-bottom: 8px;
            background: linear-gradient(
              180deg,
              rgba(248, 250, 252, 0.98) 0%,
              rgba(241, 245, 249, 0.86) 100%
            );
            backdrop-filter: blur(8px);
            border-bottom: 1px solid rgba(148, 163, 184, 0.25);
            box-shadow: 0 12px 22px rgba(15, 23, 42, 0.12);
          }
          .rk-card.open .actionCluster {
            display: flex;
            align-items: center;
            gap: 14px;
            margin-left: auto;
            flex-wrap: wrap;
          }
          .rk-card.open .editBtn {
            padding: 10px 18px;
            border-radius: 999px;
            border: 1px solid var(--border);
            background: var(--primary);
            color: var(--primary-contrast);
            display: inline-flex;
            gap: 8px;
            align-items: center;
            text-decoration: none;
            font-weight: 700;
            transition: transform 0.12s ease, filter 0.18s ease;
          }
          .rk-card.open .editBtn:hover {
            filter: brightness(1.05);
          }
          .rk-card.open .editBtn:active {
            transform: translateY(1px);
          }
          .rk-card.open .servingsRow label {
            font-weight: 700;
            font-size: 0.9rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #475569;
          }
          .rk-card.open .col {
            margin: 0;
            padding: 0;
            background: transparent;
            border-radius: 0;
            box-shadow: none;
            width: 100%;
          }
          .rk-card.open .step {
            padding: 0 0 10px;
            margin: 0;
            font-size: 13px;
            letter-spacing: 0.24em;
            color: #0f172a;
            opacity: 0.72;
          }
          .rk-card.open .text {
            font-size: 14px;
            border-left: 0;
            border-radius: 0;
            padding: 0;
            background: transparent;
            color: #1e293b;
            box-shadow: none;
            word-break: break-word;
            white-space: pre-wrap;
          }
          .rk-card.open .ul,
          .rk-card.open .ol {
            padding-left: 20px;
          }
          .toggle {
            display: none;
          }
          .closeMobile {
            display: grid;
            place-items: center;
            position: fixed;
            top: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 999px;
            border: 1px solid rgba(248, 250, 252, 0.55);
            background: linear-gradient(135deg, rgba(244, 63, 94, 0.95), rgba(249, 115, 22, 0.95));
            color: #fff;
            font-size: 28px;
            line-height: 1;
            box-shadow: 0 22px 38px rgba(244, 63, 94, 0.36);
            cursor: pointer;
            z-index: 3600;
            transition: transform 0.18s ease, box-shadow 0.18s ease;
          }
          .closeMobile:hover {
            transform: translateY(-2px);
            box-shadow: 0 26px 42px rgba(244, 63, 94, 0.42);
          }
          .rk-card.open .svCtrls {
            flex: 0 0 auto;
          }
          .rk-card.open .actionCluster {
            flex: 1 1 auto;
            justify-content: flex-end;
          }
          .rk-card.open .servingsRow {
            flex-direction: column;
            align-items: stretch;
            gap: 14px;
            padding: 14px 0 12px;
          }
          .rk-card.open .actionCluster {
            width: 100%;
            margin-left: 0;
            justify-content: flex-start;
            gap: 12px;
          }
          .rk-card.open .editBtn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
