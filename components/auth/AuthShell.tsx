"use client";
import React, { ReactNode } from "react";
import styles from "./AuthShell.module.css";

type Props = {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
};

export default function AuthShell({ title, subtitle, footer, children }: Props) {
  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <header className={styles.header}>
          <h1>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </header>

        <div className={styles.body}>{children}</div>

        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </main>
  );
}
