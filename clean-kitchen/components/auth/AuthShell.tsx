"use client";
import React from "react";

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center p-4 sm:p-6">
      <div className="rounded-2xl border border-gray-200/70 bg-white/70 p-6 shadow-xl shadow-gray-900/5 backdrop-blur">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
        </div>
        {children}
      </div>
      {footer && <div className="mt-4 text-center text-sm text-gray-600">{footer}</div>}
    </main>
  );
}
