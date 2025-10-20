"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebas1e";
import PostCard, { Post } from "@/components/posts/PostCard";

type PostDoc = Post & {
  createdAt?: Timestamp | { seconds: number; nanoseconds: number } | null;
};

export default function PostsPage() {
  const [posts, setPosts] = useState<PostDoc[]>([]);

  useEffect(() => {
    const qy = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const stop = onSnapshot(qy, (snap) => {
      const rows: PostDoc[] = snap.docs.map((docSnap) => {
        const data = docSnap.data() as Omit<PostDoc, "id">;
        return { id: docSnap.id, ...data };
      });
      setPosts(rows);
    });
    return () => stop();
  }, []);

  return (
    <main className="wrap">
      <h1 className="title">Posts</h1>

      <div className="grid">
        {posts.map((p) => (
          <div key={p.id}>
            <div className="post">
              <PostCard post={{ ...p, uid: p.uid ?? undefined }} />
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .wrap { max-width: 960px; margin: 0 auto; padding: 24px; }
        .title { font-size: 28px; font-weight: 700; margin-bottom: 16px; }
        .grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
        .post { display: grid; gap: 8px; }
      `}</style>
    </main>
  );
}
