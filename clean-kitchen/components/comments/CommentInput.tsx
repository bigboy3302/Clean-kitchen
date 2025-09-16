"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export default function CommentInput({
  postId,
  onPosted,
  maxChars = 25000,
}: {
  postId: string;
  onPosted?: () => void;
  maxChars?: number;
}) {
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const user = auth.currentUser;

  async function submit() {
    if (!user) return;
    const text = val.trim();
    if (!text) return;
    setBusy(true);
    try {
      const author = {
        displayName: user.displayName || null,
        username: user.email?.split("@")[0] || null,
        avatarURL: user.photoURL || null,
      };
      await addDoc(collection(db, "posts", postId, "comments"), {
        uid: user.uid,
        text: text.slice(0, maxChars),
        createdAt: serverTimestamp(),
        author,
      });
      setVal("");
      onPosted?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="comment-input">
      <textarea
        rows={3}
        placeholder="Write a reply…"
        value={val}
        onChange={(e) => setVal(e.target.value.slice(0, maxChars))}
        className="comment-ta"
      />
      <div className="comment-input-bar">
        <span className="comment-count">
          {val.length}/{maxChars}
        </span>
        <button
          className="btn-base btn--sm btn--primary"
          onClick={submit}
          disabled={busy || !val.trim()}
          type="button"
        >
          {busy ? "Posting…" : "Reply"}
        </button>
      </div>
    </div>
  );
}
