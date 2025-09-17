// app/posts/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import CommentInput from "@/components/comments/CommentInput";
import CommentItem from "@/components/comments/CommentItem";

type Author = {
  username?: string | null;
  displayName?: string | null;
  avatarURL?: string | null;
} | null;

type Post = {
  id: string;
  uid: string;
  text?: string | null;
  imageURL?: string | null;   // legacy
  createdAt?: any;
  author?: Author;
};

type CommentDoc = {
  id: string;
  uid: string;
  text?: string | null;
  createdAt?: any;
  author?: {
    displayName?: string | null;
    username?: string | null;
    avatarURL?: string | null;
  } | null;
};

export default function PostThreadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [me, setMe] = useState<any>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentDoc[]>([]);

  // auth
  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => setMe(u || null));
    return () => stop();
  }, []);

  // load post once
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "posts", String(id)));
        if (!snap.exists()) {
          setLoading(false);
          router.replace("/dashboard");
          return;
        }
        setPost({ id: snap.id, ...(snap.data() as any) });
        setLoading(false);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load post.");
        setLoading(false);
      }
    })();
  }, [id, router]);

  // live comments (newest first)
  useEffect(() => {
    if (!id) return;
    const qy = query(
      collection(db, "posts", String(id), "comments"),
      orderBy("createdAt", "desc")
    );
    const stop = onSnapshot(
      qy,
      (snap) => {
        const list: CommentDoc[] = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            uid: data.uid,
            text: data.text ?? "",
            createdAt: data.createdAt,
            author: data.author ?? null,
          };
        });
        setComments(list);
      },
      (e) => setErr(e?.message ?? "Failed to load comments.")
    );
    return () => stop();
  }, [id]);

  // helpers
  const created = useMemo(() => {
    const ts: any = post?.createdAt;
    if (!ts) return null;
    if (typeof ts?.toDate === "function") return ts.toDate();
    if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000);
    return null;
  }, [post?.createdAt]);

  const authorName =
    post?.author?.username ||
    post?.author?.displayName ||
    (post?.uid ? post.uid.slice(0, 6) : "Unknown");

  async function handleQuickReply(text: string) {
    if (!me) throw new Error("Please sign in to comment.");
    await addDoc(collection(db, "posts", String(id), "comments"), {
      uid: me.uid,
      text: text.trim(),
      createdAt: serverTimestamp(),
      // (optional) denormalized author snapshot
      author: post?.author ?? null,
    });
  }

  async function deleteComment(cid: string) {
    if (!me) return;
    // Rules allow: comment owner OR post owner
    await deleteDoc(doc(db, "posts", String(id), "comments", cid));
  }

  if (loading) return <main className="wrap"><div className="card">Loading…</div></main>;
  if (err) return <main className="wrap"><div className="card bad">{err}</div></main>;
  if (!post) return <main className="wrap"><div className="card">Post not found.</div></main>;

  return (
    <main className="wrap">
      <article className="thread">
        <header className="head">
          <div className="who">
            {post.author?.avatarURL ? (
              <img className="avatar" src={post.author.avatarURL} alt="" />
            ) : (
              <div className="avatar ph">{authorName[0]?.toUpperCase() || "U"}</div>
            )}
            <div className="names">
              <div className="name">{authorName}</div>
              {created ? (
                <div className="time">
                  {created.toLocaleDateString()}{" "}
                  {created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              ) : null}
            </div>
          </div>
          <div className="actions">
            <Link className="btn" href="/">Home</Link>
          </div>
        </header>

        {post.text ? <p className="text">{post.text}</p> : null}
        {post.imageURL ? (
          <div className="imgWrap">
            <img className="img" src={post.imageURL} alt="" />
          </div>
        ) : null}

        {/* compose box */}
        <section className="compose">
          <CommentInput
            disabled={!me}
            placeholder={me ? "Write a reply…" : "Sign in to reply"}
            onSubmit={handleQuickReply}
          />
          {!me ? <p className="muted" style={{ marginTop: 6 }}>You must be signed in to comment.</p> : null}
        </section>

        {/* comments */}
        <section className="comments">
          <h2 className="h2">Comments</h2>
          {comments.length === 0 ? (
            <p className="muted">No replies yet.</p>
          ) : (
            <ul className="list">
              {comments.map((c) => {
                const ts: any = c.createdAt;
                const createdAt =
                  ts?.toDate ? ts.toDate() :
                  typeof ts?.seconds === "number" ? new Date(ts.seconds * 1000) :
                  undefined;
                const canDelete = me && (me.uid === c.uid || me.uid === post.uid);
                const displayName =
                  c.author?.displayName ||
                  c.author?.username ||
                  (c.uid ? c.uid.slice(0, 6) : "user");
                return (
                  <li key={c.id} className="cmt">
                    <div className="cmtHead">
                      <span className="cmtWho">{displayName}</span>
                      <span className="dot">•</span>
                      <span className="cmtTime">{createdAt ? createdAt.toLocaleString() : ""}</span>
                      {canDelete ? (
                        <button className="link danger" onClick={() => deleteComment(c.id)}>
                          delete
                        </button>
                      ) : null}
                    </div>

                    <CommentItem
                      text={c.text ?? ""}
                      previewChars={800}
                      previewLines={10}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </article>

      <style jsx>{`
        .wrap { max-width: 800px; margin: 0 auto; padding: 24px; }
        .card { border:1px solid #e5e7eb; background:#fff; border-radius:12px; padding:12px; }
        .bad { background:#fef2f2; color:#991b1b; border-color:#fecaca; }

        .thread { border:1px solid #e5e7eb; background:#fff; border-radius:12px; padding:12px; }
        .head { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
        .who { display:flex; gap:10px; align-items:center; }
        .avatar { width:40px; height:40px; border-radius:999px; object-fit:cover; border:1px solid #e5e7eb; }
        .avatar.ph { width:40px; height:40px; border-radius:999px; display:grid; place-items:center; background:#f1f5f9; color:#0f172a; font-weight:700; border:1px solid #e2e8f0; }
        .name { font-weight:700; color:#0f172a; }
        .time { font-size:12px; color:#6b7280; }
        .actions .btn { border:1px solid #e5e7eb; border-radius:10px; padding:6px 10px; background:#fff; }

        .text { margin:8px 0; color:#0f172a; white-space:pre-wrap; overflow-wrap:anywhere; word-break:break-word; }

        .imgWrap { border:1px solid #eef2f7; border-radius:10px; overflow:hidden; margin:10px 0; }
        .img { width:100%; display:block; object-fit:cover; }

        .compose { margin-top:12px; }

        .comments { margin-top:16px; }
        .h2 { font-size: 18px; font-weight: 700; margin: 0 0 10px; color:#0f172a; }
        .muted { color:#6b7280; font-size:14px; }
        .list { list-style:none; padding:0; margin:0; display:grid; gap:12px; }

        .cmt { border-top:1px solid #f1f5f9; padding-top:10px; }
        .cmtHead { display:flex; align-items:center; gap:6px; font-size:13px; color:#334155; flex-wrap:wrap; }
        .cmtWho { font-weight:600; color:#0f172a; }
        .dot { color:#94a3b8; }
        .link { background:none; border:none; padding:0; cursor:pointer; text-decoration:underline; }
        .link.danger { color:#b91c1c; }
      `}</style>
    </main>
  );
}
