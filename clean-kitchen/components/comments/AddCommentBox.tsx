// components/comments/AddCommentBox.tsx
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
      <textarea
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        placeholder="Write a comment…"
        className="cmtInput"
      />
      <div className="cmtRow">
        <small className="muted">{text.length} / {MAX}</small>
        <button className="btn" type="submit" disabled={busy || !uid || !text.trim()}>
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
      {err && <p className="error">{err}</p>}

      <style jsx>{`
        .cmtForm { display:grid; gap:8px; }
        .cmtInput {
          width:100%;
          border:1px solid #d1d5db;
          border-radius:10px;
          padding:8px 10px;
          resize:vertical;

          /* keep long text inside the box */
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          word-wrap: break-word;
          word-break: break-word;
        }
        .cmtRow { display:flex; align-items:center; justify-content:space-between; }
        .muted { color:#6b7280; }
        .btn {
          border:1px solid #0f172a;
          background:#0f172a; color:#fff;
          border-radius:10px; padding:6px 12px; cursor:pointer;
        }
        .btn[disabled] { opacity:.6; cursor:default; }
        .error { color:#991b1b; background:#fef2f2; border:1px solid #fecaca; padding:6px; border-radius:8px; }
      `}</style>
    </form>
  );
}
