// components/posts/PostCard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { hardDeletePost } from "@/lib/HardDelete";
import { addMediaToPost, removeMediaFromPost, MediaItem } from "@/lib/postMedia";

type Author = {
  username?: string | null;
  displayName?: string | null;
  avatarURL?: string | null;
} | null;

type Post = {
  id: string;
  uid: string;
  text?: string | null;
  imageURL?: string | null;   // legacy single image
  media?: MediaItem[];        // modern media array
  createdAt?: any;
  author?: Author;
  isRepost?: boolean;
};

type Props = { post: Post; meUid?: string | null };

export default function PostCard({ post, meUid }: Props) {
  const router = useRouter();

  // counts
  const [likes, setLikes] = useState(0);
  const [reposts, setReposts] = useState(0);
  const [comments, setComments] = useState(0);

  // my interactions
  const [iLiked, setILiked] = useState(false);
  const [iReposted, setIReposted] = useState(false);

  // busy flags
  const [busyLike, setBusyLike] = useState(false);
  const [busyRepost, setBusyRepost] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [adding, setAdding] = useState(false);

  // ui state
  const [editing, setEditing] = useState(false);
  const [textDraft, setTextDraft] = useState(post.text ?? "");
  const [showConfirm, setShowConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const meUidLocal = meUid ?? auth.currentUser?.uid ?? null;
  const isOwner = meUidLocal === post.uid;

  // live counters
  useEffect(() => {
    const stopLikes = onSnapshot(collection(db, "posts", post.id, "likes"), s => setLikes(s.size));
    const stopReposts = onSnapshot(collection(db, "posts", post.id, "reposts"), s => setReposts(s.size));
    const stopComments = onSnapshot(collection(db, "posts", post.id, "comments"), s => setComments(s.size));
    return () => { stopLikes(); stopReposts(); stopComments(); };
  }, [post.id]);

  // my like/repost flags
  useEffect(() => {
    if (!meUidLocal) { setILiked(false); setIReposted(false); return; }
    const likeRef = doc(db, "posts", post.id, "likes", meUidLocal);
    const repRef  = doc(db, "posts", post.id, "reposts", meUidLocal);
    const stop1 = onSnapshot(likeRef, (snap) => setILiked(snap.exists()));
    const stop2 = onSnapshot(repRef,  (snap) => setIReposted(snap.exists()));
    return () => { stop1(); stop2(); };
  }, [post.id, meUidLocal]);

  async function toggleLike(e?: React.MouseEvent) {
    e?.stopPropagation();
    if (!meUidLocal) return setErr("Please sign in to like.");
    setErr(null); setBusyLike(true);
    try {
      const ref = doc(db, "posts", post.id, "likes", meUidLocal);
      if (iLiked) await deleteDoc(ref); else await setDoc(ref, { createdAt: serverTimestamp() });
    } catch (e: any) {
      setErr(`Failed to like: ${e?.code || e?.message || "unknown error"}`);
    } finally { setBusyLike(false); }
  }

  async function toggleRepost(e?: React.MouseEvent) {
    e?.stopPropagation();
    if (!meUidLocal) return setErr("Please sign in to repost.");
    setErr(null); setBusyRepost(true);
    try {
      const ref = doc(db, "posts", post.id, "reposts", meUidLocal);
      if (iReposted) await deleteDoc(ref); else await setDoc(ref, { createdAt: serverTimestamp() });
    } catch (e: any) {
      setErr(`Failed to repost: ${e?.code || e?.message || "unknown error"}`);
    } finally { setBusyRepost(false); }
  }

  /** OPEN CONFIRM MODAL */
  function deletePost(e?: React.MouseEvent) {
    e?.stopPropagation();
    setErr(null);
    setShowConfirm(true);
  }

  /** YOUR REQUESTED confirmDelete VERSION */
  async function confirmDelete() {
    const me = auth.currentUser?.uid || null;
    if (!me) {
      setErr("Please sign in.");
      return;
    }
    if (post.uid !== me) {
      setErr(`You can only delete your own post. (post.uid=${post.uid}, you=${me})`);
      return;
    }
    setBusyDelete(true);
    try {
      await hardDeletePost(post.id, post.uid, post.media);
      setShowConfirm(false);
    } catch (e: any) {
      setErr(e?.message || "Failed to delete.");
    } finally {
      setBusyDelete(false);
    }
  }

  async function saveEdit() {
    if (!isOwner) return;
    try {
      await updateDoc(doc(db, "posts", post.id), {
        text: textDraft.trim() || null,
        updatedAt: serverTimestamp(),
      });
      setEditing(false);
    } catch (e: any) {
      setErr(`Failed to save: ${e?.code || e?.message || "unknown error"}`);
    }
  }

  const created = useMemo(() => {
    const ts: any = post.createdAt;
    if (!ts) return null;
    if (typeof ts?.toDate === "function") return ts.toDate();
    if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000);
    return null;
  }, [post.createdAt]);

  const authorName =
    post.author?.username ||
    post.author?.displayName ||
    (post.uid ? post.uid.slice(0, 6) : "Unknown");

  function openThread() {
    if (!showConfirm) router.push(`/posts/${post.id}`);
  }

  // media to render (fallback to legacy imageURL)
  const media: MediaItem[] =
    Array.isArray(post.media) && post.media.length > 0
      ? post.media.slice(0, 4)
      : post.imageURL
      ? [{ mid: "legacy", type: "image", url: post.imageURL, storagePath: "" } as any]
      : [];

  async function onPickMoreMedia(e: React.ChangeEvent<HTMLInputElement>) {
    e.stopPropagation();
    if (!isOwner || !meUidLocal) return;
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setErr(null);
    setAdding(true);
    setProgress(0);
    try {
      await addMediaToPost({
        uid: meUidLocal,
        postId: post.id,
        files,
        limit: 4,
        onProgress: (p) => setProgress(p),
      });
    } catch (e: any) {
      const msg = String(e?.message || e);
      const low = msg.toLowerCase();
      setErr(
        low.includes("appcheck") || low.includes("permission")
          ? "Upload blocked by App Check / permissions. Verify your debug token and Storage rules."
          : msg
      );
    } finally {
      setAdding(false);
      setProgress(1);
      (e.target as HTMLInputElement).value = "";
    }
  }

  async function onRemove(item: MediaItem, e?: React.MouseEvent) {
    e?.stopPropagation();
    if (!isOwner) return;
    try { await removeMediaFromPost({ postId: post.id, item }); }
    catch (e: any) { setErr(`Failed to remove media: ${e?.code || e?.message || "unknown error"}`); }
  }

  return (
    <article
      className="card"
      role="button"
      tabIndex={0}
      onClick={openThread}
      onKeyDown={(e) => { if (e.key === "Enter") openThread(); }}
    >
      <header className="head" onClick={(e) => e.stopPropagation()}>
        <div className="who">
          {post.author?.avatarURL
            ? <img className="avatar" src={post.author.avatarURL} alt="" />
            : <div className="avatar ph">{(authorName[0] || "U").toUpperCase()}</div>}
          <div className="names">
            <div className="name">{authorName}</div>
            {created && (
              <div className="time">
                {created.toLocaleDateString()}{" "}
                {created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
          </div>
        </div>

        {isOwner && !editing && (
          <div className="ownerActions">
            <button
              className="btn"
              onClick={(e) => { e.stopPropagation(); setEditing(true); setTextDraft(post.text ?? ""); }}
            >
              Edit
            </button>

            <label className="btn" onClick={(e) => e.stopPropagation()}>
              {adding ? `Uploading… ${Math.round(progress * 100)}%` : "Add media"}
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={onPickMoreMedia}
                style={{ display: "none" }}
                disabled={adding}
                aria-disabled={adding}
              />
            </label>

            <button className="btn danger" onClick={deletePost}>
              Delete
            </button>
          </div>
        )}
      </header>

      {editing ? (
        <div className="editWrap" onClick={(e) => e.stopPropagation()}>
          <textarea className="ta" rows={3} value={textDraft} onChange={(e) => setTextDraft(e.target.value)} />
          <div className="bar">
            <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn primary" onClick={saveEdit}>Save</button>
          </div>
        </div>
      ) : (
        <>
          {post.text ? <p className="text">{post.text}</p> : null}

          {media.length > 0 && (
            <div className={`media grid-${Math.min(4, media.length)}`} onClick={(e) => e.stopPropagation()}>
              {media.map((m, i) => (
                <div key={m.mid ?? i} className="mCell">
                  {m.type === "video"
                    ? <video src={m.url} controls playsInline preload="metadata" />
                    : <img src={m.url} alt="" />}
                  {isOwner && m.storagePath ? (
                    <button className="rm" onClick={(e) => onRemove(m, e)} title="Remove media">✕</button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {err ? <p className="bad" onClick={(e) => e.stopPropagation()}>{err}</p> : null}

      <footer className="bar" onClick={(e) => e.stopPropagation()}>
        <button className="btn" onClick={openThread} title="Open thread">💬 {comments}</button>
        <button
          className={`btn ${iLiked ? "active" : ""}`}
          onClick={toggleLike}
          disabled={busyLike}
          aria-pressed={iLiked}
          aria-disabled={busyLike}
          title="Like"
        >
          ❤️ {likes}
        </button>
        <button
          className={`btn ${iReposted ? "active" : ""}`}
          onClick={toggleRepost}
          disabled={busyRepost}
          aria-pressed={iReposted}
          aria-disabled={busyRepost}
          title="Repost"
        >
          🔁 {reposts}
        </button>
      </footer>

      {showConfirm && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { e.stopPropagation(); setShowConfirm(false); }}
          onKeyDown={(e) => { if (e.key === "Escape") setShowConfirm(false); }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modalTitle">Delete post?</h3>
            <p className="modalText">This action can’t be undone.</p>
            <div className="modalRow">
              <button className="btn" onClick={() => setShowConfirm(false)} disabled={busyDelete}>
                Cancel
              </button>
              <button className="btn danger" onClick={confirmDelete} disabled={busyDelete} autoFocus>
                {busyDelete ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .card {
          border: 1px solid var(--border);
          background: var(--card-bg);
          color: var(--text);
          border-radius: 12px;
          padding: 12px;
          cursor: pointer;
          box-shadow: 0 10px 30px color-mix(in oklab, #000 6%, transparent);
        }
        .card:focus { outline: 2px solid var(--primary); outline-offset: 2px; }

        .head { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
        .who { display:flex; gap:10px; align-items:center; }
        .avatar { width:36px; height:36px; border-radius:999px; object-fit:cover; border:1px solid var(--border); }
        .avatar.ph { width:36px; height:36px; border-radius:999px; display:grid; place-items:center; background:var(--bg2); color:var(--text); font-weight:700; border:1px solid var(--border); }
        .names { line-height:1.2; }
        .name { font-weight:600; color:var(--text); }
        .time { font-size:12px; color:var(--muted); }

        .text { margin:8px 0; color:var(--text); white-space:pre-wrap; word-wrap:break-word; overflow-wrap:anywhere; }

        .ownerActions { display:flex; gap:8px; align-items:center; }

        .rm {
          position:absolute; top:6px; right:6px;
          border:none; background:var(--primary); color:var(--primary-contrast);
          border-radius:8px; padding:2px 7px; cursor:pointer;
        }

        .media { margin-top:8px; display:grid; gap:8px; }
        .media img, .media video {
          width:100%; height:100%; object-fit:cover; display:block;
          border-radius:10px; border:1px solid var(--border); background:#000;
        }
        .media.grid-1 { grid-template-columns: 1fr; }
        .media.grid-2 { grid-template-columns: 1fr 1fr; }
        .media.grid-3 { grid-template-columns: 2fr 1fr; grid-auto-rows: 180px; }
        .media.grid-3 .mCell:nth-child(1){ grid-row: 1 / span 2; }
        .media.grid-4 { grid-template-columns: 1fr 1fr; grid-auto-rows: 160px; }
        .mCell { position:relative; }

        .editWrap { display:grid; gap:8px; margin-top:6px; }
        .ta {
          width:100%; border:1px solid var(--border); border-radius:10px; padding:8px 10px;
          background: var(--bg2); color: var(--text);
        }

        .bar { display:flex; gap:8px; margin-top:10px; }
        .btn {
          border:1px solid var(--border);
          background: var(--bg2);
          color: var(--text);
          border-radius:10px;
          padding:6px 10px;
          cursor:pointer;
        }
        .btn:hover { border-color: var(--primary); background: color-mix(in oklab, var(--bg2) 75%, var(--primary) 25%); }
        .btn.active, .btn.primary { background: var(--primary); color: var(--primary-contrast); border-color: var(--primary); }
        .btn.primary:hover { opacity:.95; }
        .btn.danger {
          background: color-mix(in oklab, #ef4444 15%, var(--card-bg));
          color: color-mix(in oklab, #7f1d1d 70%, var(--text) 30%);
          border-color: color-mix(in oklab, #ef4444 35%, var(--border));
        }

        .bad {
          margin-top:8px;
          background: color-mix(in oklab, #ef4444 15%, transparent);
          color: color-mix(in oklab, #7f1d1d 70%, var(--text) 30%);
          border:1px solid color-mix(in oklab, #ef4444 35%, var(--border));
          border-radius:8px; padding:6px 8px; font-size:12px;
        }

        .overlay { position:fixed; inset:0; background:rgba(2,6,23,.45); display:grid; place-items:center; padding:16px; z-index:1000; }
        .modal {
          width:100%; max-width:420px;
          background:var(--card-bg);
          border-radius:14px; border:1px solid var(--border);
          box-shadow:0 24px 60px rgba(0,0,0,.2); padding:16px;
        }
        .modalTitle { margin:0 0 6px; font-size:18px; font-weight:800; color:var(--text); }
        .modalText { margin:0 0 12px; color:var(--muted); }
        .modalRow { display:flex; gap:10px; justify-content:flex-end; }
      `}</style>
    </article>
  );
}
