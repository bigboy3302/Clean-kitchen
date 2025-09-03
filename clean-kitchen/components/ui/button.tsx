import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "rounded-2xl px-4 py-2 font-medium shadow bg-black text-white hover:opacity-90 disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
