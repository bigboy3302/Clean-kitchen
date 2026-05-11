"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebas1e";
import { collection, onSnapshot, query } from "firebase/firestore";
import Avatar from "@/components/ui/Avatar";
import { useAuthModal } from "@/context/AuthModalContext";

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

function profileSlug(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const withoutOrigin = raw.replace(/^https?:\/\/[^/]+/i, "");
  const parts = withoutOrigin.split("/").filter(Boolean);
  const last = parts[0] === "u" && parts[1] ? parts[1] : parts[parts.length - 1] || withoutOrigin;
  return last.replace(/^@+/, "").trim();
}

function timeAgo(ts: Post["createdAt"]) {
  const secondsFromTimestamp = (value: unknown): number => {
    if (typeof value !== "object" || value === null) return 0;
    if ("seconds" in value && typeof (value as { seconds?: unknown }).seconds === "number") {
      return (value as { seconds: number }).seconds;
    }
    return 0;
  };

  if (!ts) return "";
  const sec =
    typeof ts === "number"
      ? ts
      : typeof ts === "string"
        ? (() => {
            const parsed = Date.parse(ts);
            return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
          })()
        : secondsFromTimestamp(ts);
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
  const { openLogin } = useAuthModal();
  const { text, media = [], author = {}, createdAt } = post || {};
  const [sessionUid, setSessionUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const viewerUid = meUid ?? sessionUid;
  const isOwner = !!(viewerUid && post?.uid && viewerUid === post.uid);
  const createdAtLabel = useMemo(() => timeAgo(createdAt), [createdAt]);
  const hasMedia = media && media.length > 0;

  const [likes, setLikes] = useState<number>(Math.max(0, post?.likes || 0));
  const [reposts, setReposts] = useState<number>(Math.max(0, post?.reposts || 0));
  const [liked, setLiked] = useState<boolean>(false);
  const [hasReposted, setHasReposted] = useState<boolean>(false);

  const [lightbox, setLightbox] = useState<string | null>(null);
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
    const stop = onAuthStateChanged(auth, (user) => {
      setSessionUid(user?.uid ?? null);
    });
    return () => stop();
  }, []);

  useEffect(() => {
    if (!post?.id) return;
    const likesCol = collection(db, "posts", post.id, "likes");
    const stopLikes = onSnapshot(query(likesCol), (snap) => {
      setLikes(snap.size);
      if (viewerUid) setLiked(snap.docs.some(d => d.id === viewerUid));
    });
    const repostsCol = collection(db, "posts", post.id, "reposts");
    const stopReposts = onSnapshot(query(repostsCol), (snap) => {
      setReposts(snap.size);
      if (viewerUid) setHasReposted(snap.docs.some(d => d.id === viewerUid));
    });
    return () => { stopLikes(); stopReposts(); };
  }, [post?.id, viewerUid]);

  useEffect(() => {
    if (!editing) setDraft(text || "");
  }, [text, editing]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { setMenuOpen(false); setLightbox(null); }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  useEffect(() => () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); }, []);

  function ensureCanLike(): boolean {
    if (!viewerUid) { openLogin(`/posts/${post?.id ?? ""}`); return false; }
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
    if (!onEdit) { setEditing(false); return; }
    const next = draft.replace(/\r/g, "");
    const trimmed = next.trim();
    const current = (text || "").trim();
    if (trimmed === current) { setEditing(false); return; }
    setEditBusy(true);
    setEditError("");
    try {
      await onEdit(post, trimmed);
      setEditing(false);
      setDraft(trimmed);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      setJustSaved(true);
      savedTimerRef.current = setTimeout(() => setJustSaved(false), 2200);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : typeof err === "string" ? err : "Unable to update post."
      );
    } finally {
      setEditBusy(false);
    }
  }

  function handleEditKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); saveEdit(); }
    if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
  }

  function openReportDialog() {
    if (!viewerUid) { openLogin(`/posts/${post?.id ?? ""}`); return; }
    setReportReason(""); setReportError(""); setReportSent(false); setReportOpen(true);
  }
  function closeReportDialog() {
    if (reportBusy) return;
    setReportOpen(false); setReportReason(""); setReportError(""); setReportSent(false);
  }
  async function submitReport() {
    if (!viewerUid) { openLogin(`/posts/${post?.id ?? ""}`); return; }
    const trimmedReason = reportReason.trim();
    if (trimmedReason.length < 10) {
      setReportError("Please provide at least 10 characters so we can understand the issue.");
      return;
    }
    if (!post?.id || !onReport) { setReportOpen(false); return; }
    setReportBusy(true); setReportError("");
    try {
      const origin = typeof window !== "undefined" && window.location ? window.location.origin : undefined;
      await onReport(post, {
        reason: trimmedReason,
        postUrl: origin ? `${origin.replace(/\/$/, "")}/posts/${post.id}` : `/posts/${post.id}`,
      });
      setReportSent(true);
      setTimeout(() => closeReportDialog(), 1600);
    } catch (err) {
      setReportError(
        err instanceof Error ? err.message : typeof err === "string" ? err : "Failed to submit report."
      );
    } finally {
      setReportBusy(false);
    }
  }

  const displayName = author?.displayName || author?.username || "User";
  const profileHref = `/u/${profileSlug(author?.username) || profileSlug(post.uid)}`;
  const threadHref = `/posts/${post.id}`;
  const displayText = editing ? draft : justSaved ? draft : text || "";

  return (
    <>
      <article className="pc">
        <div className="pc-inner">
          {/* avatar column */}
          <Link href={profileHref} aria-label={`${displayName} profile`} className="avatar-col">
            <Avatar src={author?.avatarURL || undefined} name={displayName} size={42} />
          </Link>

          {/* content column */}
          <div className="pc-col">
            {/* name row + menu */}
            <div className="pc-hdr">
              <div className="pc-nameRow">
                <Link href={profileHref} className="pc-nameLink">{displayName}</Link>
                {author?.username
                  ? <span className="pc-uname">@{author.username}</span>
                  : null}
                {createdAtLabel ? (
                  <>
                    <span className="pc-dot" aria-hidden>·</span>
                    <span className="pc-time">{createdAtLabel}</span>
                  </>
                ) : null}
              </div>

              <div className="pc-menu" ref={menuRef}>
                <button
                  className="menu-btn"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Post options"
                  onClick={() => setMenuOpen(o => !o)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                  </svg>
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
                          onClick={() => { setMenuOpen(false); fileInputRef.current?.click(); }}
                        >
                          Add media
                        </button>
                        <hr className="sep" aria-hidden />
                        <button
                          type="button"
                          className="mi danger"
                          role="menuitem"
                          onClick={() => { setMenuOpen(false); onDelete?.(post); }}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="mi"
                        role="menuitem"
                        onClick={() => { setMenuOpen(false); openReportDialog(); }}
                      >
                        Report post
                      </button>
                    )}
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleAddMediaChange} style={{display:"none"}} />
              </div>
            </div>

            {/* body */}
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
                  <button type="button" className="edit-btn edit-ghost" onClick={cancelEdit} disabled={editBusy}>Cancel</button>
                  <button type="button" className="edit-btn edit-primary" onClick={saveEdit} disabled={editBusy}>
                    {editBusy ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </div>
            ) : displayText ? (
              <p className="pc-text">
                {displayText}
                {justSaved ? <span className="chip">Updated</span> : null}
              </p>
            ) : justSaved ? (
              <span className="chip">Updated</span>
            ) : null}

            {/* media */}
            {hasMedia ? (
              <div className={`pc-media ${media.length === 1 ? "solo" : "multi"}`} onDoubleClick={onDoubleTap}>
                <div ref={likeBurstRef} className="burst" aria-hidden>
                  <svg viewBox="0 0 24 24" width="64" height="64">
                    <path d="M12.1 8.64l-.1.1-.11-.11C10.14 6.8 7.1 6.8 5.35 8.56c-1.76 1.75-1.76 4.6 0 6.36l6.07 6.07c.32.32.85.32 1.18 0l6.06-6.07c1.76-1.76 1.76-4.6 0-6.36-1.76-1.76-4.8-1.76-6.56 0z" fill="currentColor"/>
                  </svg>
                </div>

                {media.length === 1 ? (
                  media[0].type === "video" ? (
                    <video src={media[0].url} controls playsInline preload="metadata" className="soloVideo" />
                  ) : (
                    <div className="soloImg">
                      <button type="button" className="imgBtn" onClick={() => setLightbox(media[0].url)} aria-label="View full image">
                        <Image src={media[0].url} alt="" fill sizes="(max-width: 768px) 90vw, 560px" className="mediaImg" />
                      </button>
                    </div>
                  )
                ) : (
                  <div className="rail" tabIndex={0} aria-label="Post media">
                    {media.map((m, i) => (
                      <div key={i} className="cell">
                        {m.type === "video" ? (
                          <video src={m.url} controls playsInline preload="metadata" />
                        ) : (
                          <button type="button" className="imgBtn" onClick={() => setLightbox(m.url)} aria-label="View full image">
                            <Image src={m.url} alt="" fill sizes="(max-width: 768px) 60vw, 360px" className="mediaImg" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* actions */}
            <div className="pc-actions">
              <button className={`act ${liked ? "act-liked" : ""}`} onClick={toggleLike} aria-pressed={liked} aria-label="Like">
                <svg width="18" height="18" viewBox="0 0 24 24">
                  {liked
                    ? <path d="M12.1 8.64l-.1.1-.11-.11C10.14 6.8 7.1 6.8 5.35 8.56c-1.76 1.75-1.76 4.6 0 6.36l6.07 6.07c.32.32.85.32 1.18 0l6.06-6.07c1.76-1.76 1.76-4.6 0-6.36-1.76-1.76-4.8-1.76-6.56 0z" fill="currentColor"/>
                    : <path d="M12.1 8.64l-.1.1-.11-.11C10.14 6.8 7.1 6.8 5.35 8.56c-1.76 1.75-1.76 4.6 0 6.36l6.07 6.07c.32.32.85.32 1.18 0l6.06-6.07c1.76-1.76 1.76-4.6 0-6.36-1.76-1.76-4.8-1.76-6.56 0z" stroke="currentColor" strokeWidth="1.5" fill="none"/>}
                </svg>
                {likes > 0 && <span className="actCount">{likes}</span>}
              </button>

              <Link href={threadHref} className="act" aria-label="Open thread">
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M21 12a8.5 8.5 0 01-8.5 8.5H6l-3 3 .5-4.8A8.5 8.5 0 1121 12z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>

              <button
                className={`act ${hasReposted ? "act-reposted" : ""}`}
                aria-label="Repost"
                onClick={toggleRepost}
                disabled={!meUid}
                title={hasReposted ? "Undo repost" : "Repost"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M7 7h8a4 4 0 014 4v1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M9 17H7a4 4 0 01-4-4v-1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M14 4l3 3-3 3M10 20l-3-3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {reposts > 0 && <span className="actCount">{reposts}</span>}
              </button>
            </div>
          </div>
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
                <p className="reportSuccess">Report sent. Thank you for keeping the community safe.</p>
              ) : null}
              <div className="reportActions">
                <button type="button" className="reportBtn" onClick={closeReportDialog} disabled={reportBusy}>Cancel</button>
                <button type="button" className="reportBtn reportPrimary" onClick={submitReport} disabled={reportBusy || reportSent}>
                  {reportBusy ? "Sending..." : "Send report"}
                </button>
              </div>
            </div>
          </div>
        )}
      </article>

      {lightbox && (
        <div className="lbBackdrop" role="dialog" aria-modal onClick={() => setLightbox(null)}>
          <button type="button" className="lbClose" onClick={() => setLightbox(null)} aria-label="Close">✕</button>
          <div className="lbImgWrap" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="" className="lbImg" />
          </div>
        </div>
      )}

      <style jsx>{`
        /* ── card ── */
        .pc {
          background: var(--bg-raised);
          border: 1px solid var(--border);
          border-radius: var(--radius-card);
          box-shadow: var(--shadow);
          overflow: hidden;
        }
        .pc-inner {
          display: flex;
          gap: 12px;
          padding: 16px 18px 0;
        }
        .avatar-col {
          display: block;
          flex-shrink: 0;
          padding-top: 2px;
          line-height: 0;
        }
        .pc-col {
          flex: 1;
          min-width: 0;
          display: grid;
          gap: 10px;
          padding-bottom: 4px;
        }

        /* ── header ── */
        .pc-hdr {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
          min-width: 0;
        }
        .pc-nameRow {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-wrap: wrap;
          min-width: 0;
          flex: 1;
          padding-top: 2px;
        }
        .pc-nameLink {
          font-weight: 700;
          font-size: 15px;
          color: var(--text);
          text-decoration: none;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pc-nameLink:hover { text-decoration: underline; }
        .pc-uname {
          font-size: 13px;
          color: var(--muted);
          white-space: nowrap;
        }
        .pc-dot {
          color: var(--muted);
          font-size: 13px;
          flex-shrink: 0;
        }
        .pc-time {
          font-size: 13px;
          color: var(--muted);
          white-space: nowrap;
        }

        /* ── menu ── */
        .pc-menu { position: relative; z-index: 10; flex-shrink: 0; }
        .menu-btn {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border-radius: var(--radius-button);
          border: 1px solid color-mix(in oklab, var(--border) 65%, transparent);
          background: transparent;
          color: var(--muted);
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .menu-btn:hover {
          background: color-mix(in oklab, var(--primary) 10%, var(--bg-raised));
          color: var(--text);
        }
        .menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 190px;
          padding: 8px;
          display: grid;
          gap: 3px;
          border-radius: var(--radius-card);
          background: var(--bg-raised);
          border: 1px solid var(--border);
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
          z-index: 20;
        }
        .mi {
          width: 100%;
          border: 0;
          background: transparent;
          color: var(--text);
          font-size: 14px;
          font-weight: 600;
          padding: 9px 12px;
          border-radius: var(--radius-button);
          text-align: left;
          cursor: pointer;
          transition: background 0.13s;
        }
        .mi:hover { background: color-mix(in oklab, var(--primary) 10%, transparent); }
        .mi.danger { color: #e11d48; }
        .mi.danger:hover { background: rgba(225, 29, 72, 0.11); }
        .sep { height: 1px; border: 0; background: var(--border); margin: 3px 0; }

        /* ── body text ── */
        .pc-text {
          margin: 0;
          font-size: 15px;
          line-height: 1.65;
          color: var(--text);
          white-space: pre-wrap;
          word-break: break-word;
        }
        .chip {
          display: inline-flex;
          align-items: center;
          padding: 2px 7px;
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--primary) 30%, var(--border));
          background: color-mix(in oklab, var(--primary) 12%, transparent);
          color: var(--primary);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          vertical-align: middle;
          margin-left: 8px;
        }

        /* ── edit ── */
        .edit { display: grid; gap: 10px; }
        .edit-area {
          width: 100%;
          min-height: 110px;
          border-radius: var(--radius-button);
          border: 1px solid color-mix(in oklab, var(--border) 85%, transparent);
          background: var(--bg);
          color: var(--text);
          padding: 11px 13px;
          font: inherit;
          resize: vertical;
        }
        .edit-area:focus {
          outline: none;
          border-color: color-mix(in oklab, var(--primary) 45%, var(--border));
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 16%, transparent);
        }
        .edit-area:disabled { opacity: 0.65; cursor: not-allowed; }
        .edit-actions { display: flex; justify-content: flex-end; gap: 8px; }
        .edit-btn {
          border-radius: var(--radius-button);
          border: 1px solid var(--border);
          background: var(--bg);
          color: var(--text);
          font-weight: 600;
          padding: 8px 15px;
          cursor: pointer;
          transition: background 0.13s;
        }
        .edit-btn:hover { background: color-mix(in oklab, var(--bg) 80%, var(--primary) 12%); }
        .edit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .edit-primary { background: var(--primary); color: var(--primary-contrast); border-color: transparent; }
        .edit-ghost { background: transparent; }
        .edit-error {
          margin: 0;
          font-size: 12px;
          color: #b91c1c;
          border-radius: var(--radius-button);
          border: 1px solid rgba(239,68,68,0.28);
          background: rgba(239,68,68,0.09);
          padding: 7px 10px;
        }

        /* ── media ── */
        .pc-media { position: relative; }
        /* single video */
        .soloVideo {
          width: 100%;
          display: block;
          max-height: 440px;
          background: #000;
          border-radius: 16px;
          border: 1px solid var(--border);
        }
        /* single image */
        .soloImg {
          position: relative;
          aspect-ratio: 16 / 9;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid var(--border);
          background: var(--bg);
        }
        /* multi */
        .rail {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 4px;
        }
        .rail::-webkit-scrollbar { height: 4px; }
        .rail::-webkit-scrollbar-thumb {
          background: color-mix(in oklab, var(--primary) 22%, var(--border));
          border-radius: 999px;
        }
        .cell {
          flex: 0 0 74%;
          scroll-snap-align: center;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid var(--border);
          background: #000;
          aspect-ratio: 4 / 3;
          position: relative;
        }
        @media (min-width: 560px) {
          .cell { flex: 0 0 62%; }
        }
        .burst {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          color: rgba(239,68,68,0.9);
          opacity: 0;
          pointer-events: none;
          transform: scale(0.6);
          z-index: 2;
        }
        .burst.go { animation: burst 0.5s ease forwards; }
        @keyframes burst {
          0%   { opacity: 0; transform: scale(0.6); }
          60%  { opacity: 0.85; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.1); }
        }
        .pc-media :global(.mediaImg) { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cell video { width: 100%; height: 100%; object-fit: cover; display: block; }
        .imgBtn {
          position: absolute;
          inset: 0;
          border: 0;
          background: transparent;
          padding: 0;
          cursor: zoom-in;
          display: block;
        }
        .imgBtn:hover::after {
          content: "";
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.07);
          pointer-events: none;
        }

        /* ── actions ── */
        .pc-actions {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 2px 0 12px;
          margin-left: -8px;
        }
        .act {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 7px 10px;
          border-radius: 999px;
          border: 0;
          background: transparent;
          color: var(--muted);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.14s, color 0.14s;
          text-decoration: none;
          line-height: 1;
        }
        .act:hover {
          background: color-mix(in oklab, var(--primary) 10%, transparent);
          color: var(--primary);
        }
        .act.act-liked { color: #ef4444; }
        .act.act-liked:hover { background: rgba(239,68,68,0.1); color: #ef4444; }
        .act.act-reposted { color: #22c55e; }
        .act.act-reposted:hover { background: rgba(34,197,94,0.1); color: #22c55e; }
        .act[disabled] { opacity: 0.38; cursor: not-allowed; pointer-events: none; }
        .actCount { font-size: 13px; font-weight: 600; }

        /* ── report dialog ── */
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
          box-shadow: 0 24px 60px rgba(15,23,42,0.4);
          padding: 20px 22px;
          display: grid;
          gap: 14px;
        }
        .reportModal h3 { margin: 0; font-size: 20px; font-weight: 800; color: var(--text); }
        .reportModal p { margin: 0; font-size: 14px; color: var(--muted); }
        .reportReason {
          width: 100%;
          min-height: 110px;
          border-radius: var(--radius-button);
          border: 1px solid var(--border);
          background: var(--bg);
          color: var(--text);
          padding: 11px 13px;
          font: inherit;
          resize: vertical;
        }
        .reportReason:focus {
          outline: none;
          border-color: color-mix(in oklab, var(--primary) 45%, var(--border));
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 16%, transparent);
        }
        .reportError {
          margin: 0; color: #b91c1c; font-size: 13px;
          border-radius: var(--radius-button);
          border: 1px solid rgba(239,68,68,0.28);
          background: rgba(239,68,68,0.09);
          padding: 8px 10px;
        }
        .reportSuccess {
          margin: 0; color: #0f766e; font-size: 13px;
          border-radius: var(--radius-button);
          border: 1px solid rgba(45,212,191,0.28);
          background: rgba(45,212,191,0.09);
          padding: 8px 10px;
        }
        .reportActions { display: flex; justify-content: flex-end; gap: 10px; }
        .reportBtn {
          border-radius: var(--radius-button);
          border: 1px solid var(--border);
          background: var(--bg);
          color: var(--text);
          font-weight: 600;
          padding: 9px 16px;
          cursor: pointer;
          transition: background 0.13s;
        }
        .reportBtn:hover { background: color-mix(in oklab, var(--bg) 80%, var(--primary) 12%); }
        .reportBtn:disabled { opacity: 0.6; cursor: not-allowed; }
        .reportPrimary { background: var(--primary); color: var(--primary-contrast); border-color: transparent; }

        /* ── lightbox ── */
        .lbBackdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.92);
          display: grid;
          place-items: center;
          padding: 16px;
          z-index: 2000;
          cursor: zoom-out;
          animation: lbIn 0.18s ease;
        }
        @keyframes lbIn { from { opacity: 0; } to { opacity: 1; } }
        .lbClose {
          position: fixed;
          top: 16px; right: 20px;
          width: 40px; height: 40px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.22);
          background: rgba(255,255,255,0.1);
          color: #fff;
          font-size: 18px;
          display: grid;
          place-items: center;
          cursor: pointer;
          z-index: 2001;
          transition: background 0.14s;
        }
        .lbClose:hover { background: rgba(255,255,255,0.2); }
        .lbImgWrap {
          max-width: min(90vw, 1100px);
          max-height: 90vh;
          cursor: default;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .lbImg {
          max-width: 100%;
          max-height: 90vh;
          border-radius: 12px;
          object-fit: contain;
          box-shadow: 0 24px 80px rgba(0,0,0,0.6);
        }
      `}</style>
    </>
  );
}
