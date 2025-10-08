"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";

type Author = { username?: string|null; displayName?: string|null; avatarURL?: string|null };
type MediaItem = { type:"image"|"video"; url:string; w?:number; h?:number; duration?:number };

export type Post = {
  id: string;
  uid?: string | null;
  text?: string|null;
  title?: string|null;
  description?: string|null;
  media?: MediaItem[];
  author?: Author | null;
  createdAt?: { seconds?: number } | number | string | null;
  likes?: number;
  reposts?: number;
};

type Props = {
  post: Post;
  meUid?: string|null;
  onEdit?: (post: Post, nextText: string) => Promise<void>|void;
  onAddMedia?: (post: Post, files: File[]) => Promise<void>|void;
  onDelete?: (post: Post) => Promise<void>|void;
  onReport?: (post: Post) => Promise<void>|void;
  onComment?: (post: Post, text: string) => Promise<void>|void;
  onToggleRepost?: (post: Post, next: boolean) => Promise<void>|void;
  onToggleLike?: (post: Post, liked: boolean) => Promise<void>|void;
};

function timeAgo(ts: Post["createdAt"]) {
  if (!ts) return "";
  const sec =
    typeof ts === "number" ? ts :
    typeof ts === "string" ? Math.floor(Date.parse(ts)/1000) :
    (ts as any)?.seconds ?? 0;
  if (!sec) return "";
  const diff = Math.max(1, Math.floor(Date.now()/1000 - sec));
  const steps: [number,string][]= [[60,"s"],[60,"m"],[24,"h"],[7,"d"],[4.345,"w"],[12,"mo"],[Number.MAX_SAFE_INTEGER,"y"]];
  let v = diff, i = 0;
  for (; i < steps.length-1 && v >= steps[i][0]; i++) v = Math.floor(v/steps[i][0]);
  return `${v}${steps[i][1]}`;
}

export default function PostCard({
  post, meUid, onEdit, onAddMedia, onDelete, onReport, onToggleRepost, onToggleLike,
}: Props) {
  const { text, media = [], author = {}, createdAt } = post || {};
  const isOwner = !!(meUid && post?.uid && meUid === post.uid);
  const createdAtLabel = useMemo(() => timeAgo(createdAt), [createdAt]);
  const hasMedia = media && media.length > 0;

  const [likes, setLikes] = useState<number>(Math.max(0, post?.likes || 0));
  const [reposts, setReposts] = useState<number>(Math.max(0, post?.reposts || 0));
  const [liked, setLiked] = useState<boolean>(false);
  const [hasReposted, setHasReposted] = useState<boolean>(false);

  const [saved, setSaved] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const likeBurstRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!post?.id) return;
    const likesCol = collection(db, "posts", post.id, "likes");
    const stopLikes = onSnapshot(query(likesCol), (snap) => {
      setLikes(snap.size);
      if (meUid) setLiked(snap.docs.some(d => d.id === meUid));
    });
    const repostsCol = collection(db, "posts", post.id, "reposts");
    const stopReposts = onSnapshot(query(repostsCol), (snap) => {
      setReposts(snap.size);
      if (meUid) setHasReposted(snap.docs.some(d => d.id === meUid));
    });
    return () => { stopLikes(); stopReposts(); };
  }, [post?.id, meUid]);

  function ensureCanLike(): boolean {
    if (!meUid) {
      alert("Please sign in to like posts.");
      return false;
    }
    return true;
  }

  async function optimisticLike(next: boolean) {
    // optimistic flip
    const prevLiked = liked;
    const prevCount = likes;
    setLiked(next);
    setLikes(n => (next ? n + 1 : Math.max(0, n - 1)));
    try {
      await onToggleLike?.(post, next);
    } catch (e) {
      // revert if backend rejects
      setLiked(prevLiked);
      setLikes(prevCount);
      console.error("[PostCard] like failed; reverted", e);
    }
  }

  function onDoubleTap() {
    if (!ensureCanLike()) return;
    if (!liked) {
      likeBurstRef.current?.classList.add("go");
      setTimeout(() => likeBurstRef.current?.classList.remove("go"), 450);
      optimisticLike(true);
    }
  }

  function toggleLike() {
    if (!ensureCanLike()) return;
    optimisticLike(!liked);
  }

  async function handleAddMediaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length) await onAddMedia?.(post, files);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMenuOpen(false);
  }

  async function toggleRepost() {
    const next = !hasReposted;
    setHasReposted(next);
    setReposts(n => (next ? n + 1 : Math.max(0, n - 1)));
    try {
      await onToggleRepost?.(post, next);
    } catch (e) {
      setHasReposted(!next);
      setReposts(n => (!next ? n + 1 : Math.max(0, n - 1)));
      console.error("[PostCard] repost failed; reverted", e);
    }
  }

  const displayName = author?.displayName || author?.username || "User";
  const profileHref = `/u/${author?.username || post.uid || ""}`;
  const threadHref = `/posts/${post.id}`;

  return (
    <>
      <article className="pc">
        <header className="pc-head">
          <div className="pc-left">
            <Link href={profileHref} className="pc-avatar" aria-label={`${displayName} profile`}>
              {author?.avatarURL ? <img src={author.avatarURL} alt="" /> : <span className="ph">{displayName.slice(0,1).toUpperCase()}</span>}
            </Link>
            <div className="pc-meta">
              <div className="pc-name"><Link href={profileHref} className="pc-link">{displayName}</Link></div>
              {createdAtLabel ? <div className="pc-time">{createdAtLabel}</div> : null}
            </div>
          </div>

          <div className="pc-menu" ref={menuRef}>
            <button className="menu-btn" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Post options" onClick={() => setMenuOpen(o => !o)}>
              <svg width="20" height="20" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
            </button>
            {menuOpen && (
              <div className="menu" role="menu">
                {isOwner ? (
                  <>
                    <button className="mi" role="menuitem" onClick={() => {/* open edit elsewhere */}}>Edit post</button>
                    <button className="mi" role="menuitem" onClick={() => fileInputRef.current?.click()}>Add media</button>
                    <hr className="sep" aria-hidden />
                    <button className="mi danger" role="menuitem" onClick={() => onDelete?.(post)}>Delete</button>
                  </>
                ) : (
                  <>
                    <button className="mi" role="menuitem" onClick={() => onReport?.(post)}>Report</button>
                    <button className="mi" role="menuitem">Hide</button>
                  </>
                )}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleAddMediaChange} style={{display:"none"}} />
          </div>
        </header>

        {/* media */}
        {hasMedia ? (
          <div className={`pc-media ${media.length > 1 ? "multi" : ""}`} onDoubleClick={onDoubleTap}>
            <div ref={likeBurstRef} className="burst" aria-hidden>
              <svg viewBox="0 0 24 24" width="72" height="72"><path d="M12.1 8.64l-.1.1-.11-.11C10.14 6.8 7.1 6.8 5.35 8.56c-1.76 1.75-1.76 4.6 0 6.36l6.07 6.07c.32.32.85.32 1.18 0l6.06-6.07c1.76-1.76 1.76-4.6 0-6.36-1.76-1.76-4.8-1.76-6.56 0z" fill="currentColor"/></svg>
            </div>
            <div className="rail" tabIndex={0} aria-label="Post media">
              {media.map((m,i)=>(
                <div key={i} className="cell">
                  {m.type === "video" ? <video src={m.url} controls playsInline preload="metadata" /> : <img src={m.url} alt="" />}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="pc-info">
          {hasMedia && text ? <p className="caption">{text}</p> : null}
          {createdAtLabel ? <button className="timestamp" aria-label={`Posted ${createdAtLabel} ago`}>{createdAtLabel}</button> : null}
        </div>

        <div className="pc-actions">
          <div className="left">
            <button className={`icon ${liked ? "active" : ""}`} onClick={toggleLike} aria-pressed={liked} aria-label="Like">
              <svg width="24" height="24" viewBox="0 0 24 24">
                {liked
                  ? <path d="M12.1 8.64l-.1.1-.11-.11C10.14 6.8 7.1 6.8 5.35 8.56c-1.76 1.75-1.76 4.6 0 6.36l6.07 6.07c.32.32.85.32 1.18 0l6.06-6.07c1.76-1.76 1.76-4.6 0-6.36-1.76-1.76-4.8-1.76-6.56 0z" fill="currentColor"/>
                  : <path d="M12.1 8.64l-.1.1-.11-.11C10.14 6.8 7.1 6.8 5.35 8.56c-1.76 1.75-1.76 4.6 0 6.36l6.07 6.07c.32.32.85.32 1.18 0l6.06-6.07c1.76-1.76 1.76-4.6 0-6.36-1.76-1.76-4.8-1.76-6.56 0z" stroke="currentColor" strokeWidth="1.5" fill="none"/>}
              </svg>
            </button>
            <span className="miniCount">{likes}</span>

            <Link href={threadHref} className="icon" aria-label="Open thread">
              <svg width="24" height="24" viewBox="0 0 24 24">
                <path d="M21 12a8.5 8.5 0 01-8.5 8.5H6l-3 3 .5-4.8A8.5 8.5 0 1121 12z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>

            <button className="icon" aria-label="Repost" onClick={toggleRepost} disabled={!meUid} title={hasReposted ? "Undo repost" : "Repost"}>
              <svg width="24" height="24" viewBox="0 0 24 24">
                <path d="M7 7h8a4 4 0 014 4v1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M9 17H7a4 4 0 01-4-4v-1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M14 4l3 3-3 3M10 20l-3-3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <span className="miniCount">{reposts}</span>
          </div>

          <button className={`icon ${saved ? "active" : ""}`} onClick={() => setSaved(s=>!s)} aria-label="Save">
            <svg width="24" height="24" viewBox="0 0 24 24"><path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z" fill={saved?"currentColor":"none"} stroke="currentColor" strokeWidth="1.5"/></svg>
          </button>
        </div>
      </article>

      <style jsx>{`
        .pc{ position:relative; background:var(--card-bg); border:1px solid var(--border); border-radius:16px; overflow:hidden; box-shadow:var(--shadow) }
        .pc-head{ display:flex; align-items:center; justify-content:space-between; padding:10px 12px }
        .pc-left{ display:flex; align-items:center; gap:10px }
        .pc-avatar{ width:40px; height:40px; border-radius:999px; overflow:hidden; display:block; border:1px solid var(--border); background:#000 }
        .pc-avatar img{ width:100%; height:100%; object-fit:cover; display:block }
        .ph{ width:40px; height:40px; border-radius:999px; display:grid; place-items:center; background:var(--bg2); color:var(--text); font-weight:800; border:1px solid var(--border) }
        .pc-meta{ display:flex; flex-direction:column; line-height:1.1 }
        .pc-name{ font-weight:700 }
        .pc-link{ color: var(--text); text-decoration:none }
        .pc-link:hover{ text-decoration:underline }
        .pc-time{ font-size:12px; color: var(--muted); margin-top:2px }

        .pc-menu{ position:relative; z-index:50 }
        .menu-btn{ background:transparent; border:0; color:var(--muted); cursor:pointer; border-radius:8px; width:32px; height:32px; display:grid; place-items:center }
        .menu{ position:absolute; top:calc(100% + 8px); right:0; min-width:200px; background:var(--card-bg); border:1px solid var(--border); border-radius:12px; box-shadow:var(--shadow); padding:6px; z-index:70 }
        .mi{ width:100%; text-align:left; background:transparent; border:0; color: var(--text); padding:8px 10px; border-radius:8px; cursor:pointer }
        .mi:hover{ background: rgba(2,6,23,.06) } :root[data-theme="dark"] .mi:hover{ background: rgba(255,255,255,.08) }
        .mi.danger{ color:#e11d48 }
        .sep{ height:1px; background: var(--border); border:0; margin:6px }

        .pc-media{ position:relative; }
        .rail{ display:flex; gap:6px; overflow:auto; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; padding:0 6px 8px }
        .cell{
          position:relative; flex: 0 0 84%;
          scroll-snap-align:center; border-radius:12px; overflow:hidden;
          border:1px solid var(--border); background:#000;
          aspect-ratio: 4/5; max-height: 420px;
        }
        @media (min-width: 720px){
          .cell{ flex: 0 0 62%; aspect-ratio: 4/3; max-height: 360px; }
        }
        .pc-media img, .pc-media video{ width:100%; height:100%; object-fit:cover; display:block }

        .burst{ position:absolute; inset:0; display:grid; place-items:center; color:#ef4444; opacity:0; transform: scale(.6); pointer-events:none }
        .burst.go{ animation: pop .45s ease forwards }
        @keyframes pop{ 0%{opacity:0; transform:scale(.6)} 70%{opacity:.9; transform:scale(1)} 100%{opacity:0; transform:scale(1.1)} }

        .pc-info{ padding: 8px 12px 0 }
        .caption{ margin:6px 0 0; color: var(--text); text-align:left; white-space:pre-wrap }
        .timestamp{ background: transparent; border: 0; color: var(--muted); font-size: 12px; margin: 6px 0 0; padding: 0; display:block; text-align:left }

        .pc-actions{ display:flex; align-items:center; justify-content:space-between; padding: 6px 8px 10px }
        .pc-actions .left{ display:flex; gap:6px; align-items:center }
        .miniCount{ font-size:12px; color: var(--muted); padding-right:6px }
        .icon{ width:36px; height:36px; display:grid; place-items:center; border-radius:999px; background: transparent; border: 0; color: var(--text); cursor: pointer; transition: background .12s ease, opacity .12s ease, transform .06s ease; }
        .icon:hover{ background: rgba(2,6,23,.06) }
        :root[data-theme="dark"] .icon:hover{ background: rgba(255,255,255,.08) }
        .icon:active{ transform: translateY(1px) }
        .icon.active{ color:#ef4444 }
      `}</style>
    </>
  );
}
