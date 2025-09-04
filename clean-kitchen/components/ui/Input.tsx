"use client";
import React, { forwardRef, InputHTMLAttributes } from "react";
import styles from "./Input.module.css";

type Props = {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, hint, error, className, id, ...rest },
  ref
) {
  const inputId = id || rest.name || undefined;
  return (
    <div className={`${styles.wrapper} ${className || ""}`}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`${styles.input} ${error ? styles.error : ""}`}
        {...rest}
      />
      {hint && !error && <p className={styles.hint}>{hint}</p>}
      {error && <p className={styles.errorText}>{error}</p>}
    </div>
  );
});

export default Input;
