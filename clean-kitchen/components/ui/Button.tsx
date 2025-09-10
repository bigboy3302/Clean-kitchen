"use client";
import React, { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "danger" | "destructive";
type Size = "md" | "sm";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  className?: string;
  full?: boolean;
};

const variants: Record<Variant, string> = {
  primary:     "btn btnPrimary",
  secondary:   "btn btnSecondary",
  danger:      "btn btnDanger",
  destructive: "btn btnDanger",   // alias -> same style as danger
};

export default forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", className, full = true, children, type, ...rest },
  ref
) {
  // keep backward-compat if someone passes 'destructive'
  const v = (variant === "danger" ? "danger" : variant) as Variant;

  return (
    <button
      ref={ref}
      type={type ?? "button"}                 // ✅ prevents accidental form submits
      className={clsx(
        "btn-base",
        variants[v] || variants.primary,      // ✅ never undefined
        size === "sm" ? "btn--sm" : "btn--md",
        full && "btn--full",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
