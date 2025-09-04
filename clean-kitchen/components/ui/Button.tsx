"use client";
import React, { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

type Props = {
  variant?: Variant;
  size?: Size;
  className?: string;
  full?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const variants: Record<Variant, string> = {
  primary:   "btn btnPrimary",
  secondary: "btn btnSecondary",
  ghost:     "btn btnGhost",
  danger:    "btn btnDanger",
};

export default forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", className, full = true, children, ...rest },
  ref
) {
  // map "danger" -> "destructive" (keeps old usages working)
  const resolved = variant === "danger" ? "destructive" : variant;

  return (
    <button
      ref={ref}
      className={clsx(
        "btn-base",
        variants[resolved as keyof typeof variants],
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
