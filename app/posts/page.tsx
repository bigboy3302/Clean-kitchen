"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebas1e";
import PostCard, { Post } from "@/components/posts/PostCard";
import PostComposer from "@/components/posts/PostComposer";
import { useAuthModal } from "@/context/AuthModalContext";

type PostDoc = Post & {
  createdAt?: Timestamp | { seconds: number; nanoseconds: number } | null;
};

function getImageDims(file: File) {
  return new Promise<{ w: number; h: number }>((res, rej) => {
    const img = new Image();
    img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

function getVideoDims(file: File) {
  return new Promise<{ w: number; h: number; duration: number }>((res, rej) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      res({ w: v.videoWidth, h: v.videoHeight, duration: v.duration });
      URL.revokeObjectURL(v.src);
    };
    v.onerror = rej;
    v.src = URL.createObjectURL(file);
  });
}

async function uploadWithProgress(storageRef: ReturnType<typeof ref>, file: File) {
  const task = uploadBytesResumable(storageRef, file);
  return new Promise<string>((resolve, reject) => {
    task.on(
      "state_changed",
      null,
      (err) => reject(err || new Error("Upload failed.")),
      async () => resolve(await getDownloadURL(storageRef))
    );
  });
}

export default function PostsPage() {
  const { openLogin } = useAuthModal();
  const [posts, setPosts] = useState<PostDoc[]>([]);
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [userEmail, setUserEmail] = useState<string>(auth.currentUser?.email ?? "");

  useEffect(() => {
    const stopAuth = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      setUserEmail(user?.email ?? "");
    });
    return () => stopAuth();
  }, []);

  useEffect(() => {
    const qy = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const stop = onSnapshot(qy, async (snap) => {
      const rows: PostDoc[] = snap.docs.map((docSnap) => {
        const data = docSnap.data() as Omit<PostDoc, "id">;
        return { id: docSnap.id, ...data };
      });

      // fetch current names/avatars from usersPublic so name changes show up immediately
      const uids = [...new Set(rows.map((r) => r.uid).filter((id): id is string => !!id))];
      const nameMap: Record<string, { displayName?: string | null; username?: string | null; avatarURL?: string | null }> = {};
      await Promise.all(
        uids.map(async (uid) => {
          try {
            const pubSnap = await getDoc(doc(db, "usersPublic", uid));
            if (pubSnap.exists()) {
              nameMap[uid] = pubSnap.data() as typeof nameMap[string];
            }
          } catch {
            // ignore — fall back to stored value
          }
        })
      );

      const enriched = rows.map((r) => {
        const pub = r.uid ? nameMap[r.uid] : undefined;
        if (!pub) return r;
        return {
          ...r,
          author: {
            ...r.author,
            ...(pub.displayName !== undefined ? { displayName: pub.displayName } : {}),
            ...(pub.username !== undefined ? { username: pub.username } : {}),
            ...(pub.avatarURL !== undefined ? { avatarURL: pub.avatarURL } : {}),
          },
        };
      });

      setPosts(enriched);
    });
    return () => stop();
  }, []);

  async function handleEdit(post: Post, nextText: string) {
    if (!uid || !post?.id) return;
    await setDoc(doc(db, "posts", post.id), { text: nextText || null }, { merge: true });
  }

  async function handleAddMedia(post: Post, files: File[]) {
    if (!uid || !post?.id || !files?.length) return;
    const uploaded = [];
    for (const file of files.slice(0, 4)) {
      const isVideo = file.type.startsWith("video");
      let w = 0;
      let h = 0;
      let duration;
      try {
        if (isVideo) {
          const d = await getVideoDims(file);
          w = d.w;
          h = d.h;
          duration = d.duration;
        } else {
          const d = await getImageDims(file);
          w = d.w;
          h = d.h;
        }
      } catch {}
      const safeName = `${Date.now()}-${file.name}`.replace(/\s+/g, "_");
      const storagePath = `posts/${uid}/${post.id}/${safeName}`;
      const url = await uploadWithProgress(ref(storage, storagePath), file);
      uploaded.push({
        mid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: isVideo ? "video" : "image",
        url,
        storagePath,
        w,
        h,
        ...(isVideo ? { duration } : {}),
      });
    }
    if (uploaded.length) {
      await setDoc(doc(db, "posts", post.id), { media: [...(post.media || []), ...uploaded] }, { merge: true });
    }
  }

  async function handleDelete(post: Post) {
    if (!uid || !post?.id) return;
    await deleteDoc(doc(db, "posts", post.id));
  }

  async function handleReport(post: Post, details: { reason: string; postUrl?: string | null }) {
    const me = auth.currentUser;
    if (!me || !post?.id) {
      openLogin(`/posts/${post?.id ?? ""}`);
      throw new Error("AUTH_REQUIRED");
    }
    const reason = typeof details?.reason === "string" ? details.reason.trim() : "";
    if (reason.length < 10) throw new Error("Please provide at least 10 characters explaining the issue.");
    const idToken = await me.getIdToken();
    const postRef = doc(db, "posts", post.id, "reports", me.uid);
    const postPreview = (post?.title || post?.text || post?.description || "").toString().slice(0, 180);
    await setDoc(
      postRef,
      { uid: me.uid, postId: post.id, postOwnerUid: post?.uid ?? null, postPreview, reason, createdAt: serverTimestamp() },
      { merge: false }
    );
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        postId: post.id,
        postOwnerUid: post.uid ?? null,
        postAuthor: post.author ?? null,
        reporterUid: me.uid,
        reporterEmail: userEmail || null,
        reason,
        postText: post.text || post.description || "",
        postUrl: details?.postUrl || null,
        postPreview,
      }),
    });
    let payload: { ok?: boolean; error?: string; message?: string } | null = null;
    try {
      payload = (await response.json()) as { ok?: boolean; error?: string; message?: string };
    } catch {}
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || payload?.message || `Failed to deliver report (status ${response.status}).`);
    }
  }

  async function handleComment() {}

  async function handleToggleRepost(post: Post, next: boolean) {
    if (!uid || !post?.id) {
      openLogin(`/posts/${post?.id ?? ""}`);
      throw new Error("AUTH_REQUIRED");
    }
    const recordRef = doc(db, "posts", post.id, "reposts", uid);
    const postRef = doc(db, "posts", post.id);
    if (next) {
      await setDoc(recordRef, { uid, createdAt: serverTimestamp() });
      await updateDoc(postRef, { reposts: (post.reposts || 0) + 1 }).catch(() => {});
    } else {
      await deleteDoc(recordRef);
      await updateDoc(postRef, { reposts: Math.max(0, (post.reposts || 1) - 1) }).catch(() => {});
    }
  }

  async function handleToggleLike(post: Post, liked: boolean) {
    if (!uid || !post?.id) {
      openLogin(`/posts/${post?.id ?? ""}`);
      throw new Error("AUTH_REQUIRED");
    }
    const refDoc = doc(db, "posts", post.id, "likes", uid);
    if (liked) await setDoc(refDoc, { uid, createdAt: serverTimestamp() });
    else await deleteDoc(refDoc);
  }

  return (
    <main className="wrap ck-page ck-community-page">
      <section className="hero">
        <div className="heroCopy">
          <span className="eyebrow">Community</span>
          <h1 className="title">Posts</h1>
          <p className="intro">Share updates, food photos, tips, and see what’s new from the community.</p>
          <div className="heroMeta">
            <span className="metaPill">{posts.length} posts</span>
            <span className="metaPill">{uid ? "Signed in" : "Guest mode"}</span>
            <span className="metaPill">Live feed</span>
          </div>
        </div>
      </section>

      <section className="composerSection">
        <div className="sectionCard">
          <div className="sectionHead">
            <div>
              <span className="sectionEyebrow">Create</span>
              <h2>Start a post</h2>
            </div>
            <span className="sectionHint">Share with the community</span>
          </div>
          <PostComposer />
        </div>
      </section>

      <section className="feedSection">
        <div className="sectionCard">
          <div className="feedHead">
            <div>
              <span className="sectionEyebrow">Feed</span>
              <h2>Latest posts</h2>
            </div>
            <span>{posts.length} total</span>
          </div>

          <div className="grid">
            {posts.map((p) => (
              <div key={p.id} className="post">
                <PostCard
                  post={{ ...p, uid: p.uid ?? undefined }}
                  meUid={uid}
                  onEdit={handleEdit}
                  onAddMedia={handleAddMedia}
                  onDelete={handleDelete}
                  onReport={handleReport}
                  onComment={handleComment}
                  onToggleRepost={handleToggleRepost}
                  onToggleLike={handleToggleLike}
                />
              </div>
            ))}
            {posts.length === 0 ? <div className="empty">No community posts yet.</div> : null}
          </div>
        </div>
      </section>

      <style jsx>{`
        .wrap {
          max-width: 980px;
          margin: 0 auto;
          padding: 24px 20px 36px;
          display: grid;
          gap: 18px;
        }
        .hero {
          padding: 22px 24px;
          border-radius: 24px;
          border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
          background:
            radial-gradient(circle at top right, color-mix(in oklab, var(--primary) 14%, transparent), transparent 28%),
            linear-gradient(135deg, color-mix(in oklab, var(--bg2) 94%, transparent), color-mix(in oklab, var(--bg) 88%, var(--bg2) 12%));
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
        }
        .heroCopy {
          display: grid;
          gap: 10px;
        }
        .eyebrow {
          display: inline-block;
          margin-bottom: 8px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .title {
          margin: 0;
          font-size: clamp(30px, 4vw, 38px);
          letter-spacing: -0.03em;
          color: var(--text);
        }
        .intro {
          margin: 0;
          color: var(--muted);
          font-size: 14px;
        }
        .heroMeta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .metaPill {
          display: inline-flex;
          align-items: center;
          min-height: 32px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--primary) 22%, var(--border));
          background: color-mix(in oklab, var(--bg) 82%, transparent);
          color: var(--text);
          font-size: 12px;
          font-weight: 700;
        }
        .composerSection,
        .feedSection {
          display: grid;
          gap: 14px;
        }
        .sectionCard {
          display: grid;
          gap: 16px;
          padding: 18px;
          border-radius: 24px;
          border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
          background:
            linear-gradient(180deg, color-mix(in oklab, var(--bg2) 96%, transparent), color-mix(in oklab, var(--bg) 90%, var(--bg2) 10%));
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
        }
        .sectionHead,
        .feedHead {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: end;
          flex-wrap: wrap;
        }
        .sectionEyebrow {
          display: inline-block;
          margin-bottom: 6px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .sectionHead h2,
        .feedHead h2 {
          margin: 0;
          color: var(--text);
          font-size: 20px;
          letter-spacing: -0.02em;
        }
        .sectionHint,
        .feedHead span {
          color: var(--muted);
          font-size: 13px;
        }
        .grid {
          display: grid;
          gap: 16px;
        }
        .empty {
          padding: 18px;
          border-radius: 16px;
          border: 1px dashed var(--border);
          color: var(--muted);
          text-align: center;
          background: var(--bg-raised);
        }
        @media (max-width: 768px) {
          .wrap {
            padding: 18px 16px 28px;
          }
          .hero {
            padding: 18px;
            border-radius: 20px;
          }
          .sectionCard {
            padding: 14px;
            border-radius: 20px;
          }
        }
      `}</style>
    </main>
  );
}
