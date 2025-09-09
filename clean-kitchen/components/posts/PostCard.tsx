"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc, Timestamp } from "firebase/firestore";

type Post = {
  id: string;
  uid?: string;
  text?: string | null;
  imageURL?: string | null;
  createdAt?: Timestamp | { seconds: number; nanoseconds: number } | null;
  isRepost?: boolean;
  author?: {
    uid?: string | null;
    username?: string | null;
    displayName?: string | null;
    avatarURL?: string | null;
  } | null;
};

export default function PostCard({ post }: { post: Post }) {
  const [authorName, setAuthorName] = useState<string>("…");
  const [avatarURL, setAvatarURL] = useState<string | null>(null);

  // jau ir ielikts dokumentā → izmantojam
  const presetName = post.author?.username || post.author?.displayName || null;
  const presetAvatar = post.author?.avatarURL || null;
  const postUid = post.author?.uid || post.uid || null;

  // formatē datumu
  const created = useMemo(() => {
    const ts = post.createdAt as any;
    if (!ts) return "";
    if (typeof ts?.toDate === "function") return ts.toDate().toLocaleString();
    if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000).toLocaleString();
    return "";
  }, [post.createdAt]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // ja dokumentā jau ir username/avatārs — nav jālasa no DB
      if (presetName) setAuthorName(presetName);
      if (presetAvatar) setAvatarURL(presetAvatar);

      if (!presetName && postUid) {
        try {
          const usnap = await getDoc(doc(db, "users", postUid));
          if (!cancelled && usnap.exists()) {
            const u = usnap.data() as any;
            setAuthorName(u?.username || u?.displayName || shortUid(postUid));
            setAvatarURL(u?.avatarURL || u?.photoURL || null);
          } else if (!cancelled) {
            setAuthorName(shortUid(postUid));
          }
        } catch {
          if (!cancelled && postUid) setAuthorName(shortUid(postUid));
        }
      } else if (!presetName) {
        setAuthorName("Unknown");
      }
    }
    load();

    return () => { cancelled = true; };
  }, [postUid, presetName, presetAvatar]);

  return (
    <article className="card">
      <Link href={`/posts/${post.id}`} className="body">
        <header className="head">
          {avatarURL ? (
            <img className="avatar" src={avatarURL} alt="" />
          ) : (
            <div className="avatar placeholder" />
          )}
          <div className="meta">
            <div className="name">{authorName}</div>
            {created && <div className="time">{created}</div>}
          </div>
        </header>

        {post.text ? <p className="text">{post.text}</p> : null}
        {post.imageURL ? <img className="img" src={post.imageURL} alt="" /> : null}

        <footer className="foot">
          <span className="chip">Open</span>
        </footer>
      </Link>

      <style jsx>{`
        .card { border:1px solid #e5e7eb; background:#fff; border-radius:12px; overflow:hidden; }
        .body { display:block; padding:12px; text-decoration:none; color:inherit; }
        .head { display:flex; gap:10px; align-items:center; margin-bottom:8px; }
        .avatar { width:36px; height:36px; border-radius:9999px; object-fit:cover; border:1px solid #e5e7eb; }
        .avatar.placeholder { width:36px; height:36px; border-radius:9999px; background:#f3f4f6; border:1px solid #e5e7eb; }
        .meta { display:grid; }
        .name { font-weight:600; color:#111827; line-height:1.1; }
        .time { font-size:12px; color:#6b7280; }
        .text { color:#111827; margin:6px 0; white-space:pre-wrap; }
        .img { width:100%; border-radius:10px; border:1px solid #e5e7eb; object-fit:cover; margin-top:6px; }
        .foot { margin-top:8px; display:flex; justify-content:flex-end; }
        .chip { font-size:12px; border:1px solid #e5e7eb; padding:4px 8px; border-radius:999px; background:#f9fafb; }
      `}</style>
    </article>
  );
}

function shortUid(u?: string | null) {
  if (!u) return "Unknown";
  return u.slice(0, 6); // rezerves variants, ja nav username
}
