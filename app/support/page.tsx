 "use client";

import { LifeBuoy, Mail, ShieldCheck } from "lucide-react";

export default function SupportPage() {
  return (
    <div className="supportPage">
      <div className="supportCard">
        <span className="eyebrow">Support</span>
        <h1>Help &amp; Support</h1>
        <p>
          If you need help with your account, recipes, pantry, training, or meal plans, contact support directly.
        </p>

        <div className="supportGrid">
          <div className="item">
            <LifeBuoy size={18} />
            <div>
              <strong>General help</strong>
              <span>Questions about using the website</span>
            </div>
          </div>

          <div className="item">
            <ShieldCheck size={18} />
            <div>
              <strong>Privacy or account issues</strong>
              <span>Support for login, account access, and legal questions</span>
            </div>
          </div>

          <a className="item mailItem" href="mailto:adriansraitums95@gmail.com">
            <Mail size={18} />
            <div>
              <strong>Email support</strong>
              <span>adriansraitums95@gmail.com</span>
            </div>
          </a>
        </div>
      </div>

      <style jsx>{`
        .supportPage {
          width: min(900px, 100%);
          margin: 0 auto;
          padding: 28px 24px 40px;
        }

        .supportCard {
          background: var(--bg-raised);
          border: 1px solid var(--border);
          border-radius: 24px;
          box-shadow: var(--shadow);
          padding: 28px;
        }

        .eyebrow {
          display: inline-block;
          margin-bottom: 8px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--primary);
        }

        .supportGrid {
          margin-top: 22px;
          display: grid;
          gap: 14px;
        }

        .item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          border: 1px solid var(--border);
          border-radius: 16px;
          background: color-mix(in oklab, var(--bg) 84%, var(--primary) 16% / 8%);
          color: var(--text);
          text-decoration: none;
        }

        .item strong {
          display: block;
          margin-bottom: 4px;
        }

        .item span {
          color: var(--muted);
          font-size: 14px;
        }

        .mailItem:hover {
          text-decoration: none;
          border-color: color-mix(in oklab, var(--primary) 35%, var(--border));
        }

        @media (max-width: 768px) {
          .supportPage {
            padding: 20px 16px 28px;
          }
          .supportCard {
            padding: 22px;
            border-radius: 20px;
          }
        }
      `}</style>
    </div>
  );
}
