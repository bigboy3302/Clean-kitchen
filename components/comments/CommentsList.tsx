"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebas1e";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  deleteDoc,
  doc,
} from "firebase/firestore";

type AuthorLite = {
  displayName?: string | null;
  username?: string | null;
  avatarURL?: string | null;
};

type TimestampLike =
  | { seconds?: number; toDate?: () => Date }
  | number
  | string
  | Date
  | null;

type C = {
  id: string;
  uid: string;
  text: string;
  createdAt?: TimestampLike;
  author?: AuthorLite | null;
};

function secondsFromTimestamp(ts?: TimestampLike): number {
  if (ts == null) return 0;
  if (typeof ts === "number") return ts;
  if (ts instanceof Date) return Math.floor(ts.getTime() / 1000);
  if (typeof ts === "string") {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
  }
  if (typeof ts === "object") {
    if (typeof ts.seconds === "number") return ts.seconds;
    if (typeof ts.toDate === "function") {
      try {
        return Math.floor(ts.toDate().getTime() / 1000);
      } catch {
        return 0;
      }
    }
  }
  return 0;
}

function timeAgo(createdAt?: TimestampLike) {
  const sec = secondsFromTimestamp(createdAt);
  if (!sec) return "";
  const diff = Math.max(1, Math.floor(Date.now() / 1000 - sec));
  const steps: [number, string][] = [
    [60, "s"],
    [60, "m"],
    [24, "h"],
    [7, "d"],
    [4.345, "w"],
    [12, "mo"],
    [Number.MAX_SAFE_INTEGER, "y"],
  ];
  let value = diff;
  let index = 0;
  for (; index < steps.length - 1 && value >= steps[index][0]; index++) {
    value = Math.floor(value / steps[index][0]);
  }
  return `${value}${steps[index][1]}`;
}

function normalizeComment(id: string, data: unknown): C {
  const base = (typeof data === "object" && data !== null ? data : {}) as Partial<C>;
  return {
    id,
    uid: typeof base.uid === "string" ? base.uid : "",
    text: typeof base.text === "string" ? base.text : "",
    createdAt: base.createdAt ?? null,
    author: base.author ?? null,
  };
}

export default function CommentsList({
  postId,
  meUid,
  postOwnerUid,
  initialLimit = 7,
}: {
  postId: string;
  meUid?: string | null;
  postOwnerUid?: string | null;
  initialLimit?: number;
}) {
  const [items, setItems] = useState<C[]>([]);
  const [limit, setLimit] = useState(initialLimit);

  useEffect(() => {
    if (!postId) return;
    const q = query(
      collection(db, "posts", postId, "comments"),
      orderBy("createdAt", "asc")
    );
    const stop = onSnapshot(q, (snap) => {
      const mapped = snap.docs.map((d) => normalizeComment(d.id, d.data()));
      setItems(mapped);
    });
    return () => stop();
  }, [postId]);

  const canSeeMore = useMemo(() => items.length > limit, [items, limit]);
  const list = useMemo(() => items.slice(0, limit), [items, limit]);

  async function onDeleteComment(c: C) {
    if (!meUid) return;
    const canDelete = meUid === c.uid || (!!postOwnerUid && meUid === postOwnerUid);
    if (!canDelete) return;
    await deleteDoc(doc(db, "posts", postId, "comments", c.id));
  }

  if (!items.length) return null;

  return (
    <div className="cWrap">
      <ul className="cList">
        {list.map((c) => {
          const name =
            c?.author?.displayName ||
            c?.author?.username ||
            (c.uid ? `@${c.uid.slice(0, 6)}` : "user");
          const canDelete = meUid === c.uid || (postOwnerUid && meUid === postOwnerUid);

          return (
            <li key={c.id} className="cItem">
              <div className="cTop">
                <span className="cName">{name}</span>
                <span className="cDot" aria-hidden="true">•</span>
                <span className="cTime">{timeAgo(c.createdAt)}</span>
                {canDelete && (
                  <button className="cDel" onClick={() => onDeleteComment(c)}>
                    Delete
                  </button>
                )}
              </div>
              <div className="cBubble">
                <p className="cText">{c.text}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {canSeeMore && (
        <button className="showMore" onClick={() => setLimit((n) => n + 7)}>
          Show more comments
        </button>
      )}

      <style jsx>{`
        .cWrap { padding: 0 12px 12px; }
        .cList{ list-style:none; padding:0; margin:0; display:grid; gap:8px }
        .cItem{}
        .cTop{ display:flex; align-items:center; gap:8px; font-size:12px; color:var(--muted) }
        .cName{ font-weight:700; color: var(--text) }
        .cDot{ opacity:.6 }
        .cTime{ }
        .cDel{
          margin-left:auto;
          background:transparent; border:0; color:#e11d48; font-weight:700; cursor:pointer; padding:2px 6px; border-radius:8px;
        }
        .cDel:hover{ background: rgba(225, 29, 72, .08) }

        .cBubble{ background:var(--card-bg); border:1px solid var(--border); border-radius:12px; padding:8px 10px }
        .cText{ margin:0; white-space:pre-wrap; word-break:break-word; color:var(--text) }

        .showMore{
          margin-top:10px; border:1px solid var(--border); background:var(--bg);
          color:var(--text); padding:8px 12px; border-radius:10px; cursor:pointer;
        }
        .showMore:hover{ background: rgba(2,6,23,.06) }
        :root[data-theme="dark"] .showMore:hover{ background: rgba(255,255,255,.08) }
      `}</style>
    </div>
  );
}


