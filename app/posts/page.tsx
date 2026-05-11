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
      {/* hero */}
      <section className="hero">
        <div className="heroCopy">
          <span className="eyebrow">Community</span>
          <h1 className="title">Posts</h1>
          <p className="intro">Share updates, food photos, tips, and see what&apos;s cooking in the community.</p>
        </div>
        <div className="heroStats">
          <div className="heroStat">
            <strong className="heroStatVal">{posts.length}</strong>
            <span className="heroStatLabel">Posts</span>
          </div>
          <div className="heroDivider" />
          <div className="heroStat">
            <strong className="heroStatVal"><span className="livePulse" />Live</strong>
            <span className="heroStatLabel">Feed</span>
          </div>
          <div className="heroDivider" />
          <div className="heroStat">
            <strong className="heroStatVal">{uid ? "Active" : "Guest"}</strong>
            <span className="heroStatLabel">Mode</span>
          </div>
        </div>
      </section>

      {/* two-column layout */}
      <div className="layout">
        {/* left: composer + feed */}
        <div className="main">
          <PostComposer />

          <div className="feedBar">
            <div>
              <span className="feedEyebrow">Feed</span>
              <h2 className="feedTitle">Latest posts</h2>
            </div>
            <span className="feedCount">{posts.length} post{posts.length === 1 ? "" : "s"}</span>
          </div>

          <div className="feed">
            {posts.length === 0 ? (
              <div className="empty">
                <p className="emptyTitle">No posts yet</p>
                <p className="emptyText">Be the first to share something with the community.</p>
              </div>
            ) : (
              posts.map((p) => (
                <PostCard
                  key={p.id}
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
              ))
            )}
          </div>
        </div>

        {/* sidebar */}
        <aside className="sidebar">
          <div className="sideCard">
            <div className="sideHead">
              <span className="sideEyebrow">Overview</span>
              <h3 className="sideTitle">Community</h3>
            </div>
            <div className="statList">
              <div className="statRow">
                <span className="statLabel">Total posts</span>
                <strong className="statVal">{posts.length}</strong>
              </div>
              <div className="statRow">
                <span className="statLabel">Feed status</span>
                <strong className="statVal statLive"><span className="liveDot" />Live</strong>
              </div>
              <div className="statRow">
                <span className="statLabel">Your account</span>
                <strong className="statVal">{uid ? "Signed in" : "Guest"}</strong>
              </div>
            </div>
          </div>

          <div className="sideCard">
            <div className="sideHead">
              <span className="sideEyebrow">Guidelines</span>
              <h3 className="sideTitle">Community rules</h3>
            </div>
            <ul className="ruleList">
              <li>Be kind and respectful to others</li>
              <li>Keep content food &amp; fitness related</li>
              <li>No spam or excessive self-promotion</li>
              <li>Report content that breaks the rules</li>
            </ul>
          </div>
        </aside>
      </div>

      <style jsx>{`
        .wrap {
          max-width: 1100px;
          margin: 0 auto;
          padding: 24px 20px 40px;
          display: grid;
          gap: 20px;
        }

        /* ── hero ── */
        .hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
          padding: 28px 32px;
          border-radius: 28px;
          border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
          background:
            radial-gradient(circle at top right, color-mix(in oklab, var(--primary) 18%, transparent), transparent 35%),
            linear-gradient(135deg, color-mix(in oklab, var(--bg2) 94%, transparent), color-mix(in oklab, var(--bg) 88%, var(--bg2) 12%));
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
        }
        .heroCopy {
          display: grid;
          gap: 8px;
        }
        .eyebrow {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .title {
          margin: 0;
          font-size: clamp(30px, 4vw, 40px);
          font-weight: 900;
          letter-spacing: -0.03em;
          color: var(--text);
        }
        .intro {
          margin: 0;
          color: var(--muted);
          font-size: 14px;
          max-width: 44ch;
        }
        .heroStats {
          display: flex;
          align-items: stretch;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          border-radius: 20px;
          overflow: hidden;
          background: color-mix(in oklab, var(--bg) 78%, transparent);
          flex-shrink: 0;
        }
        .heroStat {
          display: grid;
          gap: 3px;
          text-align: center;
          padding: 14px 22px;
          min-width: 80px;
        }
        .heroStatVal {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 17px;
          font-weight: 800;
          color: var(--text);
          letter-spacing: -0.02em;
        }
        .heroStatLabel {
          font-size: 11px;
          font-weight: 700;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .heroDivider {
          width: 1px;
          background: color-mix(in oklab, var(--border) 75%, transparent);
          flex-shrink: 0;
          align-self: stretch;
        }
        .livePulse {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          flex-shrink: 0;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%   { box-shadow: 0 0 0 0   rgba(34, 197, 94, 0.55); }
          70%  { box-shadow: 0 0 0 7px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0   rgba(34, 197, 94, 0); }
        }

        /* ── two-column layout ── */
        .layout {
          display: grid;
          grid-template-columns: 1fr 288px;
          gap: 20px;
          align-items: start;
        }
        .main {
          display: grid;
          gap: 16px;
          min-width: 0;
        }

        /* ── feed header ── */
        .feedBar {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
          padding: 0 2px;
        }
        .feedEyebrow {
          display: block;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 4px;
        }
        .feedTitle {
          margin: 0;
          font-size: 19px;
          font-weight: 800;
          color: var(--text);
          letter-spacing: -0.02em;
        }
        .feedCount {
          color: var(--muted);
          font-size: 13px;
          font-weight: 600;
          padding-bottom: 2px;
        }

        /* ── feed ── */
        .feed {
          display: grid;
          gap: 14px;
        }
        .empty {
          padding: 40px 24px;
          border-radius: 22px;
          border: 1px dashed color-mix(in oklab, var(--border) 80%, transparent);
          text-align: center;
          background: color-mix(in oklab, var(--bg2) 55%, transparent);
        }
        .emptyTitle {
          margin: 0 0 8px;
          font-size: 17px;
          font-weight: 800;
          color: var(--text);
        }
        .emptyText {
          margin: 0;
          font-size: 14px;
          color: var(--muted);
        }

        /* ── sidebar ── */
        .sidebar {
          display: grid;
          gap: 14px;
          position: sticky;
          top: 80px;
        }
        .sideCard {
          display: grid;
          gap: 14px;
          padding: 18px 20px;
          border-radius: 22px;
          border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
          background: linear-gradient(180deg,
            color-mix(in oklab, var(--bg2) 96%, transparent),
            color-mix(in oklab, var(--bg) 90%, var(--bg2) 10%)
          );
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
        }
        .sideHead {
          display: grid;
          gap: 3px;
        }
        .sideEyebrow {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .sideTitle {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
          color: var(--text);
          letter-spacing: -0.02em;
        }
        .statList {
          border: 1px solid color-mix(in oklab, var(--border) 78%, transparent);
          border-radius: 14px;
          overflow: hidden;
        }
        .statRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-bottom: 1px solid color-mix(in oklab, var(--border) 68%, transparent);
        }
        .statRow:last-child {
          border-bottom: none;
        }
        .statLabel {
          font-size: 13px;
          color: var(--muted);
        }
        .statVal {
          font-size: 13px;
          font-weight: 700;
          color: var(--text);
        }
        .statLive {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .liveDot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #22c55e;
          flex-shrink: 0;
        }
        .ruleList {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 9px;
        }
        .ruleList li {
          font-size: 13px;
          color: var(--muted);
          padding-left: 18px;
          position: relative;
          line-height: 1.45;
        }
        .ruleList li::before {
          content: "→";
          position: absolute;
          left: 0;
          color: var(--primary);
          font-size: 11px;
          font-weight: 800;
          top: 1px;
        }

        /* ── responsive ── */
        @media (max-width: 900px) {
          .layout {
            grid-template-columns: 1fr;
          }
          .sidebar {
            position: static;
            display: none;
          }
          .heroStats {
            width: 100%;
          }
          .heroStat {
            flex: 1;
            padding: 12px 16px;
            min-width: 0;
          }
        }
        @media (max-width: 720px) {
          .wrap {
            padding: 18px 16px 32px;
          }
          .hero {
            padding: 20px;
            border-radius: 22px;
            gap: 16px;
          }
          .heroStats {
            border-radius: 16px;
          }
        }
      `}</style>
    </main>
  );
}
