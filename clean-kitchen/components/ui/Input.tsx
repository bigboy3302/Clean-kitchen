"use client";
import React, { forwardRef, InputHTMLAttributes } from "react";
import clsx from "clsx";

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
    <div>
      {label && (
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-gray-800">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={clsx(
          "w-full rounded-xl border border-gray-300/90 bg-white px-3.5 py-2.5 text-sm",
          "placeholder:text-gray-400",
          "transition focus:border-gray-400 focus:ring-4 focus:ring-gray-900/5",
          error && "border-red-300 focus:border-red-400 focus:ring-red-200",
          className
        )}
        {...rest}
      />
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
});

export default Input;
