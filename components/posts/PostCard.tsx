"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import Avatar from "@/components/ui/Avatar";

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
  onReport?: (post: Post, details: { reason: string; postUrl?: string | null }) => Promise<void>|void;
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

  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text || "");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const likeBurstRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editFieldRef = useRef<HTMLTextAreaElement | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (!editing) setDraft(text || "");
  }, [text, editing]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  useEffect(
    () => () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    },
    []
  );

  function ensureCanLike(): boolean {
    if (!meUid) { alert("Please sign in to like posts."); return false; }
    return true;
  }
  async function optimisticLike(next: boolean) {
    const prevLiked = liked, prevCount = likes;
    setLiked(next);
    setLikes(n => (next ? n + 1 : Math.max(0, n - 1)));
    try { await onToggleLike?.(post, next); } catch { setLiked(prevLiked); setLikes(prevCount); }
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
    setHasReposted(next); setReposts(n => (next ? n + 1 : Math.max(0, n - 1)));
    try { await onToggleRepost?.(post, next); }
    catch { setHasReposted(!next); setReposts(n => (!next ? n + 1 : Math.max(0, n - 1))); }
  }

  function startEdit() {
    setMenuOpen(false);
    setEditError("");
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setJustSaved(false);
    setDraft(text || "");
    setEditing(true);
    requestAnimationFrame(() => {
      editFieldRef.current?.focus();
      editFieldRef.current?.setSelectionRange(
        editFieldRef.current.value.length,
        editFieldRef.current.value.length
      );
    });
  }

  function cancelEdit() {
    setEditing(false);
    setEditError("");
    setDraft(text || "");
  }

  async function saveEdit() {
    if (!onEdit) {
      setEditing(false);
      return;
    }
    const next = draft.replace(/\r/g, "");
    const trimmed = next.trim();
    const current = (text || "").trim();
    if (trimmed === current) {
      setEditing(false);
      return;
    }
    setEditBusy(true);
    setEditError("");
    try {
      await onEdit(post, trimmed);
      setEditing(false);
      setDraft(trimmed);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      setJustSaved(true);
      savedTimerRef.current = setTimeout(() => {
        setJustSaved(false);
      }, 2200);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
          ? err
          : "Unable to update post.";
      setEditError(message);
    } finally {
      setEditBusy(false);
    }
  }

  function handleEditKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  }

  function openReportDialog() {
    if (!meUid) {
      alert("Please sign in to report posts.");
      return;
    }
    setReportReason("");
    setReportError("");
    setReportSent(false);
    setReportOpen(true);
  }

  function closeReportDialog() {
    if (reportBusy) return;
    setReportOpen(false);
    setReportReason("");
    setReportError("");
    setReportSent(false);
  }

  async function submitReport() {
    if (!meUid) {
      alert("Please sign in to report posts.");
      return;
    }
    const trimmedReason = reportReason.trim();
    if (trimmedReason.length < 10) {
      setReportError("Please provide at least 10 characters so we can understand the issue.");
      return;
    }
    if (!post?.id || !onReport) {
      setReportOpen(false);
      return;
    }
    setReportBusy(true);
    setReportError("");
    try {
      const origin =
        typeof window !== "undefined" && window.location
          ? window.location.origin
          : undefined;
      await onReport(post, {
        reason: trimmedReason,
        postUrl: origin ? `${origin.replace(/\/$/, "")}/posts/${post.id}` : `/posts/${post.id}`,
      });
      setReportSent(true);
      setTimeout(() => {
        closeReportDialog();
      }, 1600);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
          ? err
          : "Failed to submit report.";
      setReportError(message);
    } finally {
      setReportBusy(false);
    }
  }

  const displayName = author?.displayName || author?.username || "User";
  const profileHref = `/u/${author?.username || post.uid || ""}`;
  const threadHref = `/posts/${post.id}`;
  const displayText = editing ? draft : justSaved ? draft : text || "";

  return (
    <>
      <article className="pc">
        <header className="pc-head">
          <div className="pc-left">
            <Link href={profileHref} aria-label={`${displayName} profile`} className="avatar-wrap">
              <Avatar src={author?.avatarURL || undefined} name={displayName} size={68} />
            </Link>
            <div className="pc-meta">
              <div className="pc-name"><Link href={profileHref} className="pc-link">{displayName}</Link></div>
              {createdAtLabel ? <div className="pc-time">{createdAtLabel}</div> : null}
            </div>
          </div>

          <div className="pc-menu" ref={menuRef}>
            <button className="menu-btn" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Post options" onClick={() => setMenuOpen(o => !o)}>
              <svg width="18" height="18" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
            </button>
            {menuOpen && (
              <div className="menu" role="menu">
                {isOwner ? (
                  <>
                    <button type="button" className="mi" role="menuitem" onClick={startEdit}>Edit post</button>
                    <button
                      type="button"
                      className="mi"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                    >
                      Add media
                    </button>
                    <hr className="sep" aria-hidden />
                    <button
                      type="button"
                      className="mi danger"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete?.(post);
                      }}
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="mi"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        openReportDialog();
                      }}
                    >
                      Report post
                    </button>
                  </>
                )}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleAddMediaChange} style={{display:"none"}} />
          </div>
        </header>

        {hasMedia ? (
          <div className={`pc-media ${media.length > 1 ? "multi" : ""}`} onDoubleClick={onDoubleTap}>
            <div ref={likeBurstRef} className="burst" aria-hidden>
              <svg viewBox="0 0 24 24" width="64" height="64"><path d="M12.1 8.64l-.1.1-.11-.11C10.14 6.8 7.1 6.8 5.35 8.56c-1.76 1.75-1.76 4.6 0 6.36l6.07 6.07c.32.32.85.32 1.18 0l6.06-6.07c1.76-1.76 1.76-4.6 0-6.36-1.76-1.76-4.8-1.76-6.56 0z" fill="currentColor"/></svg>
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

        <div className="pc-body">
          {editing ? (
            <div className="edit">
              <textarea
                ref={editFieldRef}
                className="edit-area"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleEditKeyDown}
                placeholder="Say something new..."
                disabled={editBusy}
              />
              {editError ? <p className="edit-error">{editError}</p> : null}
              <div className="edit-actions">
                <button
                  type="button"
                  className="edit-btn edit-ghost"
                  onClick={cancelEdit}
                  disabled={editBusy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="edit-btn edit-primary"
                  onClick={saveEdit}
                  disabled={editBusy}
                >
                  {editBusy ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          ) : displayText ? (
            <p className="pc-text">{displayText}</p>
          ) : null}

          {(createdAtLabel || (!editing && justSaved)) ? (
            <div className="meta-row">
              {createdAtLabel ? (
                <button className="timestamp" aria-label={`Posted ${createdAtLabel} ago`}>
                  {createdAtLabel}
                </button>
              ) : null}
              {!editing && justSaved ? <span className="chip">Updated</span> : null}
            </div>
          ) : null}
        </div>

        {reportOpen && (
          <div className="reportBackdrop" role="dialog" aria-modal="true" onClick={closeReportDialog}>
            <div className="reportModal" onClick={(event) => event.stopPropagation()}>
              <h3>Report post</h3>
              <p>Let us know what needs attention. Your report is sent privately to the Clean Kitchen team.</p>
              <textarea
                className="reportReason"
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                placeholder="Describe the issue..."
                disabled={reportBusy || reportSent}
              />
              {reportError ? <p className="reportError">{reportError}</p> : null}
              {reportSent ? (
                <p className="reportSuccess">
                  Report sent for post <strong>{post.id}</strong>. Thank you for keeping the community safe.
                </p>
              ) : null}
              <div className="reportActions">
                <button
                  type="button"
                  className="reportBtn"
                  onClick={closeReportDialog}
                  disabled={reportBusy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="reportBtn reportPrimary"
                  onClick={submitReport}
                  disabled={reportBusy || reportSent}
                >
                  {reportBusy ? "Sending..." : "Send report"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="pc-actions">
          <div className="left">
            <button className={`icon ${liked ? "active" : ""}`} onClick={toggleLike} aria-pressed={liked} aria-label="Like">
              <svg width="22" height="22" viewBox="0 0 24 24">
                {liked
                  ? <path d="M12.1 8.64l-.1.1-.11-.11C10.14 6.8 7.1 6.8 5.35 8.56c-1.76 1.75-1.76 4.6 0 6.36l6.07 6.07c.32.32.85.32 1.18 0l6.06-6.07c1.76-1.76 1.76-4.6 0-6.36-1.76-1.76-4.8-1.76-6.56 0z" fill="currentColor"/>
                  : <path d="M12.1 8.64l-.1.1-.11-.11C10.14 6.8 7.1 6.8 5.35 8.56c-1.76 1.75-1.76 4.6 0 6.36l6.07 6.07c.32.32.85.32 1.18 0l6.06-6.07c1.76-1.76 1.76-4.6 0-6.36-1.76-1.76-4.8-1.76-6.56 0z" stroke="currentColor" strokeWidth="1.5" fill="none"/>}
              </svg>
            </button>
            <span className="miniCount">{likes}</span>

            <Link href={threadHref} className="icon" aria-label="Open thread">
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path d="M21 12a8.5 8.5 0 01-8.5 8.5H6l-3 3 .5-4.8A8.5 8.5 0 1121 12z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>

            <button className="icon" aria-label="Repost" onClick={toggleRepost} disabled={!meUid} title={hasReposted ? "Undo repost" : "Repost"}>
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path d="M7 7h8a4 4 0 014 4v1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M9 17H7a4 4 0 01-4-4v-1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M14 4l3 3-3 3M10 20l-3-3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <span className="miniCount">{reposts}</span>
          </div>
        </div>
      </article>

      <style jsx>{`
        .pc {
          position: relative;
          display: flex;
          flex-direction: column;
          background: var(--bg-raised);
          border: 1px solid var(--border);
          border-radius: var(--radius-card);
          box-shadow: var(--shadow);
          overflow: hidden;
        }
        .pc-head {
          padding: 20px 22px 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .pc-left {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }
        .avatar-wrap {
          display: block;
          line-height: 0;
        }
        .pc-meta {
          display: grid;
          gap: 4px;
          min-width: 0;
        }
        .pc-name {
          margin: 0;
          font-weight: 700;
          font-size: 15px;
          color: var(--text);
        }
        .pc-link {
          color: inherit;
          text-decoration: none;
        }
        .pc-link:hover {
          text-decoration: underline;
        }
        .pc-time {
          font-size: 12px;
          color: var(--muted);
        }
        .pc-menu {
          position: relative;
          z-index: 10;
        }
        .menu-btn {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: var(--radius-button);
          border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
          background: color-mix(in oklab, var(--bg-raised) 92%, transparent);
          color: var(--muted);
          cursor: pointer;
          transition: transform 0.12s ease, background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
        }
        .menu-btn:hover {
          background: color-mix(in oklab, var(--primary) 12%, var(--bg-raised));
          border-color: color-mix(in oklab, var(--primary) 20%, var(--border));
          color: var(--text);
        }
        .menu-btn:active {
          transform: translateY(1px);
        }
        .menu {
          position: absolute;
          top: calc(100% + 12px);
          right: 0;
          min-width: 220px;
          padding: 10px;
          display: grid;
          gap: 6px;
          border-radius: var(--radius-card);
          background: var(--bg-raised);
          border: 1px solid var(--border);
          box-shadow: 0 18px 42px rgba(15, 23, 42, 0.16);
        }
        .mi {
          width: 100%;
          border: 0;
          background: transparent;
          color: var(--text);
          font-size: 14px;
          font-weight: 600;
          padding: 10px 12px;
          border-radius: var(--radius-button);
          text-align: left;
          cursor: pointer;
          transition: background 0.16s ease, color 0.16s ease;
        }
        .mi:hover {
          background: color-mix(in oklab, var(--primary) 12%, transparent);
        }
        .mi.danger {
          color: #e11d48;
        }
        .mi.danger:hover {
          background: rgba(225, 29, 72, 0.14);
          color: #be123c;
        }
        .sep {
          height: 1px;
          border: 0;
          background: var(--border);
          margin: 4px 0;
        }
        .pc-media {
          position: relative;
          margin-top: 6px;
        }
        .rail {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          padding: 0 22px 16px;
          margin: 0;
          scroll-padding-inline: 22px;
        }
        .rail::-webkit-scrollbar {
          height: 6px;
        }
        .rail::-webkit-scrollbar-thumb {
          background: color-mix(in oklab, var(--primary) 24%, var(--border));
          border-radius: 999px;
        }
        .cell {
          position: relative;
          flex: 0 0 82%;
          scroll-snap-align: center;
          border-radius: var(--radius-card);
          overflow: hidden;
          border: 1px solid var(--border);
          background: #000;
          aspect-ratio: 4 / 5;
          max-height: 320px;
        }
        @media (min-width: 720px) {
          .cell {
            flex: 0 0 60%;
            aspect-ratio: 4 / 3;
            max-height: 360px;
          }
        }
        .pc-media img,
        .pc-media video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .burst {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          color: rgba(239, 68, 68, 0.9);
          opacity: 0;
          pointer-events: none;
          transform: scale(0.6);
        }
        .burst.go {
          animation: burst 0.5s ease forwards;
        }
        @keyframes burst {
          0% {
            opacity: 0;
            transform: scale(0.6);
          }
          60% {
            opacity: 0.85;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(1.1);
          }
        }
        .pc-body {
          padding: 0 22px 20px;
          display: grid;
          gap: 14px;
        }
        .pc-text {
          margin: 0;
          font-size: 15px;
          line-height: 1.6;
          color: var(--text);
          white-space: pre-wrap;
          word-break: break-word;
        }
        .meta-row {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 12px;
          color: var(--muted);
        }
        .timestamp {
          border: 0;
          background: transparent;
          padding: 0;
          color: inherit;
          font: inherit;
          cursor: default;
        }
        .chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--primary) 35%, var(--border));
          background: color-mix(in oklab, var(--primary) 18%, transparent);
          color: var(--primary);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .chip::before {
          content: "•";
        }
        .edit {
          display: grid;
          gap: 12px;
        }
        .edit-area {
          width: 100%;
          min-height: 120px;
          border-radius: var(--radius-button);
          border: 1px solid color-mix(in oklab, var(--border) 85%, transparent);
          background: var(--bg);
          color: var(--text);
          padding: 12px 14px;
          font: inherit;
          resize: vertical;
        }
        .edit-area:focus {
          outline: none;
          border-color: color-mix(in oklab, var(--primary) 45%, var(--border));
          box-shadow: 0 0 0 4px color-mix(in oklab, var(--primary) 20%, transparent);
        }
        .edit-area:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .edit-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }
        .edit-btn {
          border-radius: var(--radius-button);
          border: 1px solid var(--border);
          background: var(--bg);
          color: var(--text);
          font-weight: 600;
          padding: 9px 16px;
          cursor: pointer;
          transition: transform 0.12s ease, background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
        }
        .edit-btn:hover {
          background: color-mix(in oklab, var(--bg) 82%, var(--primary) 12%);
        }
        .edit-btn:active {
          transform: translateY(1px);
        }
        .edit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        .edit-primary {
          background: var(--primary);
          color: var(--primary-contrast);
          border-color: color-mix(in oklab, var(--primary) 60%, var(--border));
          box-shadow: 0 12px 28px color-mix(in oklab, var(--primary) 25%, transparent);
        }
        .edit-primary:disabled {
          box-shadow: none;
        }
        .edit-ghost {
          background: transparent;
        }
        .edit-error {
          margin: 0;
          font-size: 12px;
          color: #b91c1c;
          border-radius: var(--radius-button);
          border: 1px solid rgba(239, 68, 68, 0.32);
          background: rgba(239, 68, 68, 0.12);
          padding: 8px 10px;
        }
        .pc-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 18px 18px;
          gap: 12px;
        }
        .pc-actions .left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .miniCount {
          font-size: 12px;
          color: var(--muted);
          font-weight: 600;
        }
        .icon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--border) 65%, transparent);
          background: color-mix(in oklab, var(--bg-raised) 92%, transparent);
          color: var(--text);
          cursor: pointer;
          transition: transform 0.12s ease, background 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
        }
        .icon:hover {
          background: color-mix(in oklab, var(--primary) 12%, var(--bg-raised));
          border-color: color-mix(in oklab, var(--primary) 20%, var(--border));
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.12);
        }
        .icon:active {
          transform: translateY(1px);
        }
        .icon[disabled] {
          opacity: 0.55;
          cursor: not-allowed;
          box-shadow: none;
        }
        .icon.active {
          color: #ef4444;
        }
        .reportBackdrop {
          position: fixed;
          inset: 0;
          background: color-mix(in oklab, #000 60%, transparent);
          display: grid;
          place-items: center;
          padding: 16px;
          z-index: 1200;
        }
        .reportModal {
          width: min(440px, 100%);
          background: var(--bg-raised);
          border: 1px solid var(--border);
          border-radius: var(--radius-card);
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.4);
          padding: 20px 22px;
          display: grid;
          gap: 14px;
        }
        .reportModal h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
          color: var(--text);
        }
        .reportModal p {
          margin: 0;
          font-size: 14px;
          color: var(--muted);
        }
        .reportReason {
          width: 100%;
          min-height: 120px;
          border-radius: var(--radius-button);
          border: 1px solid var(--border);
          background: var(--bg);
          color: var(--text);
          padding: 12px 14px;
          font: inherit;
          resize: vertical;
        }
        .reportReason:focus {
          outline: none;
          border-color: color-mix(in oklab, var(--primary) 45%, var(--border));
          box-shadow: 0 0 0 4px color-mix(in oklab, var(--primary) 18%, transparent);
        }
        .reportError {
          margin: 0;
          color: #b91c1c;
          font-size: 13px;
          border-radius: var(--radius-button);
          border: 1px solid rgba(239, 68, 68, 0.32);
          background: rgba(239, 68, 68, 0.12);
          padding: 8px 10px;
        }
        .reportSuccess {
          margin: 0;
          color: #0f766e;
          font-size: 13px;
          border-radius: var(--radius-button);
          border: 1px solid rgba(45, 212, 191, 0.32);
          background: rgba(45, 212, 191, 0.12);
          padding: 8px 10px;
        }
        .reportActions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }
        .reportBtn {
          border-radius: var(--radius-button);
          border: 1px solid var(--border);
          background: var(--bg);
          color: var(--text);
          font-weight: 600;
          padding: 9px 16px;
          cursor: pointer;
          transition: transform 0.12s ease, background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
        }
        .reportBtn:hover {
          background: color-mix(in oklab, var(--bg) 82%, var(--primary) 12%);
        }
        .reportBtn:active {
          transform: translateY(1px);
        }
        .reportBtn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        .reportPrimary {
          background: var(--primary);
          color: var(--primary-contrast);
          border-color: color-mix(in oklab, var(--primary) 60%, var(--border));
          box-shadow: 0 12px 28px color-mix(in oklab, var(--primary) 25%, transparent);
        }
        .reportPrimary:disabled {
          box-shadow: none;
        }
      `}</style>
    </>
  );
}


