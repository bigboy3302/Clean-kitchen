"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, onSnapshot, collection, addDoc, serverTimestamp,
  setDoc, deleteDoc, updateDoc, increment, query, orderBy, where, getDocs
} from "firebase/firestore";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

type Post = {
  id: string;
  uid: string;
  text?: string | null;
  imageURL?: string | null;
  createdAt?: any;
  likesCount?: number;
  commentsCount?: number;
  repostsCount?: number;
  isRepost?: boolean;     // oriģināli postiem: false
  originalId?: string;    // vairs nelietojam (ja agrāk bija)
};

export default function PostDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params?.id) ? params?.id[0] : (params?.id as string | undefined);

  const [uid, setUid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
      setReady(true);
    });
    return () => stop();
  }, []);

  const [post, setPost] = useState<Post | null>(null);
  const [liked, setLiked] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [busyLike, setBusyLike] = useState(false);
  const [busyRepost, setBusyRepost] = useState(false);

  // load post + live like/repost state
  useEffect(() => {
    if (!id) return;
    const stop = onSnapshot(doc(db, "posts", id), (snap) => {
      if (!snap.exists()) { setPost(null); return; }
      setPost({ id: snap.id, ...(snap.data() as any) });
    });
    return () => stop();
  }, [id]);

  useEffect(() => {
    if (!id || !uid) return;
    // like mark
    const stopL = onSnapshot(doc(db, "posts", id, "likes", uid), (s) => {
      setLiked(s.exists());
    });
    // repost mark
    const stopR = onSnapshot(doc(db, "posts", id, "reposts", uid), (s) => {
      setReposted(s.exists());
    });
    return () => { stopL(); stopR(); };
  }, [id, uid]);

  const isOwner = useMemo(() => !!uid && !!post?.uid && uid === post?.uid, [uid, post?.uid]);

  // LIKE toggle
  async function toggleLike() {
    if (!uid || !id) return;
    setBusyLike(true);
    try {
      const likeRef = doc(db, "posts", id, "likes", uid);
      if (liked) {
        await deleteDoc(likeRef);
        await updateDoc(doc(db, "posts", id), { likesCount: increment(-1) });
      } else {
        await setDoc(likeRef, { uid, createdAt: serverTimestamp() });
        await updateDoc(doc(db, "posts", id), { likesCount: increment(1) });
      }
    } finally {
      setBusyLike(false);
    }
  }

  // REPOST toggle — **bez jauna posta veidošanas**
  async function toggleRepost() {
    if (!uid || !id) return;
    setBusyRepost(true);
    try {
      const repRef = doc(db, "posts", id, "reposts", uid);

      if (reposted) {
        // UNREPOST
        await deleteDoc(repRef);
        await updateDoc(doc(db, "posts", id), { repostsCount: increment(-1) });

        // (neobligāti) ja kādreiz veidoji atsevišķus “repost postus” → iztīri
        const mineSnap = await getDocs(query(collection(db, "posts"), where("uid","==", uid)));
        const old = mineSnap.docs.filter(d => {
          const v = d.data() || {};
          return v.isRepost === true && v.originalId === id;
        });
        await Promise.all(old.map(d => deleteDoc(doc(db, "posts", d.id))));
      } else {
        // REPOST – tikai subkolekcijā
        await setDoc(repRef, { uid, createdAt: serverTimestamp() });
        await updateDoc(doc(db, "posts", id), { repostsCount: increment(1) });
      }
    } finally {
      setBusyRepost(false);
    }
  }

  // COMMENTS
  const [comment, setComment] = useState("");
  const [busyC, setBusyC] = useState(false);
  const [comments, setComments] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, "posts", id, "comments"), orderBy("createdAt", "asc"));
    const stop = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    });
    return () => stop();
  }, [id]);

  async function addComment() {
    if (!uid || !id) return;
    if (!comment.trim()) return;
    setBusyC(true);
    try {
      await addDoc(collection(db, "posts", id, "comments"), {
        uid, text: comment.trim(), createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, "posts", id), { commentsCount: increment(1) });
      setComment("");
    } finally {
      setBusyC(false);
    }
  }

  // EDIT/DELETE for owner
  const [editing, setEditing] = useState(false);
  const [newText, setNewText] = useState("");

  useEffect(() => {
    setNewText(post?.text || "");
  }, [post?.text]);

  async function saveEdit() {
    if (!id || !isOwner) return;
    await updateDoc(doc(db, "posts", id), { text: newText.trim() || null });
    setEditing(false);
  }

  async function removePost() {
    if (!id || !isOwner) return;
    if (!confirm("Delete this post permanently?")) return;
    await deleteDoc(doc(db, "posts", id));
    router.replace("/dashboard");
  }

  if (!ready) return null;
  if (!post) return <main className="wrap"><p>Post not found.</p></main>;

  return (
    <main className="wrap">
      <Card className="detail">
        <div className="header">
          <Link href="/dashboard" className="back">← Back</Link>
          <div className="meta">
            <span>Author: <strong>{post.uid}</strong></span>
            {post.createdAt?.seconds && (
              <span> • {new Date(post.createdAt.seconds*1000).toLocaleString()}</span>
            )}
          </div>
        </div>

        {post.imageURL && (
          <img className="heroImg" src={post.imageURL} alt="" />
        )}

        {!editing ? (
          <p className="text">{post.text || <em>No text</em>}</p>
        ) : (
          <div className="field">
            <label className="label">Edit text</label>
            <textarea className="ta" rows={4} value={newText} onChange={(e)=>setNewText(e.target.value)} />
            <div className="row">
              <Button variant="secondary" onClick={()=>setEditing(false)}>Cancel</Button>
              <Button onClick={saveEdit}>Save</Button>
            </div>
          </div>
        )}

        <div className="row">
          <Button size="sm" onClick={toggleLike} disabled={busyLike}>
            {liked ? "♥ Liked" : "♡ Like"} {post.likesCount ? `(${post.likesCount})` : ""}
          </Button>
          <Button size="sm" onClick={toggleRepost} disabled={busyRepost}>
            {reposted ? "Unrepost" : "Repost"} {post.repostsCount ? `(${post.repostsCount})` : ""}
          </Button>
          {isOwner && !editing && (
            <>
              <Button size="sm" variant="secondary" onClick={()=>setEditing(true)}>Edit</Button>
              <Button size="sm" variant="danger" onClick={removePost}>Delete</Button>
            </>
          )}
        </div>

        {/* Comments */}
        <div className="comments">
          <h3 className="h3">Comments {post.commentsCount ? `(${post.commentsCount})` : ""}</h3>

          <div className="addC">
            <Input
              placeholder="Write a comment…"
              value={comment}
              onChange={(e)=>setComment((e.target as HTMLInputElement).value)}
            />
            <Button onClick={addComment} disabled={busyC || !comment.trim()}>
              Comment
            </Button>
          </div>

          <div className="list">
            {comments.map(c => (
              <div key={c.id} className="cItem">
                <div className="cHead">
                  <span className="cUid">{c.uid}</span>
                  {c.createdAt?.seconds && (
                    <span className="cTime">{new Date(c.createdAt.seconds*1000).toLocaleString()}</span>
                  )}
                </div>
                <div className="cText">{c.text}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <style jsx>{`
        .wrap { max-width: 900px; margin: 0 auto; padding: 24px; }
        .detail { padding: 16px; border:1px solid #e5e7eb; border-radius:16px; background:#fff; }
        .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
        .back { text-decoration:none; color:#0f172a; }
        .meta { color:#6b7280; font-size:14px; }
        .heroImg { width:100%; border-radius:12px; border:1px solid #e5e7eb; margin: 8px 0 12px; object-fit:cover; }
        .text { font-size:16px; color:#0f172a; margin: 6px 0 10px; }
        .row { display:flex; gap:10px; align-items:center; margin: 8px 0; }
        .comments { margin-top: 16px; }
        .h3 { font-size:16px; font-weight:700; margin: 0 0 8px; }
        .addC { display:grid; grid-template-columns: 1fr auto; gap:8px; align-items:center; margin-bottom: 10px; }
        .list { display:grid; gap:8px; }
        .cItem { border:1px solid #e5e7eb; border-radius:12px; padding:10px; background:#fff; }
        .cHead { display:flex; gap:8px; color:#6b7280; font-size:13px; }
        .cUid { font-weight:600; color:#111827; }
        .cTime { color:#6b7280; }
        .field { margin: 8px 0; }
        .label { display:block; margin-bottom:6px; font-weight:600; color:#0f172a; }
        .ta { width:100%; border:1px solid #d1d5db; border-radius:12px; padding:10px 12px; background:#fff; font-size:14px; }
      `}</style>
    </main>
  );
}
