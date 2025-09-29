
"use client";

import { useState } from "react";
import { addComment } from "@/lib/comments";

export default function AddCommentBox({ pId, uid }: { pId: string; uid: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const MAX = 25000;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) { setErr("Please sign in to comment."); return; }
    const trimmed = text.trim();
    if (!trimmed) return;

    setErr(null);
    setBusy(true);
    try {
      await addComment({ postId: pId, uid, text: trimmed });
      setText("");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to add comment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="cmtForm">
      <label className="visuallyHidden" htmlFor="cmt">Write a comment</label>
      <textarea
        id="cmt"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        placeholder="Write a reply…"
        className="cmtInput"
      />

      <div className="cmtRow">
        <small className="muted count">{text.length} / {MAX}</small>
        <button
          className="btn"
          type="submit"
          disabled={busy || !uid || !text.trim()}
          aria-disabled={busy || !uid || !text.trim()}
        >
          {busy ? "Posting…" : "Post"}
        </button>
      </div>

      {err && <p className="error">{err}</p>}

      <style jsx>{`
        .cmtForm { display:grid; gap:10px; }

        /* Accessible, theme-aware textarea */
        .cmtInput {
          -webkit-appearance: none;
          appearance: none;
          background: var(--bg2);
          color: var(--text);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px 14px;
          line-height: 1.5;
          min-height: 120px;
          resize: vertical;

          white-space: pre-wrap;
          overflow-wrap: anywhere;
          word-break: break-word;

          transition: border-color .12s ease, box-shadow .12s ease, background .12s ease;
        }
        .cmtInput::placeholder { color: var(--muted); }
        .cmtInput:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 25%, transparent);
        }

        .cmtRow {
          display: flex;
          align-items: center;
          gap: 12px;
          justify-content: flex-end;
        }
        .count { margin-right: auto; } /* count on left, button on right */
        .muted { color: var(--muted); font-size: 12px; }

        .btn {
          border: 1px solid var(--primary);
          background: var(--primary);
          color: var(--primary-contrast);
          border-radius: 12px;
          padding: 8px 14px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity .12s ease, transform .05s ease;
        }
        .btn:hover { opacity: .95; }
        .btn:active { transform: translateY(1px); }
        .btn[disabled] { opacity: .6; cursor: not-allowed; }

        .error {
          color: color-mix(in oklab, #7f1d1d 70%, var(--text) 30%);
          background: color-mix(in oklab, #ef4444 15%, var(--card-bg));
          border: 1px solid color-mix(in oklab, #ef4444 35%, var(--border));
          padding: 8px 10px;
          border-radius: 10px;
          font-size: 12px;
        }

        /* a11y-only label */
        .visuallyHidden {
          position: absolute !important;
          height: 1px; width: 1px;
          overflow: hidden; clip: rect(1px, 1px, 1px, 1px);
          white-space: nowrap; border: 0; padding: 0; margin: -1px;
        }
      `}</style>
    </form>
  );
}
