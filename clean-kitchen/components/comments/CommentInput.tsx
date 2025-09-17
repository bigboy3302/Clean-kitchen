// components/comments/CommentInput.tsx
"use client";

import { useState } from "react";

const MAX = 25000;

export default function CommentInput({
  disabled,
  placeholder = "Write a comment…",
  onSubmit,
}: {
  disabled?: boolean;
  placeholder?: string;
  onSubmit: (text: string) => Promise<void> | void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled || busy) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    setErr(null);
    setBusy(true);
    try {
      await onSubmit(trimmed);
      setText("");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to post comment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="cmtForm">
      <textarea
        className="ta"
        rows={4}
        value={text}
        disabled={disabled || busy}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
      />
      <div className="row">
        <small className="muted">{text.length} / {MAX}</small>
        <button className="btn" type="submit" disabled={disabled || busy || !text.trim()}>
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
      {err ? <p className="err">{err}</p> : null}

      <style jsx>{`
        .cmtForm { display:grid; gap:8px; }
        .ta {
          width:100%;
          border:1px solid #d1d5db;
          border-radius:10px;
          padding:10px;
          background:#fff;
          resize:vertical;
          white-space:pre-wrap;
          overflow-wrap:anywhere;
          word-break:break-word;
        }
        .row { display:flex; gap:8px; align-items:center; justify-content:space-between; }
        .muted { color:#6b7280; font-size:12px; }
        .btn {
          border:1px solid #0f172a; background:#0f172a; color:#fff;
          border-radius:10px; padding:6px 12px; cursor:pointer;
        }
        .btn[disabled] { opacity:.6; cursor:not-allowed; }
        .err { margin:0; background:#fef2f2; color:#991b1b; border:1px solid #fecaca; border-radius:8px; padding:6px 8px; font-size:12px; }
      `}</style>
    </form>
  );
}
