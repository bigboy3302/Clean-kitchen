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
import CommentItem from "@/components/comments/CommentItem";

type Author = { username?: string | null; displayName?: string | null; avatarURL?: string | null } | null;

type Post = {
  id: string;
  uid: string;
  text?: string | null;
  imageURL?: string | null;
  createdAt?: any;
  author?: Author;
};

type CommentDoc = {
  id: string;
  uid: string;
  text?: string | null;
  createdAt?: any;
  author?: { displayName?: string | null; username?: string | null; avatarURL?: string | null } | null;
};

export default function PostThreadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentDoc[]>([]);

  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => setMe(u || null));
    return () => stop();
  }, []);

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

  useEffect(() => {
    if (!id) return;
    const qy = query(collection(db, "posts", String(id), "comments"), orderBy("createdAt", "desc"));
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
      author: post?.author ?? null,
    });
  }

  async function deleteComment(cid: string) {
    if (!me) return;
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
                  {created.toLocaleDateString()} {created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              ) : null}
            </div>
          </div>
          <div className="actions">
            <Link className="btn" href="/dashboard">Home</Link>
          </div>
        </header>
 <section className="compose">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const t = String(new FormData(form).get("text") || "");
              if (t.trim()) {
                await handleQuickReply(t.trim());
                form.reset();
              }
            }}
          >
        {post.text ? <p className="text">{post.text}</p> : null}
        {post.imageURL ? (
          <div className="imgWrap">
            <img className="img" src={post.imageURL} alt="" />
          </div>
        ) : null}

       
            <textarea name="text" rows={3} placeholder={me ? "Write a reply…" : "Sign in to reply"} disabled={!me} />
            <button className="btn" disabled={!me}>Reply</button>
          </form>
          {!me ? <p className="muted" style={{ marginTop: 6 }}>You must be signed in to comment.</p> : null}
        </section>

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
                        <button className="link danger" onClick={() => deleteComment(c.id)}>delete</button>
                      ) : null}
                    </div>
                    <CommentItem text={c.text ?? ""} previewChars={800} previewLines={10} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </article>

      <style jsx>{`
        .wrap { max-width: 800px; margin: 0 auto; padding: 24px; }
        .card { border:1px solid var(--border); background: var(--card-bg); color: var(--text); border-radius:12px; padding:12px; }
        .bad { background: color-mix(in oklab, #ef4444 12%, var(--card-bg)); color: color-mix(in oklab, #7f1d1d 70%, var(--text) 30%); border-color: color-mix(in oklab, #ef4444 35%, var(--border)); }
        .thread{ border:1px solid var(--border); background: var(--card-bg); color: var(--text); border-radius:16px; padding:16px; box-shadow:0 10px 30px rgba(0,0,0,.06); }
        .head { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
        .who { display:flex; gap:10px; align-items:center; }
        .avatar { width:40px; height:40px; border-radius:999px; object-fit:cover; border:1px solid var(--border); }
        .avatar.ph { width:40px; height:40px; border-radius:999px; display:grid; place-items:center; background:var(--bg2); color:var(--text); font-weight:700; border:1px solid var(--border); }
        .name { font-weight:700; color:var(--text); }
        .time { font-size:12px; color:var(--muted); }
        .actions .btn { border:1px solid var(--border); background: var(--bg2); color: var(--text); border-radius:10px; padding:6px 10px; text-decoration:none; }
        .actions .btn:hover { opacity:.95; }
        .text { margin:8px 0; color:var(--text); white-space:pre-wrap; overflow-wrap:anywhere; word-break:break-word; }
        .imgWrap { border:1px solid var(--border); border-radius:10px; overflow:hidden; margin:10px 0; background:var(--bg2); }
        .img { width:100%; display:block; object-fit:cover; }
        .compose { margin-top:12px; }
        .compose form { display:grid; grid-template-columns: 1fr auto; gap:8px; }
        .compose textarea{ width:100%; border:1px solid var(--border); border-radius:12px; padding:10px 12px; background: var(--bg); color: var(--text); resize: vertical; min-height: 38px; }
        .compose .btn{ border-radius:12px; border:0; padding:0 14px; background: var(--primary); color: var(--primary-contrast); font-weight:700; cursor:pointer; }
        .compose .btn:disabled{ opacity:.6; cursor:not-allowed }
        .comments { margin-top:16px; }
        .h2 { font-size: 18px; font-weight: 700; margin: 0 0 10px; color:var(--text); }
        .muted { color:var(--muted); font-size:14px; }
        .list { list-style:none; padding:0; margin:0; display:grid; gap:12px; }
        .cmt { border-top:1px solid var(--border); padding-top:10px; }
        .cmtHead { display:flex; align-items:center; gap:6px; font-size:13px; color:var(--muted); flex-wrap:wrap; }
        .cmtWho { font-weight:600; color:var(--text); }
        .dot { color:var(--muted); }
        .link { background:none; border:none; padding:0; cursor:pointer; text-decoration:underline; color:var(--primary); }
        .link.danger { color:#b91c1c; }
      `}</style>
    </main>
  );
}
