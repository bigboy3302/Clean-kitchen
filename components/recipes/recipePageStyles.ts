export const recipePageStyles = `
  .wrap {
    max-width: 1100px;
    margin: 0 auto;
    padding: 24px 16px 80px;
    color: var(--text);
    position: relative;
  }

  .wrap:before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    background: color-mix(in oklab, var(--bg) 65%, transparent);
    opacity: 0.75;
    z-index: -1;
  }

  .strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .hint {
    color: var(--muted);
    font-size: 13px;
  }

  .card {
    border: 1px solid var(--border);
    background: var(--card-bg);
    border-radius: 16px;
    padding: 14px;
    box-shadow: var(--shadow);
  }

  .card.bad {
    border-color: #fca5a5;
    background: color-mix(in oklab, var(--card-bg) 88%, #fecaca);
    color: #7f1d1d;
  }

  .hero {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 14px;
    align-items: stretch;
  }

  @media (max-width: 900px) {
    .hero {
      grid-template-columns: 1fr;
    }
  }

  .cover {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    background: var(--bg2);
    min-height: 240px;
  }

  .coverImg {
    object-fit: cover;
  }

  .ph {
    height: 100%;
    display: grid;
    place-items: center;
    color: var(--muted);
  }

  .head {
    display: grid;
    gap: 10px;
  }

  .title {
    margin: 0;
    font-size: clamp(22px, 3vw, 30px);
    font-weight: 900;
  }

  .stack {
    display: grid;
    gap: 12px;
  }

  .grid {
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: 14px;
    margin-top: 14px;
    align-items: start;
  }

  @media (max-width: 1024px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }

  .grid-2 {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 720px) {
    .grid-2 {
      grid-template-columns: 1fr;
    }
  }

  .panel {
    position: sticky;
    top: 12px;
  }

  @media (max-width: 1024px) {
    .panel {
      position: relative;
      top: auto;
    }
  }

  .panelHead {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 900;
    margin-bottom: 10px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: var(--primary);
    box-shadow: 0 0 12px color-mix(in oklab, var(--primary) 60%, transparent);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--border);
    background: var(--bg2);
    color: var(--text);
    padding: 8px 12px;
    border-radius: 12px;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }

  .btn.primary {
    background: var(--primary);
    color: var(--primary-contrast);
    border-color: transparent;
  }

  .btn.ghost {
    background: transparent;
  }

  .muted {
    color: var(--muted);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip {
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 4px 8px;
    font-size: 12px;
    background: var(--bg2);
  }

  .ingList {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }

  .ing {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px;
    align-items: center;
  }

  .itName {
    font-weight: 600;
  }

  .itQty {
    color: var(--muted);
    font-size: 12px;
  }

  .bullet {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--text);
  }

  .h2 {
    margin: 0 0 10px;
    font-size: 18px;
    font-weight: 900;
  }

  .stepList {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 10px;
  }

  .step {
    display: grid;
    grid-template-columns: 28px 1fr;
    gap: 10px;
    align-items: start;
  }

  .num {
    width: 28px;
    height: 28px;
    border-radius: 10px;
    border: 1px solid var(--border);
    display: grid;
    place-items: center;
    font-weight: 800;
    background: var(--bg2);
  }

  .txt {
    margin: 0;
  }

  .spaced {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
  }

  .cluster {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
  }
`;
