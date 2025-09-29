
"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Card from "@/components/ui/Card";
import PostCard from "@/components/posts/PostCard";

type PostDoc = {
  id: string;
  uid?: string | null;
  text?: string | null;
  imageURL?: string | null;
  createdAt?: Timestamp | { seconds: number; nanoseconds: number } | null;
};

export default function PostsPage() {
  const [posts, setPosts] = useState<PostDoc[]>([]);

  useEffect(() => {
    const qy = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const stop = onSnapshot(qy, (snap) => {
      const rows: PostDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PostDoc, "id">) }));
      setPosts(rows);
    });
    return () => stop();
  }, []);

  return (
    <main className="wrap">
      <h1 className="title">Posts</h1>

      <div className="grid">
        {posts.map((p) => (
          <Card key={p.id}>
            <div className="post">
            
              <PostCard post={{ ...p, uid: p.uid ?? undefined }} />
            </div>
          </Card>
        ))}
      </div>

      <style jsx>{`
        .wrap { max-width: 960px; margin: 0 auto; padding: 24px; }
        .title { font-size: 28px; font-weight: 700; margin-bottom: 16px; }
        .grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
        .post { display: grid; gap: 8px; }
        .text { font-size: 15px; color: #111827; }
        .img { width: 100%; border-radius: 12px; border: 1px solid #e5e7eb; object-fit: cover; }
      `}</style>
    </main>
  );
}
