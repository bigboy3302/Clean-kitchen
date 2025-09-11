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

type Author = {
  username?: string | null;
  displayName?: string | null;
  avatarURL?: string | null;
};

type Post = {
  id: string;
  uid: string;
  text?: string | null;
  imageURL?: string | null;
  createdAt?: any;
  author?: Author | null;
  isRepost?: boolean;
};

type Props = {
  post: Post;
  meUid?: string | null;
};

export default function PostCard({ post, meUid }: Props) {
  const router = useRouter();

  const [likes, setLikes] = useState(0);
  const [reposts, setReposts] = useState(0);
  const [comments, setComments] = useState(0);

  const [iLiked, setILiked] = useState(false);
  const [iReposted, setIReposted] = useState(false);

  const [busyLike, setBusyLike] = useState(false);
  const [busyRepost, setBusyRepost] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);

  const [editing, setEditing] = useState(false);
  const [textDraft, setTextDraft] = useState(post.text ?? "");

  const [showConfirm, setShowConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const meUidLocal = meUid ?? auth.currentUser?.uid ?? null;
  const isOwner = meUidLocal === post.uid;

  // live counts
  useEffect(() => {
    const stopLikes = onSnapshot(
      collection(db, "posts", post.id, "likes"),
      (snap) => setLikes(snap.size)
    );
    const stopReposts = onSnapshot(
      collection(db, "posts", post.id, "reposts"),
      (snap) => setReposts(snap.size)
    );
    const stopComments = onSnapshot(
      collection(db, "posts", post.id, "comments"),
      (snap) => setComments(snap.size)
    );
    return () => {
      stopLikes();
      stopReposts();
      stopComments();
    };
  }, [post.id]);

  // live “my state”
  useEffect(() => {
    if (!meUidLocal) {
      setILiked(false);
      setIReposted(false);
      return;
    }
    const likeDocRef = doc(db, "posts", post.id, "likes", meUidLocal);
    const repostDocRef = doc(db, "posts", post.id, "reposts", meUidLocal);

    const stop1 = onSnapshot(likeDocRef, (snap) => setILiked(snap.exists()));
    const stop2 = onSnapshot(repostDocRef, (snap) =>
      setIReposted(snap.exists())
    );
    return () => {
      stop1();
      stop2();
    };
  }, [post.id, meUidLocal]);

  async function toggleLike(e?: React.MouseEvent) {
    e?.stopPropagation();
    if (!meUidLocal) {
      setErr("Please sign in to like.");
      return;
    }
    setErr(null);
    setBusyLike(true);
    try {
      const ref = doc(db, "posts", post.id, "likes", meUidLocal);
      if (iLiked) await deleteDoc(ref);
      else await setDoc(ref, { createdAt: serverTimestamp() });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to like.");
    } finally {
      setBusyLike(false);
    }
  }

  async function toggleRepost(e?: React.MouseEvent) {
    e?.stopPropagation();
    if (!meUidLocal) {
      setErr("Please sign in to repost.");
      return;
    }
    setErr(null);
    setBusyRepost(true);
    try {
      const ref = doc(db, "posts", post.id, "reposts", meUidLocal);
      if (iReposted) await deleteDoc(ref);
      else await setDoc(ref, { createdAt: serverTimestamp() });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to repost.");
    } finally {
      setBusyRepost(false);
    }
  }

  // confirm delete modal
  function deletePost(e?: React.MouseEvent) {
    e?.stopPropagation();
    setErr(null);
    setShowConfirm(true);
  }

  async function confirmDelete() {
    if (!meUidLocal) {
      setErr("Please sign in.");
      return;
    }
    if (meUidLocal !== post.uid) {
      setErr("Only the author can delete this post.");
      return;
    }

    setBusyDelete(true);
    try {
      await deleteDoc(doc(db, "posts", post.id));
      setShowConfirm(false);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to delete.");
    } finally {
      setBusyDelete(false);
    }
  }

  async function saveEdit() {
    if (!meUidLocal || meUidLocal !== post.uid) return;
    try {
      await updateDoc(doc(db, "posts", post.id), {
        text: textDraft.trim() || null,
        updatedAt: serverTimestamp(),
      });
      setEditing(false);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save.");
    }
  }

  const created = useMemo(() => {
    const ts = post.createdAt as any;
    if (!ts) return null;
    if (typeof ts.toDate === "function") return ts.toDate();
    if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
    return null;
  }, [post.createdAt]);

  const authorName =
    post.author?.username ||
    post.author?.displayName ||
    (post.uid ? post.uid.slice(0, 6) : "Unknown");

  function openThread() {
    router.push(`/posts/${post.id}`);
  }

  return (
    <article
      className="card"
      role="button"
      tabIndex={0}
      onClick={openThread}
      onKeyDown={(e) => {
        if (e.key === "Enter") openThread();
      }}
    >
      <header className="head" onClick={(e) => e.stopPropagation()}>
        <div className="who">
          {post.author?.avatarURL ? (
            <img className="avatar" src={post.author.avatarURL} alt="" />
          ) : (
            <div className="avatar ph">
              {authorName[0]?.toUpperCase() || "U"}
            </div>
          )}
          <div className="names">
            <div className="name">{authorName}</div>
            {created ? (
              <div className="time">
                {created.toLocaleDateString()}{" "}
                {created.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            ) : null}
          </div>
        </div>

        {isOwner && !editing && (
          <div className="ownerActions">
            <button
              className="btn"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
                setTextDraft(post.text ?? "");
              }}
            >
              Edit
            </button>
            <button className="btn danger" onClick={deletePost}>
              Delete
            </button>
          </div>
        )}
      </header>

      {editing ? (
        <div className="editWrap" onClick={(e) => e.stopPropagation()}>
          <textarea
            className="ta"
            rows={3}
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
          />
          <div className="bar">
            <button className="btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button className="btn primary" onClick={saveEdit}>
              Save
            </button>
          </div>
        </div>
      ) : (
        <>
          {post.text ? <p className="text">{post.text}</p> : null}
          {post.imageURL ? (
            <div className="imgWrap">
              <img className="img" src={post.imageURL} alt="" />
            </div>
          ) : null}
        </>
      )}

      {err ? (
        <p className="bad" onClick={(e) => e.stopPropagation()}>
          {err}
        </p>
      ) : null}

      <footer className="bar" onClick={(e) => e.stopPropagation()}>
        <button className="btn" onClick={openThread} title="Open thread">
          💬 {comments}
        </button>
        <button
          className={`btn ${iLiked ? "active" : ""}`}
          onClick={toggleLike}
          disabled={busyLike}
          aria-pressed={iLiked}
          title="Like"
        >
          ❤️ {likes}
        </button>
        <button
          className={`btn ${iReposted ? "active" : ""}`}
          onClick={toggleRepost}
          disabled={busyRepost}
          aria-pressed={iReposted}
          title="Repost"
        >
          🔁 {reposts}
        </button>
      </footer>

      {/* Confirm Delete Modal */}
      {showConfirm && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            e.stopPropagation();
            setShowConfirm(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowConfirm(false);
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modalTitle">Delete post?</h3>
            <p className="modalText">This action can’t be undone.</p>
            <div className="modalRow">
              <button
                className="btn"
                onClick={() => setShowConfirm(false)}
                disabled={busyDelete}
              >
                Cancel
              </button>
              <button
                className="btn danger"
                onClick={confirmDelete}
                disabled={busyDelete}
                autoFocus
              >
                {busyDelete ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .card {
          border: 1px solid #e5e7eb;
          background: #fff;
          border-radius: 12px;
          padding: 12px;
          cursor: pointer;
        }
        .card:focus {
          outline: 2px solid #0f172a;
          outline-offset: 2px;
        }
        .head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .who {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .avatar {
          width: 36px;
          height: 36px;
          border-radius: 999px;
          object-fit: cover;
          border: 1px solid #e5e7eb;
        }
        .avatar.ph {
          width: 36px;
          height: 36px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: #f1f5f9;
          color: #0f172a;
          font-weight: 700;
          border: 1px solid #e2e8f0;
        }
        .names {
          line-height: 1.2;
        }
        .name {
          font-weight: 600;
          color: #0f172a;
        }
        .time {
          font-size: 12px;
          color: #6b7280;
        }
        .text {
          margin: 8px 0;
          color: #0f172a;
          white-space: pre-wrap;
        }
        .imgWrap {
          border: 1px solid #eef2f7;
          border-radius: 10px;
          overflow: hidden;
          margin-top: 8px;
        }
        .img {
          width: 100%;
          display: block;
          object-fit: cover;
        }

        .ownerActions {
          display: flex;
          gap: 8px;
        }
        .editWrap {
          display: grid;
          gap: 8px;
          margin-top: 6px;
        }
        .ta {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          padding: 8px 10px;
        }

        .bar {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }
        .btn {
          border: 1px solid #e5e7eb;
          background: #fff;
          border-radius: 10px;
          padding: 6px 10px;
          cursor: pointer;
        }
        .btn:hover {
          background: #f8fafc;
        }
        .btn.active {
          background: #0f172a;
          color: #fff;
          border-color: #0f172a;
        }
        .btn.primary {
          background: #0f172a;
          color: #fff;
          border-color: #0f172a;
        }
        .btn.primary:hover {
          opacity: 0.95;
        }
        .btn.danger {
          background: #fee2e2;
          color: #991b1b;
          border-color: #fecaca;
        }

        .bad {
          margin-top: 8px;
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 6px 8px;
          font-size: 12px;
        }

        /* modal styles */
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.45);
          display: grid;
          place-items: center;
          padding: 16px;
          z-index: 1000;
        }
        .modal {
          width: 100%;
          max-width: 420px;
          background: #fff;
          border-radius: 14px;
          border: 1px solid #e5e7eb;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.2);
          padding: 16px;
        }
        .modalTitle {
          margin: 0 0 6px;
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
        }
        .modalText {
          margin: 0 0 12px;
          color: #475569;
        }
        .modalRow {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
      `}</style>
    </article>
  );
}
