
"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase/firebase";
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

type C = {
  id: string;
  uid: string;
  text: string;
  createdAt?: { seconds?: number } | number | null;
  author?: AuthorLite | null;
};

function timeAgo(createdAt?: C["createdAt"]) {
  if (!createdAt) return "";
  const sec =
    typeof createdAt === "number"
      ? createdAt
      : createdAt && typeof (createdAt as any).seconds === "number"
      ? (createdAt as any).seconds
      : Math.floor(Date.parse(String(createdAt)) / 1000) || 0;
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
  let v = diff,
    i = 0;
  for (; i < steps.length - 1 && v >= steps[i][0]; i++)
    v = Math.floor(v / steps[i][0]);
  return `${v}${steps[i][1]}`;
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
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
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
        return (
          <li key={c.id} className="cItem">
            <div className="cTop">
              <span className="cName">{name}</span>
              <span className="cDot">•</span>
              <span className="cTime">{timeAgo(c.createdAt)}</span>
              {(meUid === c.uid || (postOwnerUid && meUid === postOwnerUid)) && (
                <button className="cDel" onClick={() => onDeleteComment(c)}>Delete</button>
              )}
            </div>
            <div className="cBubble">
              <p className="cText">{c.text}</p>
            </div>
          </li>
        );})}
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
