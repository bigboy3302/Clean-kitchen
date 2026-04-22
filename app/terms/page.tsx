 "use client";

export default function TermsPage() {
  return (
    <div className="legalPage">
      <div className="card">
        <span className="eyebrow">Legal</span>
        <h1>Terms of Service</h1>
        <p>By using Clean Kitchen, you agree to use the platform lawfully and responsibly.</p>

        <section>
          <h2>Use of service</h2>
          <p>
            You may use the platform for personal nutrition, recipe, pantry, and meal-planning purposes. You must not
            misuse, disrupt, or attempt unauthorised access to the service.
          </p>
        </section>

        <section>
          <h2>Accounts</h2>
          <p>
            You are responsible for maintaining the security of your account and the accuracy of the information you
            provide.
          </p>
        </section>

        <section>
          <h2>Content</h2>
          <p>
            You remain responsible for any content you create or upload. We may remove content that violates platform
            rules or applicable law.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            For questions about these terms, email{" "}
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
