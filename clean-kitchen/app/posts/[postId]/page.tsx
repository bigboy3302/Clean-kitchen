"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot, collection, orderBy, query } from "firebase/firestore";
import PostCard from "@/components/posts/PostCard";
import CommentInput from "@/components/comments/CommentInput";
import CommentItem from "@/components/comments/CommentItem";

type CommentDoc = {
  id: string;
  uid: string;
  text?: string | null;
  createdAt?: any;
  author?: { displayName?: string | null; username?: string | null; avatarURL?: string | null } | null;
};

export default function PostThreadPage() {
  const { postId } = useParams<{ postId: string }>();
  const router = useRouter();
  const [post, setPost] = useState<any | null>(null);
  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postId) return;
    (async () => {
      const snap = await getDoc(doc(db, "posts", String(postId)));
      if (!snap.exists()) { router.replace("/dashboard"); return; }
      setPost({ id: snap.id, ...(snap.data() || {}) });
      setLoading(false);
    })();
  }, [postId, router]);

  useEffect(() => {
    if (!postId) return;
    const q = query(collection(db, "posts", String(postId), "comments"), orderBy("createdAt", "asc"));
    const stop = onSnapshot(q, (snap) => {
      setComments(
        snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            uid: data.uid,
            text: data.text ?? "",
            createdAt: data.createdAt,
            author: data.author ?? null,
          };
        })
      );
    });
    return () => stop();
  }, [postId]);

  function toDate(ts: any): Date | null {
    if (!ts) return null;
    if (typeof ts?.toDate === "function") return ts.toDate();
    if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000);
    return null;
  }

  if (loading || !post) return null;

  return (
    <main className="wrap" style={{ maxWidth: 900 }}>
      <PostCard post={post} />

      <section className="comments">
        <h2 className="h2">Comments</h2>

        <CommentInput postId={String(postId)} />

        <ul className="comment-list">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              authorName={
                c.author?.displayName ||
                c.author?.username ||
                (c.uid ? c.uid.slice(0, 6) : "User")
              }
              avatarURL={c.author?.avatarURL ?? undefined}
              createdAt={toDate(c.createdAt)}
              text={c.text ?? ""}
              previewChars={800}
              previewLines={10}
            />
          ))}
          {comments.length === 0 && <p className="muted">Be the first to comment.</p>}
        </ul>
      </section>
    </main>
  );
}
