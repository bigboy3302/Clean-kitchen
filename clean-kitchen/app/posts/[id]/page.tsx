"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

type Author = { username?: string | null; displayName?: string | null; avatarURL?: string | null } | null;
type Post = {
  id: string;
  uid: string;
  text?: string | null;
  imageURL?: string | null;
  createdAt?: any;
  author?: Author;
};

type Comment = {
  id: string;
  uid: string;
  text: string;
  createdAt?: any;
};

const BAD = ["fuck","shit","bitch","asshole","cunt","nigger","faggot"];
const clean = (t:string) => !t || !BAD.some(w => t.toLowerCase().includes(w));

export default function PostThreadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [me, setMe] = useState<any>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [cmt, setCmt] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stopAuth = onAuthStateChanged(auth, (u) => setMe(u || null));
    return () => stopAuth();
  }, []);

  // load post
  useEffect(() => {
    if (!id) return;
    const ref = doc(db, "posts", id);
    const stop = onSnapshot(
      ref,
      (snap) => {
        setLoading(false);
        if (!snap.exists()) { setPost(null); setErr("Post not found."); return; }
        setPost({ id: snap.id, ...(snap.data() as any) });
        setErr(null);
      },
      (e) => { setLoading(false); setErr(e?.message ?? "Failed to load post."); }
    );
    return () => stop();
  }, [id]);

  // load comments (new → old like X)
  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, "posts", id, "comments"), orderBy("createdAt", "desc"));
    const stop = onSnapshot(
      q,
      (snap) => setComments(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))),
      (e) => setErr(e?.message ?? "Failed to load comments.")
    );
    return () => stop();
  }, [id]);

  const created = useMemo(() => {
    const ts: any = post?.createdAt;
    if (!ts) return null;
    if (typeof ts.toDate === "function") return ts.toDate();
    if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
    return null;
  }, [post?.createdAt]);

  const authorName =
    post?.author?.username ||
    post?.author?.displayName ||
    (post?.uid ? post.uid.slice(0, 6) : "Unknown");

  async function addComment() {
    setErr(null);
    if (!me) { setErr("Please sign in to comment."); return; }
    const text = cmt.trim();
    if (!text) return;
    if (!clean(text)) { setErr("Please avoid offensive words."); return; }
    setBusy(true);
    try {
      await addDoc(collection(db, "posts", String(id), "comments"), {
        uid: me.uid,
        text,
        createdAt: serverTimestamp(),
      });
      setCmt("");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to add comment.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment(cid: string, ownerUid: string) {
    setErr(null);
    try {
      // Firestore rules allow: comment owner OR post owner
      if (!me) throw new Error("Not signed in.");
      await deleteDoc(doc(db, "posts", String(id), "comments", cid));
    } catch (e: any) {
      setErr(e?.message ?? "Failed to delete comment.");
    }
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
              {created && (
                <div className="time">
                  {created.toLocaleDateString()}{" "}
                  {created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
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

        {/* composer */}
        <section className="compose">
          <textarea
            className="ta"
            rows={3}
            value={cmt}
            onChange={(e) => setCmt(e.target.value)}
            placeholder={me ? "Write a reply…" : "Sign in to reply"}
            disabled={!me || busy}
          />
          <div className="row end">
            <button className="btn primary" onClick={addComment} disabled={!me || !cmt.trim() || busy}>
              {busy ? "Sending…" : "Reply"}
            </button>
          </div>
          {err && <p className="bad">{err}</p>}
        </section>

        {/* comments */}
        <section className="comments">
          {comments.length === 0 ? (
            <p className="muted">No replies yet.</p>
          ) : (
            <ul className="list">
              {comments.map(cm => {
                const ts: any = cm.createdAt;
                const d =
                  ts && typeof ts.toDate === "function" ? ts.toDate() :
                  ts && typeof ts.seconds === "number" ? new Date(ts.seconds * 1000) : null;
                const canDelete = me && (me.uid === cm.uid || me.uid === post.uid);
                return (
                  <li key={cm.id} className="cmt">
                    <div className="cmtHead">
                      <span className="cmtWho">{cm.uid?.slice(0,6) || "user"}</span>
                      <span className="dot">•</span>
                      <span className="cmtTime">{d ? d.toLocaleString() : ""}</span>
                      {canDelete && (
                        <button className="link danger" onClick={() => deleteComment(cm.id, cm.uid)}>
                          delete
                        </button>
                      )}
                    </div>
                    <p className="cmtText">{cm.text}</p>
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

        .text { margin:8px 0; color:#0f172a; white-space:pre-wrap; }
        .imgWrap { border:1px solid #eef2f7; border-radius:10px; overflow:hidden; margin:10px 0; }
        .img { width:100%; display:block; object-fit:cover; }

        .compose { margin-top:8px; }
        .ta { width:100%; border:1px solid #d1d5db; border-radius:10px; padding:10px; background:#fff; }
        .row { display:flex; gap:8px; margin-top:8px; }
        .row.end { justify-content:flex-end; }
        .btn.primary { background:#0f172a; color:#fff; border:1px solid #0f172a; border-radius:10px; padding:6px 12px; }
        .bad { margin-top:6px; background:#fef2f2; color:#991b1b; border:1px solid #fecaca; border-radius:8px; padding:6px 8px; font-size:12px; }

        .comments { margin-top:12px; }
        .muted { color:#6b7280; }
        .list { list-style:none; padding:0; margin:0; display:grid; gap:10px; }
        .cmt { border-top:1px solid #f1f5f9; padding-top:10px; }
        .cmtHead { display:flex; align-items:center; gap:6px; font-size:13px; color:#334155; }
        .cmtWho { font-weight:600; color:#0f172a; }
        .dot { color:#94a3b8; }
        .link { background:none; border:none; padding:0; cursor:pointer; text-decoration:underline; }
        .link.danger { color:#b91c1c; }
        .cmtText { margin:4px 0 0; white-space:pre-wrap; color:#0f172a; }
      `}</style>
    </main>
  );
}
