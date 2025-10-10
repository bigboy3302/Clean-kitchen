"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit as qlimit,
} from "firebase/firestore";


export default function TrendingPosts({
  maxPostsToTrack = 150,
  topN = 5,              
}) {
  const [posts, setPosts] = useState([]); 
  const [repostCounts, setRepostCounts] = useState({}); 
  const repostUnsubsRef = useRef([]);

  useEffect(() => {
    const qy = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
      qlimit(maxPostsToTrack)
    );

    const stop = onSnapshot(qy, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
      setPosts(list);
    });

    return () => stop();
  }, [maxPostsToTrack]);

  useEffect(() => {
    repostUnsubsRef.current.forEach((fn) => { try { fn(); } catch {} });
    repostUnsubsRef.current = [];

    if (!posts.length) {
      setRepostCounts({});
      return;
    }

    const unsubs = posts.map((p) => {
      const col = collection(db, "posts", p.id, "reposts");
      return onSnapshot(col, (snap) => {
        setRepostCounts((m) => ({ ...m, [p.id]: snap.size }));
      });
    });

    repostUnsubsRef.current = unsubs;
    return () => {
      unsubs.forEach((fn) => { try { fn(); } catch {} });
    };
  }, [posts]);

  const top = useMemo(() => {
    const ranked = posts
      .map((p) => ({ post: p, count: repostCounts[p.id] ?? 0 }))
      .filter((x) => (x.count || 0) > 0) 
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
    
        const ta = toMillis(a.post?.createdAt);
        const tb = toMillis(b.post?.createdAt);
        return tb - ta;
      })
      .slice(0, topN);

    return ranked;
  }, [posts, repostCounts, topN]);

  if (top.length === 0) {
    return (
      <aside className="trend">
        <h3 className="h">Trending</h3>
        <p className="muted">No reposted posts yet.</p>
        <style jsx>{styles}</style>
      </aside>
    );
  }

  return (
    <aside className="trend">
      <h3 className="h">Trending</h3>
      <ul className="list">
        {top.map(({ post, count }) => {
          const cover =
            Array.isArray(post.media) && post.media[0]?.type === "image"
              ? post.media[0].url
              : null;

          const title =
            post.title ||
            (post.text ? trimMid(post.text, 80) : "Untitled post");

          return (
            <li key={post.id} className="item">
              <Link href={`/posts/${post.id}`} className="row">
                {cover ? (
                  <img className="thumb" src={cover} alt="" />
                ) : (
                  <div className="thumb ph" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path
                        d="M4 5h16v14H4z M8 11a2 2 0 114 0 2 2 0 01-4 0zm10 6l-4.5-6-3.5 4.5L8 13l-4 4h14z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                )}
                <div className="meta">
                  <div className="title" title={title}>{title}</div>
                  <div className="line">
                    <span className="badge">↻ {count}</span>
                    {post.author?.username ? (
                      <span className="by">@{post.author.username}</span>
                    ) : null}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <style jsx>{styles}</style>
    </aside>
  );
}

function toMillis(ts) {
  try {
    if (!ts) return 0;
    if (typeof ts?.toDate === "function") return ts.toDate().getTime();
    if (typeof ts?.seconds === "number") return ts.seconds * 1000;
  } catch {}
  return 0;
}

function trimMid(str, max) {
  if (!str) return "";
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "…";
}

const styles = `
.trend { border:1px solid var(--border); background:var(--card-bg); border-radius:16px; padding:12px; box-shadow:var(--shadow); }
.h { margin:0 0 8px; font-size:16px; font-weight:800; color:var(--text); }
.muted { color: var(--muted); font-size: 14px; }

.list { list-style:none; margin:0; padding:0; display:grid; gap:8px; }
.item { }
.row { display:flex; gap:10px; align-items:center; text-decoration:none; color:inherit; }
.thumb { width:48px; height:48px; border-radius:10px; object-fit:cover; border:1px solid var(--border); background:#000; flex:0 0 auto; }
.thumb.ph { display:grid; place-items:center; color:var(--muted); background:var(--bg2); }
.meta { min-width:0; }
.title { font-weight:700; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.line { display:flex; gap:10px; align-items:center; margin-top:2px; }
.badge { background: color-mix(in oklab, var(--primary) 12%, var(--bg)); border:1px solid color-mix(in oklab, var(--primary) 35%, var(--border)); color: var(--text); padding:2px 8px; border-radius:999px; font-size:12px; font-weight:800; }
.by { color: var(--muted); font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
`;
