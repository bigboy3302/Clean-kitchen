// components/ui/Card.tsx
import React from "react";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  className?: string;
  children: React.ReactNode;
};

export default function Card({ className, children, ...rest }: CardProps) {
  return (
    <div className={`card ${className || ""}`} {...rest}>
      {children}
      <style jsx>{`
        .card { border:1px solid #e5e7eb; border-radius:16px; background:#fff; padding:12px; }
      `}</style>
    </div>
  );
}
