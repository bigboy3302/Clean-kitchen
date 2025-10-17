"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  limit as fsLimit,
  addDoc,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

import { auth, db, storage } from "@/lib/firebase";
import PostCard from "@/components/posts/PostCard";


function getImageDims(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
function getVideoDims(file) {
  return new Promise((res, rej) => {
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
async function uploadWithProgress(storageRef, file) {
  const task = uploadBytesResumable(storageRef, file);
  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      null,
      (err) => reject(err || new Error("Upload failed.")),
      async () => resolve(await getDownloadURL(storageRef))
    );
  });
}

function valueToMillis(value) {
  if (!value) return 0;
  if (typeof value === "number") {
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object") {
    const seconds = value?.seconds;
    if (typeof seconds === "number") return seconds * 1000;
    const milliseconds = value?.milliseconds;
    if (typeof milliseconds === "number") return milliseconds;
  }
  return 0;
}

function formatRelativeFromMs(ms) {
  if (!ms) return "";
  const diffSeconds = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  const steps = [
    [60, "s"],
    [60, "m"],
    [24, "h"],
    [7, "d"],
    [4.345, "w"],
    [12, "mo"],
    [Number.MAX_SAFE_INTEGER, "y"],
  ];
  let value = diffSeconds;
  let idx = 0;
  for (; idx < steps.length - 1 && value >= steps[idx][0]; idx++) {
    value = Math.floor(value / steps[idx][0]);
  }
  return `${value}${steps[idx][1]}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [uid, setUid] = useState(null);
  const [ready, setReady] = useState(false);

  const [recentPosts, setRecentPosts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [trendingReposts, setTrendingReposts] = useState({});
  const trendingSorted = useMemo(() => {
    const withIndex = trending.map((post, idx) => ({ post, idx }));
    return withIndex
      .map(({ post, idx }) => ({
        post,
        idx,
        count: trendingReposts[post.id] ?? post.reposts ?? 0,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        const aTime =
          typeof a.post.createdAt === "object" && a.post.createdAt?.seconds
            ? a.post.createdAt.seconds
            : typeof a.post.createdAt === "number"
            ? a.post.createdAt
            : 0;
        const bTime =
          typeof b.post.createdAt === "object" && b.post.createdAt?.seconds
            ? b.post.createdAt.seconds
            : typeof b.post.createdAt === "number"
            ? b.post.createdAt
            : 0;
        if (bTime !== aTime) return bTime - aTime;
        return a.idx - b.idx;
      })
      .map(({ post }) => post);
  }, [trending, trendingReposts]);

  const myPosts = useMemo(
    () => (uid ? recentPosts.filter((p) => p?.uid === uid) : []),
    [recentPosts, uid]
  );
  const myMediaCount = useMemo(
    () =>
      myPosts.reduce(
        (acc, item) => acc + (Array.isArray(item?.media) ? item.media.length : 0),
        0
      ),
    [myPosts]
  );
  const lastPostMs = useMemo(() => {
    if (!myPosts.length) return 0;
    return myPosts.reduce((latest, item) => {
      const ts = valueToMillis(item?.createdAt);
      return ts > latest ? ts : latest;
    }, 0);
  }, [myPosts]);
  const lastPostLabel = useMemo(() => {
    if (!myPosts.length) return "Share your first post";
    const ago = formatRelativeFromMs(lastPostMs);
    return ago ? `Last post · ${ago} ago` : "Last post";
  }, [myPosts.length, lastPostMs]);


  const [openComposer, setOpenComposer] = useState(false);
  const [postText, setPostText] = useState("");
  const [postFiles, setPostFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [busyPost, setBusyPost] = useState(false);
  const [errPost, setErrPost] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/auth/login");
        return;
      }
      setUid(u.uid);
      setReady(true);
    });
    return () => stop();
  }, [router]);

  useEffect(() => {
    const qy = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
      fsLimit(50)
    );
    const stop = onSnapshot(qy, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() || {}) }))
        .filter((p) => p.isRepost !== true);
      setRecentPosts(list);
    });
    return () => stop();
  }, []);

  useEffect(() => {
    const ids = trending.map((p) => p.id).filter(Boolean);
    if (ids.length === 0) {
      setTrendingReposts({});
      return;
    }

    setTrendingReposts((prev) => {
      const next = {};
      ids.forEach((id) => {
        next[id] = prev[id] ?? 0;
      });
      return next;
    });

    const unsubs = ids.map((id) =>
      onSnapshot(collection(db, "posts", id, "reposts"), (snap) => {
        setTrendingReposts((prev) => {
          const count = snap.size;
          if (prev[id] === count) return prev;
          return { ...prev, [id]: count };
        });
      })
    );

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [trending]);

  useEffect(() => {
    const tQ = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
      fsLimit(5)
    );
    const stop = onSnapshot(tQ, (snap) => {
      setTrending(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
    });
    return () => stop();
  }, []);

  async function handleToggleLike(post, liked) {
    const curUid = auth.currentUser?.uid || null;
    if (!curUid) {
      console.warn("Like blocked: no auth user");
      throw new Error("Not signed in");
    }
    if (!post?.id) return;

    const likeRef = doc(db, "posts", post.id, "likes", curUid);
    try {
      const snap = await getDoc(likeRef);
      console.log("[like] path:", likeRef.path, "auth:", curUid, "liked:", liked, "exists:", snap.exists());
      if (liked) {
        if (!snap.exists()) {
          await setDoc(likeRef, { uid: curUid, createdAt: serverTimestamp() });
        }
      } else {
        if (snap.exists()) {
          await deleteDoc(likeRef);
        }
      }
    } catch (e) {
      console.error("[like] failed", { path: likeRef.path, auth: curUid, postId: post.id }, e);
      throw e; 
    }
  }

  async function handleToggleRepost(post, next) {
    if (!uid || !post?.id) return;
    const rRef = doc(db, "posts", post.id, "reposts", uid);
    const rSnap = await getDoc(rRef);
    if (next) {
      if (!rSnap.exists()) await setDoc(rRef, { uid, createdAt: serverTimestamp() });
    } else {
      if (rSnap.exists()) await deleteDoc(rRef);
    }
  }

  async function handleEdit(post, nextText) {
    if (!uid || !post?.id) return;
    await setDoc(doc(db, "posts", post.id), { text: nextText || null }, { merge: true });
  }

  async function handleAddMedia(post, files) {
    if (!uid || !post?.id || !files?.length) return;
    const uploaded = [];
    for (const file of files.slice(0, 4)) {
      const isVideo = file.type.startsWith("video");
      let w = 0, h = 0, duration;
      try {
        if (isVideo) {
          const d = await getVideoDims(file);
          w = d.w; h = d.h; duration = d.duration;
        } else {
          const d = await getImageDims(file);
          w = d.w; h = d.h;
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
      await setDoc(
        doc(db, "posts", post.id),
        { media: [...(post.media || []), ...uploaded] },
        { merge: true }
      );
    }
  }

  async function handleDelete(post) {
    if (!uid || !post?.id) return;
    await deleteDoc(doc(db, "posts", post.id));
  }

  async function handleReport(post) {
    if (!uid || !post?.id) return;
    await setDoc(doc(db, "posts", post.id, "reports", uid), {
      uid,
      createdAt: serverTimestamp(),
    });
  }

  async function handleComment() {
  }

  function onPick(e) {
    const list = Array.from(e.target.files || []).slice(0, 4);
    setPostFiles(list);
    setPreviews(
      list.map((f) => ({
        url: URL.createObjectURL(f),
        type: f.type.startsWith("video") ? "video" : "image",
      }))
    );
  }

  async function createPost() {
    if (!uid) return;
    const text = postText.trim();
    if (!text && postFiles.length === 0) return;

    setBusyPost(true);
    setErrPost(null);
    try {
    
      let author = { username: null, displayName: null, avatarURL: null };
      try {
        const uSnap = await getDoc(doc(db, "users", uid));
        if (uSnap.exists()) {
          const u = uSnap.data() || {};
          author = {
            username: u.username || null,
            displayName: u.firstName
              ? `${u.firstName}${u.lastName ? " " + u.lastName : ""}`
              : u.displayName || null,
            avatarURL: u.photoURL || null,
          };
        }
      } catch {}

 
      const postRef = await addDoc(collection(db, "posts"), {
        uid,
        text: text || null,
        media: [],
        likes: 0,     
        reposts: 0,   
        createdAt: serverTimestamp(),
        author,
      });

      if (postFiles.length) {
        const uploaded = [];
        for (const file of postFiles) {
          const isVideo = file.type.startsWith("video");
          let w = 0, h = 0, duration;
          try {
            if (isVideo) {
              const d = await getVideoDims(file);
              w = d.w; h = d.h; duration = d.duration;
            } else {
              const d = await getImageDims(file);
              w = d.w; h = d.h;
            }
          } catch {}
          const safeName = `${Date.now()}-${file.name}`.replace(/\s+/g, "_");
          const storagePath = `posts/${uid}/${postRef.id}/${safeName}`;
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
        await updateDoc(postRef, { media: uploaded });
      }


      setPostText("");
      setPostFiles([]);
      setPreviews([]);
      if (fileRef.current) fileRef.current.value = "";
      setOpenComposer(false);
    } catch (e) {
      const msg = String(e?.message || e);
      setErrPost(/permission|insufficient|denied/i.test(msg)
        ? "Permission denied. Check auth and rules."
        : msg);
    } finally {
      setBusyPost(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="page">
      <section className="hero container">
        <div className="hero-card">
          <div className="hero-content">
            <p className="hero-eyebrow">Creator hub</p>
            <h1 className="hero-title">Your Clean Kitchen dashboard</h1>
            <p className="hero-copy">
              Share pantry, fitness progress, and kitchen inspiration with the community.
            </p>
            <div className="hero-actions">
              <button className="hero-primary" onClick={() => setOpenComposer(true)}>
                Create post
              </button>
              <Link href="/profile" className="hero-secondary">
                View profile
              </Link>
            </div>
          </div>
          <div className="hero-stats">
            <div className="stat-pill">
              <span className="stat-value">{myPosts.length}</span>
              <span className="stat-label">Live posts</span>
            </div>
            <div className="stat-pill">
              <span className="stat-value">{myMediaCount}</span>
              <span className="stat-label">Media attachments</span>
            </div>
            <div className="stat-pill">
              <span className="stat-value">{trendingSorted.length}</span>
              <span className="stat-label">Trending now</span>
              <span className="stat-sub">{lastPostLabel}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="container layout">
        <section className="stream">
          <div className="stream-head">
            <div>
              <h2>Community feed</h2>
              <p>Fresh updates from the people keeping their kitchens on track.</p>
            </div>
            <button className="stream-new" onClick={() => setOpenComposer(true)}>
              New post
            </button>
          </div>
          <div className="feed">
            {recentPosts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                meUid={uid}
                onEdit={handleEdit}
                onAddMedia={handleAddMedia}
                onDelete={handleDelete}
                onReport={handleReport}
                onComment={handleComment}
                onToggleRepost={handleToggleRepost}
                onToggleLike={handleToggleLike}
              />
            ))}
            {recentPosts.length === 0 && <p className="empty">No posts yet.</p>}
          </div>
        </section>

        <aside className="sidebar">
          <div className="trend-card">
            <div className="trend-head">
              <div>
                <h2>Trending now</h2>
                <p>See what everyone is reposting today.</p>
              </div>
              <span className="trend-dot" aria-hidden />
            </div>
            {trendingSorted.length === 0 ? (
              <p className="trend-empty">No trending posts yet.</p>
            ) : (
              <ul className="trend-list">
                {trendingSorted.map((p, i) => {
                  const thumb = Array.isArray(p.media) && p.media[0]?.url ? p.media[0] : null;
                  const repostCount = trendingReposts[p.id] ?? p.reposts ?? 0;
                  return (
                    <li key={p.id} className="trend-item">
                      <Link href={`/posts/${p.id}`} className="trend-link">
                        <div className="trend-thumb">
                          {thumb ? (
                            thumb.type === "video" ? (
                              <video src={thumb.url} muted playsInline preload="metadata" />
                            ) : (
                              <img src={thumb.url} alt="" />
                            )
                          ) : (
                            <span>#{i + 1}</span>
                          )}
                        </div>
                        <div className="trend-body">
                          <div className="trend-row">
                            <span className="trend-rank">#{i + 1}</span>
                            <span className="trend-title">
                              {(p.text || p.description || p.title || "Untitled").slice(0, 80)}
                            </span>
                          </div>
                          <span className="trend-meta">
                            {repostCount} {repostCount === 1 ? "repost" : "reposts"}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>

     
      {openComposer && (
        <div className="backdrop" onClick={() => setOpenComposer(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="mHead">
              <div className="mTitle">Create post</div>
              <button className="x" onClick={() => setOpenComposer(false)}>✕</button>
            </div>

            <div className="mBody">
              {errPost ? <p className="bad">{errPost}</p> : null}

              <label className="lab">Text</label>
              <textarea
                rows={4}
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="What’s on your mind?"
              />

              <label className="lab">Media (up to 4)</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={onPick}
              />

              {previews.length > 0 && (
                <div className={`preview grid-${Math.min(previews.length, 2)}`}>
                  {previews.map((m, i) => (
                    <div key={i} className="pCell">
                      {m.type === "video" ? <video src={m.url} controls muted /> : <img src={m.url} alt="" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mFoot">
              <button className="btn ghost" onClick={() => setOpenComposer(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createPost} disabled={busyPost}>
                {busyPost ? "Publishing…" : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page {
          display: flex;
          flex-direction: column;
          gap: 40px;
          padding-bottom: 96px;
        }
        .container {
          width: min(1120px, 100%);
          margin: 0 auto;
          padding: 0 16px;
        }
        .hero {
          margin-top: 20px;
        }
        .hero-card {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          border-radius: var(--radius-card);
          padding: clamp(28px, 6vw, 44px);
          background: linear-gradient(
            135deg,
            color-mix(in oklab, var(--primary) 78%, #4338ca) 0%,
            color-mix(in oklab, var(--primary) 52%, #14b8a6) 100%
          );
          color: #fff;
          display: grid;
          gap: clamp(24px, 4vw, 40px);
        }
        .hero-card::before,
        .hero-card::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.55;
          mix-blend-mode: screen;
        }
        .hero-card::before {
          background: radial-gradient(
            circle at 18% 18%,
            rgba(255, 255, 255, 0.28) 0%,
            transparent 52%
          );
        }
        .hero-card::after {
          background: radial-gradient(
            circle at 82% 0%,
            rgba(255, 255, 255, 0.26) 0%,
            transparent 45%
          );
        }
        .hero-content {
          position: relative;
          display: grid;
          gap: 16px;
          max-width: 520px;
        }
        .hero-eyebrow {
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-size: 11px;
          font-weight: 700;
          opacity: 0.82;
        }
        .hero-title {
          margin: 0;
          font-size: clamp(28px, 5vw, 40px);
          font-weight: 800;
          line-height: 1.05;
        }
        .hero-copy {
          margin: 0;
          font-size: 15px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.76);
        }
        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .hero-primary {
          border: 0;
          border-radius: var(--radius-button);
          padding: 12px 20px;
          background: #fff;
          color: var(--primary);
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 16px 32px rgba(15, 23, 42, 0.28);
          transition: transform 0.12s ease, box-shadow 0.16s ease, opacity 0.16s ease;
        }
        .hero-primary:active {
          transform: translateY(1px);
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.22);
        }
        .hero-secondary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 18px;
          border-radius: var(--radius-button);
          border: 1px solid rgba(255, 255, 255, 0.3);
          background: rgba(15, 23, 42, 0.18);
          color: #fff;
          font-weight: 700;
          text-decoration: none;
          backdrop-filter: blur(12px);
        }
        .hero-secondary:hover {
          background: rgba(15, 23, 42, 0.28);
          text-decoration: none;
        }
        .hero-stats {
          position: relative;
          display: grid;
          gap: 18px;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        }
        .stat-pill {
          position: relative;
          padding: 16px;
          border-radius: var(--radius-card);
          background: rgba(15, 23, 42, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.28);
          backdrop-filter: blur(14px);
          display: grid;
          gap: 6px;
          min-height: 116px;
        }
        .stat-value {
          font-size: 30px;
          font-weight: 800;
          line-height: 1;
          color: #fff;
        }
        .stat-label {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.78);
        }
        .stat-sub {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
        }
        @media (max-width: 720px) {
          .hero-card {
            padding: 26px;
          }
          .stat-pill {
            min-height: 104px;
          }
        }
        .layout {
          display: grid;
          gap: 32px;
          grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
          align-items: start;
        }
        @media (max-width: 1080px) {
          .layout {
            grid-template-columns: 1fr;
          }
          .sidebar {
            order: -1;
          }
        }
        .stream {
          display: grid;
          gap: 20px;
        }
        .stream-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 0 4px;
        }
        .stream-head h2 {
          margin: 0;
          font-size: 22px;
          font-weight: 800;
        }
        .stream-head p {
          margin: 4px 0 0;
          color: var(--muted);
          font-size: 14px;
        }
        .stream-new {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: var(--radius-button);
          border: 1px solid color-mix(in oklab, var(--primary) 32%, var(--border));
          background: color-mix(in oklab, var(--primary) 12%, transparent);
          color: var(--primary);
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.12s ease, background 0.18s ease, border-color 0.18s ease;
        }
        .stream-new:hover {
          background: color-mix(in oklab, var(--primary) 22%, transparent);
        }
        .stream-new:active {
          transform: translateY(1px);
        }
        .feed {
          display: grid;
          gap: 18px;
        }
        :global(.feed > *) {
          max-width: 720px;
          width: 100%;
          margin: 0 auto;
        }
        .empty {
          text-align: center;
          padding: 28px;
          border-radius: var(--radius-card);
          background: var(--bg-raised);
          border: 1px dashed color-mix(in oklab, var(--primary) 24%, var(--border));
          color: var(--muted);
        }
        .sidebar {
          display: grid;
          gap: 20px;
        }
        .trend-card {
          position: sticky;
          top: 20px;
          display: grid;
          gap: 18px;
          padding: 22px;
          border-radius: var(--radius-card);
          background: var(--bg-raised);
          border: 1px solid var(--border);
          box-shadow: var(--shadow);
        }
        .trend-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }
        .trend-head h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
        }
        .trend-head p {
          margin: 4px 0 0;
          color: var(--muted);
          font-size: 13px;
        }
        .trend-dot {
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: var(--primary);
          box-shadow: 0 0 0 8px color-mix(in oklab, var(--primary) 18%, transparent);
        }
        .trend-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 12px;
        }
        .trend-item {
          border-radius: var(--radius-button);
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          background: color-mix(in oklab, var(--bg-raised) 92%, transparent);
          transition: border-color 0.18s ease, transform 0.14s ease, background 0.18s ease;
        }
        .trend-item:hover {
          background: color-mix(in oklab, var(--primary) 10%, var(--bg-raised));
          border-color: color-mix(in oklab, var(--primary) 26%, var(--border));
          transform: translateY(-2px);
        }
        .trend-link {
          display: grid;
          grid-template-columns: 56px 1fr;
          gap: 14px;
          align-items: center;
          padding: 12px;
          text-decoration: none;
          color: inherit;
        }
        .trend-thumb {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid var(--border);
          background: var(--bg);
          display: grid;
          place-items: center;
          font-weight: 800;
          color: var(--muted);
        }
        .trend-thumb img,
        .trend-thumb video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .trend-body {
          min-width: 0;
          display: grid;
          gap: 6px;
        }
        .trend-row {
          display: flex;
          align-items: baseline;
          gap: 10px;
          min-width: 0;
        }
        .trend-rank {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .trend-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--text);
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .trend-meta {
          font-size: 12px;
          color: var(--muted);
        }
        .trend-empty {
          color: var(--muted);
          font-size: 13px;
        }
        .backdrop {
          position: fixed;
          inset: 0;
          background: color-mix(in oklab, #000 58%, transparent);
          backdrop-filter: blur(6px);
          display: grid;
          place-items: center;
          z-index: 1000;
        }
        .modal {
          width: min(760px, calc(100vw - 32px));
          background: var(--bg-raised);
          border: 1px solid var(--border);
          border-radius: var(--radius-card);
          box-shadow: 0 28px 68px rgba(15, 23, 42, 0.42);
          overflow: hidden;
        }
        .mHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
        }
        .mTitle {
          font-weight: 800;
          font-size: 18px;
        }
        .x {
          border: 0;
          background: transparent;
          color: var(--muted);
          cursor: pointer;
          font-size: 18px;
          border-radius: var(--radius-button);
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
        }
        .x:hover {
          color: var(--text);
          background: color-mix(in oklab, var(--primary) 12%, transparent);
        }
        .mBody {
          padding: 20px;
          display: grid;
          gap: 14px;
        }
        .lab {
          font-size: 12px;
          font-weight: 700;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        textarea,
        input[type="text"],
        input[type="file"] {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: var(--radius-button);
          background: var(--bg);
          color: var(--text);
          padding: 12px 14px;
          font: inherit;
        }
        textarea:focus,
        input[type="text"]:focus,
        input[type="file"]:focus {
          outline: none;
          border-color: color-mix(in oklab, var(--primary) 42%, var(--border));
          box-shadow: 0 0 0 4px color-mix(in oklab, var(--primary) 18%, transparent);
        }
        textarea {
          min-height: 120px;
          resize: vertical;
        }
        .preview {
          display: grid;
          gap: 12px;
        }
        .preview.grid-1 {
          grid-template-columns: 1fr;
        }
        .preview.grid-2 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .pCell {
          border: 1px solid var(--border);
          border-radius: var(--radius-button);
          overflow: hidden;
          background: #000;
          aspect-ratio: 16 / 10;
        }
        .pCell img,
        .pCell video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .mFoot {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 20px;
          border-top: 1px solid var(--border);
        }
        .btn {
          border: 1px solid var(--border);
          background: var(--bg);
          color: var(--text);
          border-radius: var(--radius-button);
          padding: 10px 16px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.12s ease, background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
        }
        .btn:hover {
          background: color-mix(in oklab, var(--bg) 80%, var(--primary) 10%);
        }
        .btn:active {
          transform: translateY(1px);
        }
        .btn-primary {
          background: var(--primary);
          color: var(--primary-contrast);
          border-color: color-mix(in oklab, var(--primary) 55%, var(--border));
          box-shadow: 0 14px 32px color-mix(in oklab, var(--primary) 28%, transparent);
        }
        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        .ghost {
          background: transparent;
        }
        .bad {
          margin: 0;
          padding: 10px 12px;
          border-radius: var(--radius-button);
          border: 1px solid rgba(239, 68, 68, 0.26);
          background: rgba(239, 68, 68, 0.12);
          color: #7f1d1d;
          font-size: 13px;
        }
        .muted {
          color: var(--muted);
        }
      `}</style>
    </div>
  );
}
