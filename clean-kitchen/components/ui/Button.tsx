"use client";
import React, { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "sm";

type Props = {
  variant?: Variant;
  size?: Size;
  className?: string;
  full?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const variants: Record<Variant, string> = {
  primary:   "bg-gray-900 text-white hover:opacity-95 disabled:opacity-50",
  secondary: "border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50",
  ghost:     "text-gray-700 hover:bg-gray-100 disabled:opacity-50",
};
const sizes: Record<Size, string> = {
  md: "px-4 py-2.5 text-sm rounded-xl",
  sm: "px-3 py-2 text-sm rounded-lg",
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", className, full = true, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={clsx(
        "font-medium transition shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-900/10",
        variants[variant],
        sizes[size],
        full && "w-full",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

export default Button;
