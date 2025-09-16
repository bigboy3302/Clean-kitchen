// components/comments/AddCommentBox.tsx
"use client";

import { useState } from "react";
import { addComment } from "@/lib/comments";

export default function AddCommentBox({ postId, uid }: { postId: string; uid: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const MAX = 25000;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await addComment({ postId, uid, text });
      setText("");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to add comment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 8 }}>
      <textarea
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        placeholder="Write a comment…"
        style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 10, padding: "8px 10px" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <small style={{ color: "#6b7280" }}>{text.length} / {MAX}</small>
        <button
          type="submit"
          disabled={busy || !text.trim()}
          style={{
            border: "1px solid #0f172a",
            background: "#0f172a",
            color: "#fff",
            borderRadius: 10,
            padding: "6px 12px",
            cursor: "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
      {err ? <p style={{ color: "#991b1b", background: "#fef2f2", border: "1px solid #fecaca", padding: 6, borderRadius: 8 }}>{err}</p> : null}
    </form>
  );
}
