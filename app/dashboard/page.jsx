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

/** ---------- helpers for media (no TS types) ---------- */
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

/** Send metadata.contentType so your Storage rules (isImage/isVideo) pass */
async function uploadWithProgress(storageRef, file) {
  // Validate client-side to match your Storage limits/rules
  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");
  if (!isImage && !isVideo) throw new Error("Only images/videos allowed");
  if (isImage && file.size > 20 * 1024 * 1024) throw new Error("Image max 20MB");
  if (isVideo && file.size > 100 * 1024 * 1024) throw new Error("Video max 100MB");

  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type, // <-- REQUIRED by your rules
    cacheControl: "public, max-age=3600",
  });
  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      null,
      (err) => reject(err || new Error("Upload failed.")),
      async () => resolve(await getDownloadURL(storageRef))
    );
  });
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

  const [openComposer, setOpenComposer] = useState(false);
  const [postText, setPostText] = useState("");
  const [postFiles, setPostFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [busyPost, setBusyPost] = useState(false);
  const [errPost, setErrPost] = useState(null);
  const fileRef = useRef(null);

  /** auth gate */
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

  /** feed: public posts are allowed by your rules */
  useEffect(() => {
    const qy = query(collection(db, "posts"), orderBy("createdAt", "desc"), fsLimit(50));
    const stop = onSnapshot(
      qy,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() || {}) }))
          .filter((p) => p.isRepost !== true);
        setRecentPosts(list);
      },
      (e) => console.error("[recentPosts] onSnapshot error:", e)
    );
    return () => stop();
  }, []);

  /** live repost counts per trending id (reads are allowed by your rules) */
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
      onSnapshot(
        collection(db, "posts", id, "reposts"),
        (snap) => {
          setTrendingReposts((prev) => {
            const count = snap.size;
            if (prev[id] === count) return prev;
            return { ...prev, [id]: count };
          });
        },
        (e) => console.error("[reposts count] error for", id, e)
      )
    );
    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [trending]);

  /** trending list (just recents for now) */
  useEffect(() => {
    const tQ = query(collection(db, "posts"), orderBy("createdAt", "desc"), fsLimit(5));
    const stop = onSnapshot(
      tQ,
      (snap) => {
        setTrending(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
      },
      (e) => console.error("[trending] onSnapshot error:", e)
    );
    return () => stop();
  }, []);

  /** likes — allowed publicly as long as doc id equals auth uid (your rules) */
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
      const msg = String(e?.message || e);
      if (/permission|denied|insufficient/i.test(msg)) {
        throw new Error("Permission denied (likes). Are you signed in?");
      }
      throw e;
    }
  }

  /** reposts — reads public, writes allowed with docId == auth uid (your rules) */
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

  /** edits — only allowed if you own the post per your rules */
  async function handleEdit(post, nextText) {
    if (!uid || !post?.id) return;
    if (post.uid !== uid) {
      console.warn("[edit] blocked: not owner", { postId: post.id, postUid: post.uid, me: uid });
      throw new Error("You can only edit your own posts.");
    }
    await setDoc(doc(db, "posts", post.id), { text: nextText || null }, { merge: true });
  }

  /** add media — Storage path must use your auth uid; also only allowed for your own post */
  async function handleAddMedia(post, files) {
    if (!uid || !post?.id || !files?.length) return;
    if (post.uid !== uid) {
      console.warn("[addMedia] blocked: not owner", { postId: post.id, postUid: post.uid, me: uid });
      throw new Error("You can only add media to your own posts.");
    }

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
      // IMPORTANT: path uses your uid (matches your Storage rule posts/{uid}/{postId}/{filename})
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

  /** deletions — only your own post per your rules */
  async function handleDelete(post) {
    if (!uid || !post?.id) return;
    if (post.uid !== uid) {
      console.warn("[delete] blocked: not owner", { postId: post.id, postUid: post.uid, me: uid });
      throw new Error("You can only delete your own posts.");
    }
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
    // implement as needed; reads are public, writes require auth and textOk() per your rules
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

  /** create post — allowed if request.resource.data.uid == auth.uid and text is clean (your rules) */
  async function createPost() {
    if (!uid) return;
    const text = postText.trim();
    if (!text && postFiles.length === 0) return;

    setBusyPost(true);
    setErrPost(null);
    try {
      // build author facade from your own users/{uid} doc
      let author = { username: null, displayName: null, avatarURL: null };
      try {
        const uSnap = await getDoc(doc(db, "users", uid)); // allowed: your own doc
        if (uSnap.exists()) {
          const u = uSnap.data() || {};
          author = {
            username: u?.username || null,
            displayName: u?.firstName
              ? `${u.firstName}${u.lastName ? " " + u.lastName : ""}`
              : u?.displayName || null,
            avatarURL: u?.photoURL || null,
          };
        }
      } catch (e) {
        console.warn("[createPost] could not read users doc:", e);
      }

      // Create post (rules: isSignedIn && request.resource.data.uid == auth.uid && cleanOptional('text'))
      const postRef = await addDoc(collection(db, "posts"), {
        uid,
        text: text || null,
        media: [],
        likes: 0,      // counters can be bumped later by your update rule (with constraints)
        reposts: 0,
        createdAt: serverTimestamp(),
        author,
      });

      // Upload media (Storage rule: posts/{uid}/{postId}/{filename} with contentType)
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

      // reset UI
      setPostText("");
      setPostFiles([]);
      setPreviews([]);
      if (fileRef.current) fileRef.current.value = "";
      setOpenComposer(false);
    } catch (e) {
      console.error("[createPost] failed:", e);
      const msg = String(e?.message || e);
      setErrPost(/permission|insufficient|denied/i.test(msg)
        ? "Permission denied. Check that you’re signed in and your rules are satisfied."
        : msg);
    } finally {
      setBusyPost(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="page">
      <header className="top container">
        <div className="hgroup">
          <h1>Dashboard</h1>
          <p className="sub">Your posts, plus what’s trending</p>
        </div>
        <button className="btn btn-primary" onClick={() => setOpenComposer(true)}>
          New Post
        </button>
      </header>

      <div className="container grid">
        <section className="main">
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

        <aside className="side">
          <div className="panel">
            <div className="panelHead">
              <span className="dot" /> Trending
            </div>
            {trending.length === 0 ? (
              <p className="muted">No trending posts yet.</p>
            ) : (
              <ul className="trend">
                {trendingSorted.map((p, i) => {
                  const thumb = Array.isArray(p.media) && p.media[0]?.url ? p.media[0] : null;
                  const repostCount = trendingReposts[p.id] ?? p.reposts ?? 0;
                  return (
                    <li key={p.id} className="tr">
                      <span className="rank">{i + 1}</span>
                      <Link href={`/posts/${p.id}`} className="trLink">
                        {thumb ? (
                          <div className="mini">
                            {thumb.type === "video" ? (
                              <video src={thumb.url} muted playsInline preload="metadata" />
                            ) : (
                              <img src={thumb.url} alt="" />
                            )}
                          </div>
                        ) : (
                          <div className="mini ph" />
                        )}
                        <div className="trBody">
                          <div className="trTitle">{(p.text || p.description || p.title || "Untitled").slice(0, 80)}</div>
                          <div className="trMeta">
                            {repostCount} {repostCount === 1 ? "repost" : "reposts"}
                          </div>
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
        :root {
          --bg: #0b0c10;
          --bg-soft: #0f1117;
          --card: #0f1320;
          --border: #1c2336;
          --text: #e7ecf3;
          --muted: #a3adbb;
          --primary: #6d5dfc;
          --primary-contrast: #fff;
          --shadow: 0 10px 30px rgba(0,0,0,.35);
        }
        @media (prefers-color-scheme: light) {
          :root {
            --bg: #f6f7fb;
            --bg-soft: #f1f5f9;
            --card: #ffffff;
            --border: #e5e7eb;
            --text: #0f172a;
            --muted: #6b7280;
            --primary: #4f46e5;
            --shadow: 0 10px 30px rgba(2,6,23,.06);
          }
        }
        .page { color: var(--text); padding-bottom: 80px; }
        .container { max-width: 1120px; margin: 0 auto; padding: 16px; }
        .top { display:flex; align-items:center; justify-content:space-between; }
        .hgroup { display:grid; gap:4px; }
        h1 { margin:0; font-weight:900; font-size: clamp(22px, 3.4vw, 30px); letter-spacing:-.02em; }
        .sub { margin:0; color: var(--muted); }
        .grid {
          display:grid; gap: 18px;
          grid-template-columns: minmax(0, 1fr) 320px;
          align-items:start;
        }
        @media (max-width: 1024px) {
          .grid { grid-template-columns: 1fr; }
          .side { order: -1; }
        }
        .btn {
          border: 1px solid var(--border);
          background: var(--card);
          color: var(--text);
          border-radius: 12px;
          padding: 10px 14px;
          font-weight: 800;
          cursor: pointer;
          transition: background .15s ease, transform .06s ease, box-shadow .2s ease, border-color .2s ease;
        }
        .btn:hover { background: color-mix(in oklab, var(--card) 80%, var(--bg)); }
        .btn:active { transform: translateY(1px); }
        .btn-primary {
          background: var(--primary);
          color: var(--primary-contrast);
          border-color: color-mix(in oklab, var(--primary) 50%, var(--border));
          box-shadow: 0 8px 18px color-mix(in oklab, var(--primary) 25%, transparent);
        }
        .ghost { background: transparent; }

        textarea, input[type="text"], input[type="file"] {
          width:100%; border:1px solid var(--border); border-radius:12px;
          background: var(--bg-soft); color: var(--text);
          padding: 12px 14px;
        }
        textarea:focus, input:focus {
          outline:none;
          border-color: color-mix(in oklab, var(--primary) 40%, var(--border));
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 20%, transparent);
        }

        .feed { display:grid; gap: 14px; }
        :global(.feed > *) { max-width: 720px; width: 100%; margin: 0 auto; }
        .empty { color: var(--muted); text-align:center; padding: 18px; }

        .panel {
          position: sticky; top: 16px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 16px;
          box-shadow: var(--shadow);
          padding: 12px;
        }
        .panelHead {
          display:flex; align-items:center; gap:8px;
          font-weight:900; letter-spacing:-.01em; margin-bottom:8px;
        }
        .dot { width:10px; height:10px; border-radius:999px; background: var(--primary); box-shadow: 0 0 12px color-mix(in oklab, var(--primary) 60%, transparent); }

        .trend { list-style:none; margin:0; padding:0; display:grid; gap:8px; }
        .tr {
          display:grid;
          grid-template-columns: 28px 1fr;
          gap: 8px;
          align-items:center;
        }
        .rank {
          width: 28px; height: 28px; border-radius: 10px;
          display:grid; place-items:center;
          border:1px solid var(--border); background: var(--bg-soft);
          font-size: 12px; font-weight:900;
        }
        .trLink {
          display:grid; grid-template-columns: 56px 1fr; gap:10px;
          text-decoration:none; color: inherit; align-items:center;
          padding: 8px; border-radius: 12px; border:1px dashed transparent;
          transition: background .15s ease, border-color .15s ease;
        }
        .trLink:hover {
          background: color-mix(in oklab, var(--primary) 10%, transparent);
          border-color: color-mix(in oklab, var(--primary) 35%, var(--border));
        }
        .mini {
          width:56px; height:42px; border-radius:10px; overflow:hidden; background:#000; border:1px solid var(--border);
        }
        .mini img, .mini video { width:100%; height:100%; object-fit:cover; display:block; }
        .mini.ph { background: var(--bg-soft); }
        .trBody { display:grid; gap:2px; min-width:0; }
        .trTitle { font-weight:800; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .trMeta  { color: var(--muted); font-size:12px; }

        .backdrop {
          position: fixed; inset: 0;
          background: color-mix(in oklab, #000 55%, transparent);
          backdrop-filter: blur(4px);
          display:grid; place-items:center;
          z-index: 1000;
        }
        .modal {
          width:min(760px, calc(100vw - 24px));
          background: var(--card);
          border:1px solid var(--border);
          border-radius:16px;
          overflow:hidden;
          box-shadow: 0 24px 60px rgba(0,0,0,.35);
        }
        .mHead { display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid var(--border); }
        .mTitle { font-weight:900; }
        .x { background:transparent; border:0; color: var(--muted); cursor:pointer; font-size:18px; border-radius:10px; }
        .x:hover { color: var(--text); background: color-mix(in oklab, var(--primary) 10%, transparent); }
        .mBody { padding: 14px; display:grid; gap:10px; }
        .lab { font-size:12px; color: var(--muted); font-weight:700; }
        .preview { display:grid; gap:10px; margin-top:4px; }
        .preview.grid-1 { grid-template-columns: 1fr; }
        .preview.grid-2 { grid-template-columns: 1fr 1fr; }
        .pCell { border:1px solid var(--border); border-radius:12px; overflow:hidden; background:#000; aspect-ratio: 16/10; }
        .pCell img, .pCell video { width:100%; height:100%; object-fit:cover; display:block; }
        .mFoot { padding:12px 14px; display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--border); }

        .bad {
          color: #7f1d1d;
          background: rgba(239,68,68,.12);
          border: 1px solid rgba(239,68,68,.28);
          border-radius: 10px; padding: 8px 10px; font-size: 12px; margin:0;
        }
        .muted { color: var(--muted); }
      `}</style>
    </div>
  );
}
