"use client";

import React from "react";
import styles from "./Modal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

export default function Modal({ open, onClose, title, children }: Props) {
  if (!open) return null;
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.box} onClick={(e) => e.stopPropagation()}>
        {title && <h3 className={styles.title}>{title}</h3>}
        <div>{children}</div>
      </div>
    </div>
  );
}
