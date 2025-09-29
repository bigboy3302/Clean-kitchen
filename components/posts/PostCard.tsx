"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  limit as fsLimit,
} from "firebase/firestore";

type Author = { username?: string|null; displayName?: string|null; avatarURL?: string|null };

type MediaItem = {
  type: "image"|"video";
  url: string;
  w?: number; h?: number; duration?: number;
};

export type Post = {
  id: string;
  uid?: string | null;
  text?: string|null;
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
  onRepost?: (post: Post) => Promise<void>|void;
  onToggleLike?: (post: Post, liked: boolean) => Promise<void>|void;
};

function timeAgo(ts: Post["createdAt"]) {
  if (!ts) return "";
  const sec =
    typeof ts === "number"
      ? ts
      : typeof ts === "string"
        ? Math.floor(Date.parse(ts)/1000)
        : ts?.seconds ?? 0;
  if (!sec) return "";
  const diff = Math.max(1, Math.floor(Date.now()/1000 - sec));
  const steps: [number,string][]= [[60,"s"],[60,"m"],[24,"h"],[7,"d"],[4.345,"w"],[12,"mo"],[Number.MAX_SAFE_INTEGER,"y"]];
  let v = diff, i = 0;
  for (; i < steps.length-1 && v >= steps[i][0]; i++) v = Math.floor(v/steps[i][0]);
  return `${v}${steps[i][1]}`;
}

type CommentRow = {
  id: string;
  uid: string;
  text: string;
  createdAt?: any;
  author?: Author | null;
};

export default function PostCard({
  post, meUid, onEdit, onAddMedia, onDelete, onReport, onComment, onRepost, onToggleLike,
}: Props) {
  const { media = [], author = {}, createdAt } = post || {};
  const isOwner = !!(meUid && post?.uid && meUid === post.uid);

  const createdAtLabel = useMemo(() => timeAgo(createdAt), [createdAt]);
  const hasMedia = media && media.length > 0;


  const [likes, setLikes] = useState<number>(Math.max(0, post?.likes || 0));
  const [reposts, setReposts] = useState<number>(Math.max(0, post?.reposts || 0));
  const [liked, setLiked] = useState<boolean>(false);
  const [hasReposted, setHasReposted] = useState<boolean>(false);

  
  const [text, setText] = useState(post?.text || "");
  useEffect(() => setText(post?.text || ""), [post?.text]);

 
  const [saved, setSaved] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const likeBurstRef = useRef<HTMLDivElement | null>(null);


  const [showComposer, setShowComposer] = useState(false);
  const [commentText, setCommentText] = useState("");
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [showAllComments, setShowAllComments] = useState(false);

  
  const [editOpen, setEditOpen] = useState(false);
  const [draftText, setDraftText] = useState(text || "");
  const fileInputRef = useRef<HTMLInputElement | null>(null);


  useEffect(() => {
    if (!post?.id) return;

    const stopLikes = onSnapshot(query(collection(db, "posts", post.id, "likes")), (snap) => {
      setLikes(snap.size);
      if (meUid) setLiked(snap.docs.some(d => d.id === meUid));
    });

    const stopReposts = onSnapshot(query(collection(db, "posts", post.id, "reposts")), (snap) => {
      setReposts(snap.size);
      if (meUid) setHasReposted(snap.docs.some(d => d.id === meUid));
    });

    return () => { stopLikes(); stopReposts(); };
  }, [post?.id, meUid]);

  
  useEffect(() => {
    if (!post?.id) return;
    const qy = query(
      collection(db, "posts", post.id, "comments"),
      orderBy("createdAt", "desc"),
      fsLimit(showAllComments ? 50 : 3)
    );
    const stop = onSnapshot(qy, (snap) => {
      setComments(snap.docs.map(d => {
        const data = d.data() || {};
        return { id: d.id, uid: data.uid, text: data.text || "", createdAt: data.createdAt, author: data.author || null };
      }));
    });
    return () => stop();
  }, [post?.id, showAllComments]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenuOpen(false); setEditOpen(false); } };
    if (menuOpen) document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, [menuOpen]);

  function onDoubleTap() {
    if (!liked) {
      setLiked(true);
      setLikes(n => n + 1);
      likeBurstRef.current?.classList.add("go");
      setTimeout(() => likeBurstRef.current?.classList.remove("go"), 450);
      onToggleLike?.(post, true);
    }
  }
  function toggleLike() {
    setLiked(v => {
      const next = !v;
      setLikes(n => (next ? n + 1 : Math.max(0, n - 1)));
      onToggleLike?.(post, next);
      return next;
    });
  }

  async function handleEditSave() {
    const next = draftText.trim();
    setEditOpen(false);
    if (next !== text) {
      setText(next); 
      await onEdit?.(post, next);
    }
  }
  function handleAddMediaClick() { fileInputRef.current?.click(); }
  async function handleAddMediaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length) await onAddMedia?.(post, files);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMenuOpen(false);
  }

  async function submitComment() {
    const t = commentText.trim();
    if (!t) return;
    setCommentText("");
  
    if (onComment) await onComment(post, t);
    else {
  
      await addDoc(collection(db, "posts", post.id, "comments"), {
        uid: meUid, text: t, createdAt: serverTimestamp(),
      });
    }
  }

  async function doRepost() {
    const next = !hasReposted;
    setHasReposted(next);
    setReposts(n => Math.max(0, n + (next ? 1 : -1)));
    await onRepost?.(post);
  }

  const displayName = author?.displayName || author?.username || "User";
  const profileHref = `/u/${author?.username || ""}`;

  return (
    <>
      <article className="pc">
        {/* HEADER */}
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
                    <button className="mi" role="menuitem" onClick={() => { setDraftText(text || ""); setEditOpen(true); setMenuOpen(false); }}>Edit post</button>
                    <button className="mi" role="menuitem" onClick={handleAddMediaClick}>Add media</button>
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

        {/* MEDIA or EMPTY-CENTERED TEXT */}
        {hasMedia ? (
          <div className={`pc-media ${media.length > 1 ? "multi" : ""}`} onDoubleClick={onDoubleTap}>
            <div ref={likeBurstRef} className="burst" aria-hidden>
              <svg viewBox="0 0 24 24" width="96" height="96"><path d="M12.1 8.64l-.1.1-.11-.11C10.14 6.8 7.1 6.8 5.35 8.56c-1.76 1.75-1.76 4.6 0 6.36l6.07 6.07c.32.32.85.32 1.18 0l6.06-6.07c1.76-1.76 1.76-4.6 0-6.36-1.76-1.76-4.8-1.76-6.56 0z" fill="currentColor"/></svg>
            </div>
            <div className="rail" tabIndex={0} aria-label="Post media">
              {media.map((m,i)=>(
                <div key={i} className="cell">
                  {m.type === "video" ? <video src={m.url} controls playsInline preload="metadata" /> : <img src={m.url} alt="" />}
                </div>
              ))}
            </div>
            {media.length>1 && <div className="dots" aria-hidden>{media.map((_,i)=><span key={i} className="dot" />)}</div>}
          </div>
        ) : (
          text && (
            <div className="pc-empty">
              <p className="empty-text">{text}</p>
            </div>
          )
        )}

        {/* INFO */}
        <div className="pc-info">
          {hasMedia && text ? <p className="caption">{text}</p> : null}
          {createdAtLabel ? <button className="timestamp" aria-label={`Posted ${createdAtLabel} ago`}>{createdAtLabel}</button> : null}
        </div>

        {/* ACTIONS */}
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

            <button className="icon" aria-label="Comment" onClick={() => { setShowComposer(v=>!v); setTimeout(()=>composerRef.current?.focus(),0); }}>
              <svg width="24" height="24" viewBox="0 0 24 24"><path d="M21 12a8.5 8.5 0 01-8.5 8.5H6l-3 3 .5-4.8A8.5 8.5 0 1121 12z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>

            <button className="icon" aria-label="Repost" onClick={doRepost} title={hasReposted ? "Remove repost" : "Repost"}>
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

        {/* Composer + comments list */}
        {showComposer && (
          <div className="composer">
            <textarea
              ref={composerRef}
              rows={2}
              placeholder="Write a comment…"
              value={commentText}
              onChange={(e)=>setCommentText(e.target.value)}
            />
            <button className="send" onClick={submitComment} disabled={!commentText.trim()}>Post</button>
          </div>
        )}

        {comments.length > 0 && (
          <div className="comments">
            <ul className="clist">
              {comments.map((c) => {
                const ts: any = c.createdAt;
                const when = ts?.toDate ? ts.toDate() :
                  typeof ts?.seconds === "number" ? new Date(ts.seconds * 1000) : undefined;
                const who =
                  c.author?.displayName ||
                  c.author?.username ||
                  (c.uid ? c.uid.slice(0,6) : "user");
                return (
                  <li key={c.id} className="crow">
                    <div className="cmeta">
                      <span className="cwho">{who}</span>
                      {when && <span className="cdot">•</span>}
                      {when && <span className="ctime">{when.toLocaleString()}</span>}
                    </div>
                    <p className="ctext">{c.text}</p>
                  </li>
                );
              })}
            </ul>
            <div className="ctoggle">
              <Link href={`/posts/${post.id}`} className="clink">Open thread</Link>
              <button className="clink ghost" onClick={()=>setShowAllComments(s=>!s)}>
                {showAllComments ? "Show less" : "Show more"}
              </button>
            </div>
          </div>
        )}
      </article>

      {/* Edit modal */}
      {editOpen && (
        <div className="overlay" role="dialog" aria-modal="true" onClick={()=>setEditOpen(false)}>
          <div className="modal" onClick={(e)=>e.stopPropagation()}>
            <div className="mhead">
              <div className="mtitle">Edit post</div>
              <button className="close" onClick={()=>setEditOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="mbody">
              <textarea rows={5} value={draftText} onChange={(e)=>setDraftText(e.target.value)} />
            </div>
            <div className="mactions">
              <button className="btn ghost" onClick={()=>setEditOpen(false)}>Cancel</button>
              <button className="btn primary" onClick={handleEditSave}>Save</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .pc{ position:relative; background:var(--card-bg); border:1px solid var(--border); border-radius:16px; overflow:visible; box-shadow:var(--shadow) }
        .pc-head{ display:flex; align-items:center; justify-content:space-between; padding:10px 12px }
        .pc-left{ display:flex; align-items:center; gap:10px }
        .pc-avatar{ width:40px; height:40px; border-radius:999px; overflow:hidden; display:block; border:1px solid var(--border); background:#000 }
        .pc-avatar img{ width:100%; height:100%; object-fit:cover; display:block }
        .ph{ width:40px; height:40px; border-radius:999px; display:grid; place-items:center; background:#f1f5f9; color:#0f172a; font-weight:800; border:1px solid #e2e8f0 }
        :root[data-theme="dark"] .ph{ background:#111827; color:#e5e7eb; border-color:#1f2937 }
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

        .pc-media{ position:relative }
        .rail{ display:flex; gap:6px; overflow:auto; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; padding:0 6px 6px }
        .cell{ position:relative; flex: 0 0 100%; scroll-snap-align:center; border-radius:12px; overflow:hidden; border:1px solid var(--border); max-height:72vh; background:#000 }
        .pc-media img, .pc-media video{ width:100%; height:100%; object-fit:cover; display:block }
        .dots{ position:absolute; bottom:12px; left:0; right:0; display:flex; gap:6px; justify-content:center }
        .dot{ width:6px; height:6px; border-radius:999px; background: rgba(255,255,255,.55) }
        :root[data-theme="dark"] .dot{ background: rgba(255,255,255,.7) }

        .burst{ position:absolute; inset:0; display:grid; place-items:center; color:#ef4444; opacity:0; transform: scale(.6); pointer-events:none }
        .burst.go{ animation: pop .45s ease forwards }
        @keyframes pop{ 0%{opacity:0; transform:scale(.6)} 70%{opacity:.9; transform:scale(1)} 100%{opacity:0; transform:scale(1.1)} }

        .pc-empty{ display:grid; place-items:center; padding:32px 14px }
        .empty-text{ margin:0; text-align:center; color: var(--text); white-space:pre-wrap }

        .pc-info{ padding: 10px 12px 0 }
        .caption{ margin:8px 0 0; color: var(--text); text-align:center; white-space:pre-wrap }
        .timestamp{ background: transparent; border: 0; color: var(--muted); font-size: 12px; margin: 8px auto 0; padding: 0; display:block; text-align:center }

        .pc-actions{ display:flex; align-items:center; justify-content:space-between; padding: 8px 8px 10px }
        .pc-actions .left{ display:flex; gap:6px; align-items:center }
        .miniCount{ font-size:12px; color: var(--muted); padding-right:6px }
        .icon{
          width:36px; height:36px; display:grid; place-items:center; border-radius:999px;
          background: transparent; border: 0; color: var(--text); cursor: pointer;
          transition: background .12s ease, opacity .12s ease, transform .06s ease;
        }
        .icon:hover{ background: rgba(2,6,23,.06) }
        :root[data-theme="dark"] .icon:hover{ background: rgba(255,255,255,.08) }
        .icon:active{ transform: translateY(1px) }
        .icon.active{ color:#ef4444 }

        .composer{ display:grid; grid-template-columns: 1fr auto; gap:8px; padding: 0 12px 12px }
        .composer textarea{
          width:100%; border:1px solid var(--border); border-radius:12px; padding:10px 12px;
          background: var(--bg); color: var(--text); resize: vertical; min-height: 38px;
        }
        .composer .send{
          border-radius:12px; border:0; padding:0 14px; background: var(--primary); color: var(--primary-contrast); font-weight:700; cursor:pointer;
        }
        .composer .send:disabled{ opacity:.6; cursor:not-allowed }

        .comments{ padding: 0 12px 12px }
        .clist{ list-style:none; margin:8px 0 0; padding:0; display:grid; gap:8px }
        .crow{ border-top:1px solid var(--border); padding-top:8px }
        .cmeta{ display:flex; align-items:center; gap:6px; font-size:12px; color:var(--muted) }
        .cwho{ font-weight:600; color:var(--text) }
        .cdot{ color:var(--muted) }
        .ctext{ margin:4px 0 0; white-space:pre-wrap }
        .ctoggle{ display:flex; gap:10px; margin-top:10px }
        .clink{ font-size:12px; color:var(--primary); text-decoration:underline; background:none; border:0; padding:0; cursor:pointer }
        .clink.ghost{ color:var(--muted) }

        .overlay{ position:fixed; inset:0; background: rgba(2,6,23,.55); display:grid; place-items:center; padding:16px; z-index: 1200 }
        .modal{ width:100%; max-width:560px; background: var(--card-bg); border:1px solid var(--border); border-radius:16px; overflow:hidden; box-shadow: var(--shadow) }
        .mhead{ display:flex; align-items:center; justify-content:space-between; gap:8px; padding:12px 14px; border-bottom:1px solid var(--border); background: var(--bg) }
        .mtitle{ font-weight:800; color: var(--text) }
        .close{ border:none; background:transparent; font-size:18px; color: var(--muted); cursor:pointer }
        .mbody{ padding:14px }
        .mbody textarea{
          width:100%; border:1px solid var(--border); border-radius:12px; padding:10px 12px;
          background: var(--bg); color: var(--text); min-height: 120px; resize: vertical;
        }
        .mactions{ display:flex; justify-content:flex-end; gap:8px; padding: 0 14px 14px }
        .btn{ border-radius:12px; font-weight:700; padding:8px 14px; cursor:pointer; border:1px solid var(--border); background: var(--bg); color: var(--text) }
        .btn.primary{ background: var(--primary); color: var(--primary-contrast); border-color: transparent }
        .btn.ghost:hover{ background: rgba(2,6,23,.06) } :root[data-theme="dark"] .btn.ghost:hover{ background: rgba(255,255,255,.08) }
      `}</style>
    </>
  );
}
