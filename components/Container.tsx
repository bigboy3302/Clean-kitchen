"use client";
import React from "react";

export default function Container({
  className = "",
  children,
  as: Tag = "div",
}: React.PropsWithChildren<{ className?: string; as?: keyof JSX.IntrinsicElements }>) {
  return (
    <>
      <Tag className={`ck-container ${className}`}>{children}</Tag>
      <style jsx>{`
        .ck-container{
          max-width: var(--container);
          margin: 0 auto;
          padding: 24px 16px;
        }
      `}</style>
    </>
  );
}
