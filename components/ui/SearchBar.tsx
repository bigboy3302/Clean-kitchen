
"use client";
import { useEffect, useMemo, useState } from "react";

export default function SearchBar({
  value,
  onChange,
  placeholder = "Search recipes...",
  delay = 250,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  delay?: number;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  useEffect(() => {
    const t = setTimeout(() => onChange(local), delay);
    return () => clearTimeout(t);
  }, [local, delay, onChange]);

  return (
    <div className="search">
      <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <path d="M21 21l-4.3-4.3m1.8-5.2a7 7 0 11-14 0 7 7 0 0114 0z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        aria-label="Search recipes"
        autoComplete="off"
      />
    </div>
  );
}
