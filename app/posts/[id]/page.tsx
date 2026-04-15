"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebas1e";
import Avatar from "@/components/ui/Avatar";

type TimestampLike =
  | Date
  | number
  | string
  | { seconds?: number; nanoseconds?: number; toDate?: () => Date }
  | null
  | undefined;

type Author = {
  username?: string | null;
  displayName?: string | null;
  avatarURL?: string | null;
} | null;

type MediaItem = {
  type: "image" | "video";
  url: string;
  w?: number;
  h?: number;
  duration?: number;
};

type PostRecord = {
  uid: string;
  title?: string | null;
  description?: string | null;
  text?: string | null;
  media?: MediaItem[] | null;
  createdAt?: TimestampLike;
  author?: Author;
  likes?: number | null;
  reposts?: number | null;
};

type PostDoc = { id: string } & PostRecord;

type CommentRecord = {
  uid: string;
  text?: string | null;
  createdAt?: TimestampLike;
  author?: Author;
  replyCount?: number | null;
  repostCount?: number | null;
};

type CommentDoc = { id: string } & CommentRecord;

type ReplyRecord = {
  uid: string;
  text?: string | null;
  createdAt?: TimestampLike;
  author?: Author;
};

type ReplyDoc = { id: string } & ReplyRecord;

type UserRecord = {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  username?: string | null;
  photoURL?: string | null;
};

async function getMyAuthor(uid: string): Promise<Author> {
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists())
      return { displayName: null, username: null, avatarURL: null };
    const data = (snap.data() as UserRecord | undefined) ?? {};
    const first = data.firstName?.trim();
    const last = data.lastName?.trim();
    const displayName =
      first && last
        ? `${first} ${last}`.trim()
        : first || data.displayName || null;
    return {
      displayName: displayName ?? null,
      username: data.username ?? null,
      avatarURL: data.photoURL ?? null,
    };
  } catch (error) {
    console.warn("getMyAuthor failed", error);
    return { displayName: null, username: null, avatarURL: null };
  }
}

function tsToDate(ts: TimestampLike): Date | undefined {
  if (ts == null) return undefined;
  if (ts instanceof Date) return ts;
  if (typeof ts === "number" && Number.isFinite(ts)) return new Date(ts);
  if (typeof ts === "string") {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? undefined : new Date(parsed);
  }
  if (typeof ts === "object") {
    const candidate = ts as { toDate?: () => Date; seconds?: number };
    if (typeof candidate.toDate === "function") {
      try {
        return candidate.toDate();
      } catch {
        // ignore and fall through
      }
    }
    if (typeof candidate.seconds === "number") {
      return new Date(candidate.seconds * 1000);
    }
  }
  return undefined;
}

const COMMENTS_LIMIT = 120;

export default function PostThreadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [me, setMe] = useState<{ uid: string } | null>(null);
  const [post, setPost] = useState<PostDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [sort, setSort] = useState<"top" | "latest">("top");
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const stop = onAuthStateChanged(auth, (user) => setMe(user || null));
    return () => stop();
  }, []);

  useEffect(() => {
    if (!id) return;
    const ref = doc(db, "posts", id);
    const stop = onSnapshot(
      ref,
      (snap) => {
        setLoading(false);
        if (!snap.exists()) {
          setPost(null);
          router.replace("/dashboard");
          return;
        }
        const record = snap.data() as PostRecord | undefined;
        if (!record) {
          setPost(null);
        } else {
          setPost({ id: snap.id, ...record });
        }
        setErr(null);
      },
      (error) => {
        setLoading(false);
        setErr(error?.message ?? "Failed to load post.");
      }
    );
    return () => stop();
  }, [id, router]);

  useEffect(() => {
    if (!id) return;
    const ref = query(
      collection(db, "posts", id, "comments"),
      orderBy("createdAt", "desc"),
      fsLimit(COMMENTS_LIMIT)
    );
    const stop = onSnapshot(
      ref,
      (snap) => {
        const nextComments = snap.docs.reduce<CommentDoc[]>((acc, docSnap) => {
          const data = docSnap.data() as CommentRecord | undefined;
          if (!data || typeof data.uid !== "string") {
            return acc;
          }
          acc.push({
            id: docSnap.id,
            uid: data.uid,
            text: data.text ?? null,
            createdAt: data.createdAt,
            author: data.author ?? null,
            replyCount: data.replyCount ?? 0,
            repostCount: data.repostCount ?? 0,
          });
          return acc;
        }, []);
        setComments(nextComments);
      },
      (error) => {
        console.warn("comments snapshot error", error);
      }
    );
    return () => stop();
  }, [id]);

  const authorName = useMemo(() => {
    if (!post) return "";
    return (
      post.author?.username ||
      post.author?.displayName ||
      (post.uid ? post.uid.slice(0, 6) : "Unknown")
    );
  }, [post]);

  const createdLabel = useMemo(() => {
    const date = tsToDate(post?.createdAt);
    return date ? date.toLocaleString() : "";
  }, [post?.createdAt]);

  
  const sortedComments = useMemo(() => {
    const byCreatedDesc = (a?: TimestampLike, b?: TimestampLike) =>
      (tsToDate(b)?.getTime() || 0) - (tsToDate(a)?.getTime() || 0);

    const list = [...comments];

    if (sort === "latest") {
      return list.sort((a, b) => byCreatedDesc(a.createdAt, b.createdAt));
    }

    return list.sort((a, b) => {
      const br = b.repostCount ?? 0;
      const ar = a.repostCount ?? 0;
      if (br !== ar) return br - ar;
      return byCreatedDesc(a.createdAt, b.createdAt);
    });
  }, [comments, sort]);

  async function handleAddComment() {
    if (!me || !id) return;
    const text = commentText.trim();
    if (!text) return;
    setPosting(true);
    try {
      const author = await getMyAuthor(me.uid);
      await addDoc(collection(db, "posts", id, "comments"), {
        uid: me.uid,
        text,
        replyCount: 0,
        repostCount: 0,
        createdAt: serverTimestamp(),
        author,
      });
      setCommentText("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      alert(
        /unauthorized|permission/i.test(message)
          ? "Comment blocked by rules. Please sign in."
          : message
      );
    } finally {
      setPosting(false);
    }
  }

  async function handleDeleteComment(commentId: string, ownerUid: string) {
    if (!me || !id) return;
    const owner = ownerUid || "";
    if (me.uid !== owner && me.uid !== post?.uid) return;
    await deleteDoc(doc(db, "posts", id, "comments", commentId));
  }

  async function handleToggleRepost(commentId: string, hasReposted: boolean) {
    if (!me || !id) return;
    const commentRef = doc(db, "posts", id, "comments", commentId);
    const recordRef = doc(
      db,
      "posts",
      id,
      "comments",
      commentId,
      "reposts",
      me.uid
    );
    try {
      if (hasReposted) {
        await deleteDoc(recordRef);
        await updateDoc(commentRef, { repostCount: increment(-1) });
      } else {
        await setDoc(recordRef, { uid: me.uid, createdAt: serverTimestamp() });
        await updateDoc(commentRef, { repostCount: increment(1) });
      }
    } catch (error) {
      console.warn("toggle repost failed", error);
    }
  }

  async function handleAddReply(commentId: string, text: string) {
    if (!me || !id) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const author = await getMyAuthor(me.uid);
    await addDoc(
      collection(db, "posts", id, "comments", commentId, "replies"),
      {
        uid: me.uid,
        text: trimmed,
        createdAt: serverTimestamp(),
        author,
      }
    );
    await updateDoc(doc(db, "posts", id, "comments", commentId), {
      replyCount: increment(1),
    }).catch(() => {});
  }

  if (loading) {
    return (
      <main className="wrap">
        <div className="sk" />
        <style jsx>{`
          .wrap {
            max-width: 860px;
            margin: 0 auto;
            padding: 16px;
          }
          .sk {
            height: 240px;
            border-radius: 16px;
            border: 1px solid var(--border);
            background: linear-gradient(
              90deg,
              transparent,
              rgba(148, 163, 184, 0.18),
              transparent
            );
            animation: shimmer 1.6s infinite;
          }
          @keyframes shimmer {
            from {
              background-position: -200px 0;
            }
            to {
              background-position: 200px 0;
            }
          }
        `}</style>
      </main>
    );
  }

  if (err) {
    return (
      <main className="wrap">
        <div className="card bad">{err}</div>
        <style jsx>{`
          .wrap {
            max-width: 860px;
            margin: 0 auto;
            padding: 16px;
          }
          .card {
            border: 1px solid color-mix(in oklab, #ef4444 35%, var(--border));
            border-radius: 14px;
            padding: 14px;
            background: color-mix(in oklab, #ef4444 12%, var(--card-bg));
            color: color-mix(in oklab, #7f1d1d 70%, var(--text));
          }
        `}</style>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="wrap">
        <div className="card">Post not found.</div>
        <style jsx>{`
          .wrap {
            max-width: 860px;
            margin: 0 auto;
            padding: 16px;
          }
          .card {
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 14px;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="wrap">
      <article className="thread">
        <header className="head">
          <div className="who">
            <Avatar
              src={post.author?.avatarURL || undefined}
              name={authorName}
              size={38}
            />
            <div className="names">
              <div className="name">{authorName}</div>
              {createdLabel ? <div className="time">{createdLabel}</div> : null}
            </div>
          </div>
          <div className="actions">
            <Link className="btn-ghost" href="/dashboard">
              Back
            </Link>
          </div>
        </header>

        {post.title ? <h1 className="title">{post.title}</h1> : null}
        {post.description ? <p className="desc">{post.description}</p> : null}

        {Array.isArray(post.media) && post.media.length > 0 ? (
          <div className={`media ${post.media.length > 1 ? "multi" : ""}`}>
            <div className="rail">
              {post.media.map((item, index) => (
                <div className="cell" key={index}>
                  {item.type === "video" ? (
                    <video
                      src={item.url}
                      controls
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <Image
                      src={item.url}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 80vw, 420px"
                      className="postMediaImage"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {post.text ? <p className="caption">{post.text}</p> : null}

        <section className="compose">
          <div className="composeHead">
            <span>Add a comment</span>
            <small>
              {me
                ? "Share a quick thought, tip, or question."
                : "Sign in when you want to join the conversation."}
            </small>
          </div>
          <div className="row">
            <textarea
              rows={3}
              placeholder={me ? "Write a comment..." : "Sign in to comment"}
              value={commentText}
              disabled={!me}
              onChange={(event) => setCommentText(event.target.value)}
            />
            <div className="ctrls">
              <button
                className="btn-primary"
                disabled={!me || posting || !commentText.trim()}
                onClick={handleAddComment}
              >
                {posting ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        </section>

        <section className="toolbar">
          <h2 className="h2">
            Comments <span>{sortedComments.length}</span>
          </h2>
          <div className="tabs">
            <button
              className={`tab ${sort === "top" ? "on" : ""}`}
              onClick={() => setSort("top")}
            >
              Top
            </button>
            <button
              className={`tab ${sort === "latest" ? "on" : ""}`}
              onClick={() => setSort("latest")}
            >
              Latest
            </button>
          </div>
        </section>

        <section className="comments">
          {sortedComments.length === 0 ? (
            <p className="muted empty">No comments yet. Be the first to write one.</p>
          ) : (
            <ul className="clist">
              {sortedComments.map((comment) => (
                <CommentRow
                  key={comment.id}
                  postId={post.id}
                  postUid={post.uid}
                  comment={comment}
                  meUid={me?.uid || null}
                  onAddReply={handleAddReply}
                  onDelete={handleDeleteComment}
                  onToggleRepost={handleToggleRepost}
                />
              ))}
            </ul>
          )}
        </section>
      </article>

      <style jsx>{`
        .wrap {
          width: min(980px, 100%);
          max-width: 980px;
          margin: 0 auto;
          padding: 24px;
          color: var(--text);
        }
        .thread {
          display: grid;
          gap: 22px;
          background: color-mix(in oklab, var(--card) 94%, var(--primary) 6%);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 26px;
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.2);
        }
        .head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .who {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .names {
          display: grid;
          gap: 2px;
        }
        .name {
          font-weight: 900;
        }
        .time {
          font-size: 12px;
          color: var(--muted);
        }
        .btn-ghost {
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text);
          border-radius: 12px;
          padding: 8px 14px;
          text-decoration: none;
          font-weight: 700;
        }
        .title {
          margin: 0;
          font-size: 24px;
          font-weight: 900;
        }
        .desc {
          margin: 0;
          color: var(--muted);
        }
        .media {
          display: grid;
          gap: 10px;
        }
        .rail {
          display: flex;
          gap: 10px;
          overflow-x: auto;
        }
        .cell {
          flex: 0 0 80%;
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          background: #000;
          height: 280px;
          position: relative;
        }
        .cell video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        :global(.postMediaImage) {
          object-fit: cover;
        }
        .caption {
          white-space: pre-wrap;
          margin: 6px 0 0;
        }
        .compose {
          display: grid;
          gap: 12px;
          padding: 16px;
          border: 1px solid color-mix(in oklab, var(--border) 78%, transparent);
          border-radius: 18px;
          background: color-mix(in oklab, var(--bg-raised) 82%, var(--primary) 6%);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }
        .composeHead {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .composeHead span {
          font-size: 16px;
          font-weight: 900;
        }
        .composeHead small {
          color: var(--muted);
          font-size: 13px;
          line-height: 1.4;
        }
        .row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          align-items: stretch;
        }
        textarea {
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 14px 16px;
          resize: vertical;
          min-height: 132px;
          background: color-mix(in oklab, var(--bg) 88%, transparent);
          color: var(--text);
          font: inherit;
          font-size: 15px;
          line-height: 1.5;
        }
        textarea:focus {
          outline: none;
          border-color: color-mix(in oklab, var(--primary) 45%, var(--border));
          box-shadow: 0 0 0 4px color-mix(in oklab, var(--primary) 18%, transparent);
        }
        textarea:disabled {
          opacity: 0.68;
          cursor: not-allowed;
        }
        .ctrls {
          display: flex;
          gap: 10px;
          align-items: flex-end;
        }
        .btn-primary {
          border: 1px solid var(--primary);
          background: var(--primary);
          color: var(--primary-contrast);
          border-radius: 14px;
          padding: 0 18px;
          min-height: 46px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 12px 26px color-mix(in oklab, var(--primary) 24%, transparent);
          transition: transform 0.12s ease, box-shadow 0.16s ease, opacity 0.16s ease;
        }
        .btn-primary:active {
          transform: translateY(1px);
        }
        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          box-shadow: none;
        }
        .toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .tabs {
          display: flex;
          gap: 6px;
        }
        .tab {
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text);
          border-radius: 999px;
          padding: 6px 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .tab.on {
          background: color-mix(in oklab, var(--primary) 15%, transparent);
          border-color: color-mix(in oklab, var(--primary) 35%, var(--border));
        }
        .comments {
          display: grid;
          gap: 12px;
        }
        .h2 {
          margin: 0;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 20px;
          font-weight: 900;
        }
        .h2 span {
          display: inline-flex;
          min-width: 28px;
          height: 28px;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--primary) 25%, var(--border));
          background: color-mix(in oklab, var(--primary) 13%, transparent);
          color: var(--primary);
          font-size: 13px;
          padding: 0 8px;
        }
        .clist {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 12px;
        }
        .muted {
          color: var(--muted);
          font-size: 14px;
        }
        .empty {
          margin: 0;
          padding: 18px;
          border: 1px dashed color-mix(in oklab, var(--border) 85%, transparent);
          border-radius: 16px;
          background: color-mix(in oklab, var(--bg-raised) 78%, transparent);
          text-align: center;
        }
        @media (min-width: 900px) {
          .thread {
            padding: 30px;
          }
          .comments {
            gap: 16px;
          }
          .clist {
            gap: 16px;
          }
        }
        @media (max-width: 640px) {
          .wrap {
            padding: 12px;
          }
          .thread {
            gap: 16px;
            border-radius: 18px;
            padding: 14px;
          }
          .compose {
            padding: 12px;
            border-radius: 16px;
          }
          .composeHead {
            gap: 4px;
          }
          .composeHead span {
            font-size: 15px;
          }
          .composeHead small {
            font-size: 12px;
          }
          .row {
            grid-template-columns: 1fr;
          }
          textarea {
            min-height: 82px;
            border-radius: 14px;
            padding: 11px 12px;
            font-size: 14px;
          }
          .ctrls {
            justify-content: stretch;
          }
          .btn-primary {
            width: 100%;
            min-height: 42px;
          }
          .toolbar {
            align-items: flex-start;
          }
          .h2 {
            font-size: 18px;
          }
          .cell {
            height: 220px;
            flex-basis: 100%;
          }
        }
      `}</style>
    </main>
  );
}

type CommentRowProps = {
  postId: string;
  postUid: string;
  comment: CommentDoc;
  meUid: string | null;
  onAddReply: (commentId: string, text: string) => Promise<void>;
  onDelete: (commentId: string, ownerUid: string) => Promise<void>;
  onToggleRepost: (commentId: string, hasReposted: boolean) => Promise<void>;
};

function CommentRow({
  postId,
  postUid,
  comment,
  meUid,
  onAddReply,
  onDelete,
  onToggleRepost,
}: CommentRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [replies, setReplies] = useState<ReplyDoc[]>([]);
  const [hasReposted, setHasReposted] = useState(false);
  const [repostBusy, setRepostBusy] = useState(false);

  useEffect(() => {
    if (!meUid) {
      setHasReposted(false);
      return;
    }
    const ref = doc(
      db,
      "posts",
      postId,
      "comments",
      comment.id,
      "reposts",
      meUid
    );
    const stop = onSnapshot(ref, (snap) => setHasReposted(snap.exists()));
    return () => stop();
  }, [postId, comment.id, meUid]);

  useEffect(() => {
    if (!isOpen) return;
    const qRef = query(
      collection(db, "posts", postId, "comments", comment.id, "replies"),
      orderBy("createdAt", "asc")
    );
    const stop = onSnapshot(qRef, (snap) => {
      const nextReplies = snap.docs.reduce<ReplyDoc[]>((acc, docSnap) => {
        const data = docSnap.data() as ReplyRecord | undefined;
        if (!data || typeof data.uid !== "string") {
          return acc;
        }
        acc.push({
          id: docSnap.id,
          uid: data.uid,
          text: data.text ?? null,
          createdAt: data.createdAt,
          author: data.author ?? null,
        });
        return acc;
      }, []);
      setReplies(nextReplies);
    });
    return () => stop();
  }, [isOpen, postId, comment.id]);

  const canDelete = meUid === comment.uid || meUid === postUid;
  const label =
    comment.author?.displayName ||
    comment.author?.username ||
    (comment.uid ? `@${comment.uid.slice(0, 6)}` : "user");
  const created = tsToDate(comment.createdAt)?.toLocaleString() ?? "";
  const ownerUid = comment.uid || "";

  return (
    <li className="citem">
      <div className="ctop">
        <div className="crow">
          <span className="cname">{label}</span>
          <span className="cdot">•</span>
          <span className="cdate">{created}</span>
        </div>
        <div className="cactions">
          <button
            className={`chip ${hasReposted ? "on" : ""}`}
            disabled={!meUid || repostBusy}
            onClick={async () => {
              if (!meUid) return;
              setRepostBusy(true);
              await onToggleRepost(comment.id, hasReposted);
              setRepostBusy(false);
            }}
          >
            ↻ Repost{" "}
            {comment.repostCount ? (
              <span className="count">{comment.repostCount}</span>
            ) : null}
          </button>
          <button
            className="chip"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
          >
            {isOpen ? "Hide replies" : `Replies (${comment.replyCount || 0})`}
          </button>
          {canDelete ? (
            <button
              className="chip danger"
              onClick={() => onDelete(comment.id, ownerUid)}
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>

      {comment.text ? <p className="ctext">{comment.text}</p> : null}

      {isOpen ? (
        <div className="replyPanel">
          <ul className="rlist">
            {replies.length === 0 ? (
              <li className="ritem muted">No replies yet.</li>
            ) : (
              replies.map((reply) => {
                const rLabel =
                  reply.author?.displayName ||
                  reply.author?.username ||
                  (reply.uid ? `@${reply.uid.slice(0, 6)}` : "user");
                const when =
                  tsToDate(reply.createdAt)?.toLocaleString() ?? "";
                return (
                  <li className="ritem" key={reply.id}>
                    <div className="rhead">
                      <span className="rname">{rLabel}</span>
                      <span className="rdot">•</span>
                      <span className="rtime">{when}</span>
                    </div>
                    <div className="rbubble">{reply.text}</div>
                  </li>
                );
              })
            )}
          </ul>
          <form
            className="rform"
            onSubmit={async (event) => {
              event.preventDefault();
              const value = draft.trim();
              if (!value) return;
              await onAddReply(comment.id, value);
              setDraft("");
            }}
          >
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={meUid ? "Reply to this comment..." : "Sign in to reply"}
              disabled={!meUid}
            />
            <button
              className="btn-secondary"
              disabled={!meUid || !draft.trim()}
            >
              Reply
            </button>
          </form>
        </div>
      ) : null}

      <style jsx>{`
        .citem {
          border: 1px solid color-mix(in oklab, var(--border) 82%, transparent);
          border-radius: 18px;
          padding: 16px;
          background: color-mix(in oklab, var(--card-bg) 92%, var(--primary) 4%);
          display: grid;
          gap: 12px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.1);
        }
        .ctop {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
          flex-wrap: wrap;
        }
        .crow {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          color: var(--muted);
          font-size: 13px;
        }
        .cname {
          font-weight: 800;
          color: var(--text);
          font-size: 14px;
        }
        .cdot {
          opacity: 0.6;
        }
        .cactions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .chip {
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 6px 11px;
          font-weight: 700;
          background: color-mix(in oklab, var(--bg-raised) 84%, transparent);
          color: var(--text);
          cursor: pointer;
          transition: background 0.16s ease, border-color 0.16s ease, transform 0.12s ease;
        }
        .chip:hover {
          background: color-mix(in oklab, var(--primary) 10%, var(--bg-raised));
          border-color: color-mix(in oklab, var(--primary) 24%, var(--border));
        }
        .chip:active {
          transform: translateY(1px);
        }
        .chip.on {
          background: color-mix(in oklab, var(--primary) 15%, transparent);
          border-color: color-mix(in oklab, var(--primary) 35%, var(--border));
        }
        .chip.danger {
          color: #e11d48;
        }
        .chip:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .count {
          margin-left: 6px;
        }
        .ctext {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 15px;
          line-height: 1.65;
        }
        .replyPanel {
          border-top: 1px dashed color-mix(in oklab, var(--border) 86%, transparent);
          padding-top: 12px;
          display: grid;
          gap: 12px;
        }
        .rlist {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 8px;
        }
        .ritem {
          border: 1px solid color-mix(in oklab, var(--border) 78%, transparent);
          border-radius: 14px;
          padding: 10px 12px;
          background: color-mix(in oklab, var(--bg-raised) 86%, transparent);
        }
        .rhead {
          display: flex;
          gap: 6px;
          font-size: 12px;
          color: var(--muted);
        }
        .rname {
          font-weight: 700;
          color: var(--text);
        }
        .rdot {
          opacity: 0.6;
        }
        .rbubble {
          margin-top: 4px;
          white-space: pre-wrap;
          word-break: break-word;
          line-height: 1.55;
        }
        .rform {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
        }
        .rform input {
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 10px 12px;
          background: color-mix(in oklab, var(--bg) 88%, transparent);
          color: var(--text);
          font: inherit;
        }
        .rform input:focus {
          outline: none;
          border-color: color-mix(in oklab, var(--primary) 42%, var(--border));
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 16%, transparent);
        }
        .btn-secondary {
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 10px 14px;
          background: color-mix(in oklab, var(--bg-raised) 84%, transparent);
          color: var(--text);
          font-weight: 700;
          cursor: pointer;
        }
        .btn-secondary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        @media (max-width: 540px) {
          .citem {
            border-radius: 16px;
            padding: 12px;
            gap: 10px;
          }
          .ctop {
            flex-direction: column;
          }
          .cactions {
            justify-content: flex-start;
            gap: 6px;
          }
          .chip {
            font-size: 12px;
            padding: 5px 9px;
          }
          .ctext {
            font-size: 14px;
            line-height: 1.55;
          }
          .replyPanel {
            padding-top: 10px;
          }
          .ritem {
            border-radius: 12px;
            padding: 9px 10px;
          }
          .rform {
            grid-template-columns: 1fr;
          }
          .btn-secondary {
            width: 100%;
          }
        }
      `}</style>
    </li>
  );
}
