"use client";

import { useId, useState } from "react";
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
  const countId = useId();

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
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX}
        aria-describedby={countId}
        aria-invalid={!!err}
      />
      <div className="row">
        <small id={countId} className="muted">{text.length} / {MAX}</small>
        <button
          className="btn"
          type="submit"
          disabled={disabled || busy || !text.trim()}
          aria-disabled={disabled || busy || !text.trim()}
        >
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
      {err ? (
        <p className="err" role="alert" aria-live="polite">
          {err}
        </p>
      ) : null}

      <style jsx>{`
        .cmtForm { display:grid; gap:8px; }

  /* textarea: force our theme, disable UA theming */
  .cmtInput, .ta {
    -webkit-appearance: none;
    appearance: none;
    color-scheme: light dark; /* let scrollbars, etc. match; our colors still win */
    background: var(--bg2) !important;
    color: var(--text) !important;

    width:100%;
    border:1px solid var(--border);
    border-radius:12px;
    padding:10px 12px;
    resize:vertical;

    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    transition: border-color .12s ease, box-shadow .12s ease;
  }
  .cmtInput::placeholder, .ta::placeholder { color: var(--muted); }

  .cmtInput:focus, .ta:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 25%, transparent);
  }

  .cmtRow, .row { display:flex; align-items:center; justify-content:space-between; }
  .muted { color: var(--muted); font-size:12px; }

  .btn {
    border:1px solid var(--primary);
    background: var(--primary);
    color: var(--primary-contrast);
    border-radius:10px;
    padding:6px 12px;
    cursor:pointer;
    transition: opacity .12s ease;
  }
  .btn:hover { opacity:.95; }
  .btn[disabled] { opacity:.6; cursor:not-allowed; }

  .error, .err {
    margin:0;
    color: color-mix(in oklab, #7f1d1d 70%, var(--text) 30%);
    background: color-mix(in oklab, #ef4444 15%, var(--card-bg));
    border:1px solid color-mix(in oklab, #ef4444 35%, var(--border));
    border-radius:8px;
    padding:6px 8px;
    font-size:12px;
  }
      `}</style>
    </form>
  );
}
