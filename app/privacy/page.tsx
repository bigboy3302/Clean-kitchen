 "use client";

export default function PrivacyPage() {
  return (
    <div className="legalPage">
      <div className="card">
        <span className="eyebrow">Legal</span>
        <h1>Privacy Policy</h1>
        <p>
          We respect your privacy and only use your information to provide and improve the Clean Kitchen experience.
        </p>

        <section>
          <h2>Information we collect</h2>
          <p>
            We may collect account details, profile information, saved recipes, pantry data, meal plans, and usage data
            needed to operate the platform.
          </p>
        </section>

        <section>
          <h2>How we use information</h2>
          <p>
            We use your data to provide app features, personalise your experience, improve performance, and support your
            account.
          </p>
        </section>

        <section>
          <h2>Data sharing</h2>
          <p>
            We do not sell your personal data. We may use trusted service providers only where necessary to operate the
            service.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            For privacy questions, contact:{" "}
            <a href="mailto:adriansraitums95@gmail.com">adriansraitums95@gmail.com</a>
          </p>
        </section>
      </div>

      <style jsx>{`
        .legalPage {
          width: min(900px, 100%);
          margin: 0 auto;
          padding: 28px 24px 40px;
        }
        .card {
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
        h1 {
          margin: 0 0 12px;
        }
        section {
          margin-top: 20px;
        }
        @media (max-width: 768px) {
          .legalPage {
            padding: 20px 16px 28px;
          }
          .card {
            padding: 22px;
            border-radius: 20px;
          }
        }
      `}</style>
    </div>
  );
}
