// app/dashboard/page.jsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db, storage } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  updateDoc,
  doc as fsDoc,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

import Container from "@/components/Container";
import Section from "@/components/Section";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PostCard from "@/components/posts/PostCard";
import { addMediaToPost } from "@/lib/postMedia";

/* --- profanity guard --- */
const BAD_WORDS = ["fuck","shit","bitch","asshole","cunt","nigger","faggot","retard"];
const clean = (t) => !t || !BAD_WORDS.some((w) => String(t).toLowerCase().includes(w));

/* --- strip undefined --- */
function stripUndefinedDeep(value) {
  if (Array.isArray(value)) return value.map(stripUndefinedDeep).filter((v) => v !== undefined);
  if (value && typeof value === "object") {
    const out = {};
    Object.entries(value).forEach(([k, v]) => {
      const cleaned = stripUndefinedDeep(v);
      if (cleaned !== undefined) out[k] = cleaned;
    });
    return out;
  }
  return value === undefined ? undefined : value;
}

/* ---- media dims for preview only ---- */
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

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState(null);

  // auth gate
  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => {
      if (!u) { router.replace("/auth/login"); return; }
      setUid(u.uid);
      setReady(true);
    });
    return () => stop();
  }, [router]);

  // feeds
  const [myPosts, setMyPosts] = useState([]);
  const [myRecipes, setMyRecipes] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);

  useEffect(() => {
    if (!uid) return;

    // My posts
    const qp = query(collection(db, "posts"), where("uid", "==", uid));
    const stopP = onSnapshot(qp, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() || {}) }))
        .filter((p) => p.isRepost !== true);
      list.sort((a,b) => (b?.createdAt?.seconds||0) - (a?.createdAt?.seconds||0));
      setMyPosts(list);
    });

    // My recipes
    const qr = query(collection(db, "recipes"), where("uid", "==", uid));
    const stopR = onSnapshot(qr, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
      list.sort((a,b) => (b?.createdAt?.seconds||0) - (a?.createdAt?.seconds||0));
      setMyRecipes(list);
    });

    // Recent posts (global)
    const qAll = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const stopAll = onSnapshot(qAll, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() || {}) }))
        .filter((p) => p.isRepost !== true);
      setRecentPosts(list.slice(0, 20));
    });

    return () => { stopP(); stopR(); stopAll(); };
  }, [uid]);

  // create post modal (still used by the FAB)
  const [open, setOpen] = useState(false);
  const [err, setErr]   = useState(null);
  const [ok, setOk]     = useState(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = open ? "hidden" : prev || "";
    return () => { document.body.style.overflow = prev || ""; };
  }, [open]);

  const [pText, setPText] = useState("");
  const [pFiles, setPFiles] = useState([]);
  const [pPreviews, setPPreviews] = useState([]); // [{url,type}]
  const [busyPost, setBusyPost] = useState(false);
  const fileInputRef = useRef(null);

  function onPickPostFiles(e) {
    const files = Array.from(e.target.files || []);
    const limited = files.slice(0, 4);
    setPFiles(limited);
    setPPreviews(
      limited.map((f) => ({
        url: URL.createObjectURL(f),
        type: f.type.startsWith("video") ? "video" : "image",
      }))
    );
  }

  async function uploadWithProgress(storageRef, file) {
    const task = uploadBytesResumable(storageRef, file);
    return new Promise((resolve, reject) => {
      task.on(
        "state_changed",
        null,
        (err) => reject(err ?? new Error("upload failed")),
        async () => resolve(await getDownloadURL(storageRef))
      );
    });
  }

  // create post
  async function createPost() {
    setErr(null); setOk(null);
    if (!uid) { setErr("You must be signed in."); return; }
    if (!pText.trim() && pFiles.length === 0) { setErr("Nothing to publish."); return; }
    if (!clean(pText)) { setErr("Please avoid offensive words in your post."); return; }

    setBusyPost(true);
    try {
      // author snippet
      let author = { username: null, displayName: null, avatarURL: null };
      try {
        const snap = await getDoc(fsDoc(db, "users", uid));
        if (snap.exists()) {
          const u = snap.data() || {};
          author = {
            username: u.username || null,
            displayName: u.firstName ? `${u.firstName}${u.lastName ? " " + u.lastName : ""}` : (u.displayName || null),
            avatarURL: u.photoURL || null,
          };
        }
      } catch {}

      // create doc
      const draftRef = await addDoc(collection(db, "posts"), stripUndefinedDeep({
        uid,
        text: pText.trim() ? pText.trim() : null,
        media: [],
        createdAt: serverTimestamp(),
        isRepost: false,
        author,
      }));

      // upload media
      const uploaded = [];
      for (const file of pFiles.slice(0, 4)) {
        const isVideo = file.type.startsWith("video");
        let w = 0, h = 0, duration;
        try {
          if (isVideo) { const dim = await getVideoDims(file); w = dim.w; h = dim.h; duration = dim.duration; }
          else { const dim = await getImageDims(file); w = dim.w; h = dim.h; }
        } catch {}

        const safeName = `${Date.now()}-${file.name}`.replace(/\s+/g, "_");
        const storagePath = `posts/${uid}/${draftRef.id}/${safeName}`;
        const storageRef = ref(storage, storagePath);
        const url = await uploadWithProgress(storageRef, file);

        uploaded.push({
          mid: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
          type: isVideo ? "video" : "image",
          url,
          storagePath,
          w, h,
          aspect: h ? w / h : undefined,
          ...(isVideo ? { duration } : {}),
        });
      }

      if (uploaded.length > 0) await updateDoc(draftRef, { media: uploaded });

      setOk("Post published!");
      setPText(""); setPFiles([]); setPPreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setOpen(false);
    } catch (e) {
      const msg = String(e?.message || e);
      if (/appCheck|CORS|preflight/i.test(msg)) setErr("Upload blocked by App Check/CORS. Verify App Check (v3) and debug token.");
      else if (/permission|denied|insufficient/i.test(msg)) setErr("Permission denied. Check Firestore/Storage rules and sign-in status.");
      else if (/storage\/unauthorized|storage\/forbidden/i.test(msg)) setErr("Storage write blocked. Check bucket + file type/size vs rules.");
      else setErr(msg);
    } finally {
      setBusyPost(false);
    }
  }

  /* --------- PostCard handlers ---------- */

  // Like: create if missing, delete if exists (rules forbid update)
  async function handleToggleLike(post, liked){
    if (!uid || !post?.id) return;
    const likeRef = doc(db, "posts", post.id, "likes", uid);
    const snap = await getDoc(likeRef);
    if (liked) {
      if (!snap.exists()) await setDoc(likeRef, { uid, createdAt: serverTimestamp() });
    } else {
      if (snap.exists()) await deleteDoc(likeRef);
    }
  }

  // one-time repost per user
  async function handleRepost(post){
    if (!uid || !post?.id) return;
    const rpRef = doc(db, "posts", post.id, "reposts", uid);
    const snap = await getDoc(rpRef);
    if (snap.exists()) return;
    await setDoc(rpRef, { uid, createdAt: serverTimestamp() });
    try {
      const pRef = doc(db, "posts", post.id);
      const pSnap = await getDoc(pRef);
      const curr = (pSnap.data()?.reposts || 0) + 1;
      await updateDoc(pRef, { reposts: curr });
    } catch {}
  }

  async function handleEdit(post, nextText){
    if (!uid || !post?.id) return;
    await updateDoc(doc(db, "posts", post.id), { text: nextText || null });
  }

  async function handleAddMedia(post, files){
    if (!uid || !post?.id || !files?.length) return;
    try {
      await addMediaToPost({ uid, postId: post.id, files, limit: 4 });
    } catch (e) {
      alert(`Add media failed: ${e?.message || e}`);
    }
  }

  async function handleDelete(post){
    if (!uid || !post?.id) return;
    await deleteDoc(doc(db, "posts", post.id));
  }

  async function handleComment(post, text){
    if (!uid || !post?.id) return;
    await addDoc(collection(db, "posts", post.id, "comments"), {
      uid, text, createdAt: serverTimestamp(),
    });
  }

  async function handleReport(post){
    if (!uid || !post?.id) return;
    try {
      await setDoc(doc(db, "posts", post.id, "reports", uid), { uid, createdAt: serverTimestamp() });
    } catch (e) {
      console.error("report failed", e);
    }
  }

  if (!ready) return null;

  return (
    <Container className="page">
      {/* HEADER — renamed to Home + animation */}
      <header className="head">
        <div className="title tracking-in-contract-bck-top">Home</div>
        <p className="sub">Add posts, browse your recipes, and manage your pantry.</p>
      </header>

      {/* HERO */}
      <Card className="hero">
        <h2 className="heroTitle">
          Hello <span className="wave">👋</span> Welcome to <span className="brand">Clean-Kitchen</span>
        </h2>
        <p className="heroText">
          Share <strong>posts</strong>, review your <strong>recipes</strong>, and keep your <strong>pantry</strong> tidy.
          Tap the <strong>+</strong> to get started.
        </p>
      </Card>

      {/* FEED */}
      {recentPosts.length > 0 && (
        <Section title="Recent posts" subtitle="Latest from the community">
          <div className="list">
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
                onRepost={handleRepost}
                onToggleLike={handleToggleLike}
              />
            ))}
          </div>
        </Section>
      )}

      {(myPosts.length > 0 || myRecipes.length > 0) && (
        <Section>
          <div className="twoCol">
            {myPosts.length > 0 && (
              <div>
                <h3 className="subhead">My posts</h3>
                <div className="list">
                  {myPosts.map((p) => (
                    <PostCard
                      key={p.id}
                      post={p}
                      meUid={uid}
                      onEdit={handleEdit}
                      onAddMedia={handleAddMedia}
                      onDelete={handleDelete}
                      onReport={handleReport}
                      onComment={handleComment}
                      onRepost={handleRepost}
                      onToggleLike={handleToggleLike}
                    />
                  ))}
                </div>
              </div>
            )}

            {myRecipes.length > 0 && (
              <div>
                <h3 className="subhead">My recipes</h3>
                <ul className="recipes">
                  {myRecipes.map((r) => (
                    <li key={r.id} className="recipeItem">
                      <Link href={`/recipes/${r.id}`} className="recipeLink">
                        <div className="recipeTitle">{r.title || "Untitled"}</div>
                        {r.description ? <div className="recipeDesc">{r.description}</div> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Floating + (keep your existing FAB to create posts) */}
      <button className="fab" onClick={() => setOpen(true)} aria-label="Create post">
        <span aria-hidden>+</span>
      </button>

      {/* CREATE POST MODAL */}
      {open && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Create post" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e)=>e.stopPropagation()}>
            <div className="headRow">
              <div className="titleRow">New Post</div>
              <button className="close" onClick={()=>setOpen(false)} aria-label="Close">✕</button>
            </div>

            {err && <p className="bad" role="alert">{err}</p>}
            {ok &&  <p className="ok" role="status">{ok}</p>}

            <div className="body">
              <div className="field">
                <label className="label" htmlFor="post-text">Text</label>
                <textarea id="post-text" className="ta" rows={4} value={pText} onChange={(e)=>setPText(e.target.value)} />
              </div>
              <div className="field">
                <label className="label" htmlFor="post-media">Media (up to 4): images or videos</label>
                <input ref={fileInputRef} id="post-media" type="file" accept="image/*,video/*" multiple onChange={onPickPostFiles}/>
                {pPreviews.length > 0 && (
                  <div className={`mediaPreview mcount-${pPreviews.length}`}>
                    {pPreviews.map((m, i) => (
                      <div key={i} className="mCell">
                        {m.type === "video" ? (
                          <video src={m.url} controls muted playsInline />
                        ) : (
                          <img src={m.url} alt="" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="actions end">
                <Button variant="secondary" onClick={()=>setOpen(false)}>Cancel</Button>
                <Button onClick={createPost} disabled={busyPost}>{busyPost?"Publishing…":"Publish"}</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page { padding-bottom: 96px; }

        /* ---------- Page header ---------- */
        .head { display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin: 10px auto 14px; max-width: 1100px; padding: 0 4px; }
        .title { font-weight: 900; font-size: 34px; letter-spacing: -0.02em; color: var(--text); }
        .sub { color: var(--muted); margin: 0; }

        /* ---------- Hero card ---------- */
        .hero { padding: 24px; border-radius: 18px; background: var(--card-bg); border:1px solid var(--border); box-shadow: 0 20px 50px rgba(0,0,0,.06); }
        .heroTitle { font-size: 22px; font-weight: 800; margin: 0 0 8px; color: var(--text); }
        .brand { background: linear-gradient(90deg, var(--primary), color-mix(in oklab, var(--text) 55%, transparent)); -webkit-background-clip: text; color: transparent; }
        .heroText { color: var(--muted); margin: 0 }
        .wave { display:inline-block; transform-origin: 70% 70%; animation: wave 1.8s ease-in-out 1; }
        @keyframes wave { 0%{transform: rotate(0)} 15%{transform: rotate(18deg)} 30%{transform: rotate(-8deg)} 45%{transform: rotate(14deg)} 60%{transform: rotate(-4deg)} 75%{transform: rotate(10deg)} 100%{transform: rotate(0)} }

        /* ---------- Feed layout ---------- */
        .list { display: grid; gap: 18px; }
        :global(.list > *) { max-width: 640px; width: 100%; margin: 0 auto; }

        .twoCol { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 900px){ .twoCol { grid-template-columns:1fr; } }

        /* ---------- Recipes mini-list ---------- */
        .recipes { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px }
        .recipeItem { border:1px solid var(--border); border-radius: 12px; background: var(--card-bg) }
        .recipeLink { display:block; padding: 10px 12px; text-decoration:none; color: inherit }
        .recipeLink:hover { background: var(--bg); }
        .recipeTitle { font-weight: 700 }
        .recipeDesc { color: var(--muted); font-size: 14px; margin-top: 2px }

        /* ---------- FAB ---------- */
        .fab {
          position: fixed; right: 24px; bottom: 24px; width: 56px; height: 56px; border-radius: 9999px;
          background: var(--primary); color: var(--primary-contrast); border: none; font-size: 30px; display: grid; place-items: center;
          box-shadow: 0 12px 32px rgba(0,0,0,.25); cursor: pointer; z-index: 60;
          transition: transform .12s ease, opacity .12s ease;
        }
        .fab:hover { transform: translateY(-2px); opacity: .96; }

        /* ---------- Modal ---------- */
        .overlay { position: fixed; inset: 0; background: rgba(2,6,23,.55); display: grid; place-items: center; padding: 16px; z-index: 1200; }
        .modal { width: 100%; max-width: 760px; background: var(--card-bg); border-radius: 16px; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,.35); border: 1px solid var(--border); }
        .headRow { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--border); background: var(--bg); }
        .titleRow { font-weight: 800; color: var(--text) }
        .close { border: none; background: transparent; font-size: 18px; color: var(--muted); cursor: pointer }
        .body { padding: 14px }
        .field { margin-bottom: 12px }
        .label { display: block; margin-bottom: 6px; font-size: .9rem; color: var(--text); font-weight: 600 }
        .ta { width: 100%; border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; background: var(--bg); color: var(--text); font-size: 14px; }

        .actions { display: flex; gap: 12px }
        .end { justify-content: flex-end }

        .ok  { margin: 10px 0 0; background: rgba(16,185,129, .12); color: #065f46; border: 1px solid rgba(16,185,129,.28); border-radius: 8px; padding: 8px 10px; font-size: 13px; }
        .bad { margin: 10px 0 0; background: rgba(239,68,68, .12); color: #7f1d1d; border: 1px solid rgba(239,68,68,.28); border-radius: 8px; padding: 8px 10px; font-size: 13px; }

        /* Media preview grid in modal */
        .mediaPreview { display: grid; gap: 6px; margin-top: 8px }
        .mediaPreview img, .mediaPreview video { width: 100%; height: 100%; display: block; object-fit: cover; border-radius: 10px; border: 1px solid var(--border); background:#000; }
        .mediaPreview.mcount-1 { grid-template-columns: 1fr; grid-auto-rows: 160px }
        .mediaPreview.mcount-2 { grid-template-columns: 1fr 1fr; grid-auto-rows: 130px }
        .mediaPreview.mcount-3 { grid-template-columns: 2fr 1fr; grid-auto-rows: 110px }
        .mediaPreview.mcount-3 .mCell:nth-child(1){ grid-row: 1 / span 2; height: 226px }
        .mediaPreview.mcount-4 { grid-template-columns: 1fr 1fr; grid-auto-rows: 110px }

        /* ---------- Animista: tracking-in-contract-bck-top ---------- */
        .tracking-in-contract-bck-top {
          -webkit-animation: tracking-in-contract-bck-top 1s cubic-bezier(0.215,0.610,0.355,1.000) both;
                  animation: tracking-in-contract-bck-top 1s cubic-bezier(0.215,0.610,0.355,1.000) both;
        }
        @-webkit-keyframes tracking-in-contract-bck-top {
          0%   { letter-spacing:1em; -webkit-transform:translateZ(400px) translateY(-300px); transform:translateZ(400px) translateY(-300px); opacity:0; }
          40%  { opacity:.6; }
          100% { -webkit-transform:translateZ(0) translateY(0); transform:translateZ(0) translateY(0); opacity:1; }
        }
        @keyframes tracking-in-contract-bck-top {
          0%   { letter-spacing:1em; -webkit-transform:translateZ(400px) translateY(-300px); transform:translateZ(400px) translateY(-300px); opacity:0; }
          40%  { opacity:.6; }
          100% { -webkit-transform:translateZ(0) translateY(0); transform:translateZ(0) translateY(0); opacity:1; }
        }
      `}</style>
    </Container>
  );
}
