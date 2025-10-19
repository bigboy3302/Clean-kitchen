"use client";
import React, { ReactNode } from "react";
import styles from "./AuthShell.module.css";

type Props = {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
  errorBanner?: ReactNode;
};

export default function AuthShell({ title, subtitle, footer, children, errorBanner }: Props) {
  return (
    <main className={styles.shell}>
      <div className={styles.backdrop} aria-hidden />

      <section className={styles.panel}>
        <aside className={styles.brand}>
          <div className={styles.brandTop}>
            <span className={styles.badge}>Clean Kitchen</span>
            <h2 className={styles.brandTitle}>
              Cook smarter.
              <br />
              Waste less.
            </h2>
            <p className={styles.brandCopy}>
              Plan meals, track your pantry, and keep nutrition on target with a single dashboard built
              for modern home cooks.
            </p>
          </div>
          <ul className={styles.brandList}>
            <li>Real-time pantry and expiry tracking</li>
            <li>Recipes curated from ingredients you already have</li>
            <li>Personalised fitness and nutrition insights</li>
          </ul>
          <p className={styles.brandFoot}>Join thousands making kitchen routines effortless.</p>
        </aside>

        <div className={styles.form}>
          <div className={styles.card}>
            <header className={styles.header}>
              <h1>{title}</h1>
              {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </header>

            <div className={styles.body}>{children}</div>

            {footer ? <footer className={styles.footer}>{footer}</footer> : null}
          </div>

          {errorBanner ? <div className={styles.banner}>{errorBanner}</div> : null}
        </div>
      </section>
    </main>
  );
}
