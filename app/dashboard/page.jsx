"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
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

import { auth, db, storage } from "@/lib/firebas1e";
import PostCard from "@/components/posts/PostCard";
import { useAuthModal } from "@/context/AuthModalContext";
import CreateRecipeWizard from "@/components/recipes/CreateRecipeWizard";

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
  if (typeof value === "number") return value > 1e12 ? value : value * 1000;
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

function daysUntilExpiry(dateStr) {
  if (!dateStr) return null;
  const expiry = new Date(dateStr);
  const now = new Date();
  expiry.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((expiry - now) / 86400000);
}

const IconRecipe = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    <line x1="12" y1="7" x2="16" y2="7"/><line x1="10" y1="11" x2="16" y2="11"/>
  </svg>
);
const IconBookmark = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconPantry = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 2h18v5H3zM3 7h18v15H3zM12 7v15"/><line x1="7" y1="12" x2="10" y2="12"/><line x1="7" y1="16" x2="10" y2="16"/>
  </svg>
);
const IconPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconChef = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/>
    <line x1="6" y1="17" x2="18" y2="17"/>
  </svg>
);
const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconShare = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);
const IconAlert = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconArrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);
const IconFlame = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8.97 2 6 4.97 6 8c0 2.76 1.99 5.26 4.84 6.26C11.5 14.7 12 15.5 12 16.5c0-.5-.5-1.2-1.16-1.74C8.45 13.33 6 10.83 6 8c0-3.31 2.69-6 6-6 3.06 0 5.6 2.3 5.96 5.26C17.63 6.28 17 5.19 16 4.5c.5 1.5.5 3-.5 4.5 1.5-1 2.5-2.97 2.5-5C18 1.34 15.31 2 12 2z"/>
    <path d="M12 22c-2.21 0-4-1.79-4-4 0-1.66 1.38-3.16 3.16-3.74C12.5 14.7 14 16.08 14 18c0 2.21-1.79 4-4 4z"/>
  </svg>
);
const IconPencilSquare = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconLinkSmall = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);

function QuickActionCard({ href, onClick, tone, icon, label, className: injected = "" }) {
  const cls = ["qa-card", `qa-${tone}`, injected].filter(Boolean).join(" ");
  const content = (
    <>
      <span className="qa-icon">{icon}</span>
      <span className="qa-label">{label}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={cls} onClick={onClick}>
      {content}
    </button>
  );
}

export default function DashboardPage() {
  const { openLogin, openRegister } = useAuthModal();
  const [uid, setUid] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [ready, setReady] = useState(false);

  const [recentPosts, setRecentPosts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [trendingReposts, setTrendingReposts] = useState({});

  const [myRecipesCount, setMyRecipesCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [communityRecipes, setCommunityRecipes] = useState([]);
  const [pantryItems, setPantryItems] = useState([]);

  const [openComposer, setOpenComposer] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [postText, setPostText] = useState("");
  const [postFiles, setPostFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [busyPost, setBusyPost] = useState(false);
  const [errPost, setErrPost] = useState(null);
  const [shareToast, setShareToast] = useState(null);
  const fileRef = useRef(null);
  const shareToastTimer = useRef(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const expiringItems = useMemo(() => {
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() + 7);
    return pantryItems
      .filter((item) => {
        if (!item.expiryDate) return false;
        const exp = new Date(item.expiryDate);
        return exp >= today && exp <= cutoff;
      })
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  }, [pantryItems, today]);

  const trendingSorted = useMemo(() => {
    return trending
      .map((post, idx) => ({
        post,
        idx,
        count: trendingReposts[post.id] ?? post.reposts ?? 0,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        const aTime = valueToMillis(a.post.createdAt);
        const bTime = valueToMillis(b.post.createdAt);
        if (bTime !== aTime) return bTime - aTime;
        return a.idx - b.idx;
      })
      .map(({ post }) => post);
  }, [trending, trendingReposts]);

  const spotlightRecipe = communityRecipes[0] ?? null;
  const trendingRecipe = communityRecipes[1] ?? communityRecipes[0] ?? null;
  const discoverRecipes = communityRecipes.slice(0, 8);

  // Build the recipes-page URL that pre-applies pantry-item ingredient search.
  // The recipes page reads ?mode=ingredient&ing=… and auto-runs the search via
  // its didAutoSearch effect — no modifications to that page needed.
  const pantrySearchHref = useMemo(() => {
    if (!pantryItems.length) return "/recipes";
    const names = pantryItems
      .slice(0, 8)
      .map((i) => i.name.trim().toLowerCase())
      .filter(Boolean)
      .join(",");
    return names ? `/recipes?mode=ingredient&ing=${names}` : "/recipes";
  }, [pantryItems]);

  // Auth effect
  useEffect(() => {
    const stop = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUid(null);
        setUserEmail("");
        setUserName("");
        setReady(true);
        return;
      }
      setUid(u.uid);
      setUserEmail(u.email || "");
      try {
        const uSnap = await getDoc(doc(db, "users", u.uid));
        if (uSnap.exists()) {
          const ud = uSnap.data() || {};
          setUserName(ud.firstName || ud.displayName || "");
        }
      } catch {}
      setReady(true);
    });
    return () => stop();
  }, []);

  // Community posts
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

  // Trending posts
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

  // Trending reposts
  useEffect(() => {
    const ids = trending.map((p) => p.id).filter(Boolean);
    if (ids.length === 0) { setTrendingReposts({}); return; }
    setTrendingReposts((prev) => {
      const next = {};
      ids.forEach((id) => { next[id] = prev[id] ?? 0; });
      return next;
    });
    const unsubs = ids.map((id) =>
      onSnapshot(collection(db, "posts", id, "reposts"), (snap) => {
        setTrendingReposts((prev) => {
          if (prev[id] === snap.size) return prev;
          return { ...prev, [id]: snap.size };
        });
      })
    );
    return () => unsubs.forEach((fn) => fn());
  }, [trending]);

  // My recipes count
  useEffect(() => {
    if (!uid) { setMyRecipesCount(0); return; }
    const q = query(collection(db, "recipes"), where("uid", "==", uid));
    const stop = onSnapshot(q, (snap) => setMyRecipesCount(snap.size), () => setMyRecipesCount(0));
    return () => stop();
  }, [uid]);

  // Saved recipes count — stored at users/{uid}/savedFoods
  useEffect(() => {
    if (!uid) { setSavedCount(0); return; }
    const q = collection(db, "users", uid, "savedFoods");
    const stop = onSnapshot(q, (snap) => setSavedCount(snap.size), () => setSavedCount(0));
    return () => stop();
  }, [uid]);

  // Community recipes
  useEffect(() => {
    const q = query(
      collection(db, "recipes"),
      orderBy("createdAt", "desc"),
      fsLimit(12)
    );
    const stop = onSnapshot(q, (snap) => {
      setCommunityRecipes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setCommunityRecipes([]));
    return () => stop();
  }, []);

  // Pantry items
  useEffect(() => {
    if (!uid) { setPantryItems([]); return; }
    const q = query(collection(db, "pantryItems"), where("uid", "==", uid));
    const stop = onSnapshot(q, (snap) => {
      setPantryItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setPantryItems([]));
    return () => stop();
  }, [uid]);

  async function handleToggleLike(post, liked) {
    const curUid = auth.currentUser?.uid || null;
    if (!curUid) { openLogin("/dashboard"); throw new Error("AUTH_REQUIRED"); }
    if (!post?.id) return;
    const likeRef = doc(db, "posts", post.id, "likes", curUid);
    try {
      const snap = await getDoc(likeRef);
      if (liked) {
        if (!snap.exists()) await setDoc(likeRef, { uid: curUid, createdAt: serverTimestamp() });
      } else {
        if (snap.exists()) await deleteDoc(likeRef);
      }
    } catch (e) {
      console.error("[like] failed", e);
      throw e;
    }
  }

  async function handleToggleRepost(post, next) {
    if (!uid) { openLogin("/dashboard"); return; }
    if (!post?.id) return;
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
        if (isVideo) { const d = await getVideoDims(file); w = d.w; h = d.h; duration = d.duration; }
        else { const d = await getImageDims(file); w = d.w; h = d.h; }
      } catch {}
      const safeName = `${Date.now()}-${file.name}`.replace(/\s+/g, "_");
      const storagePath = `posts/${uid}/${post.id}/${safeName}`;
      const url = await uploadWithProgress(ref(storage, storagePath), file);
      uploaded.push({ mid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type: isVideo ? "video" : "image", url, storagePath, w, h, ...(isVideo ? { duration } : {}) });
    }
    if (uploaded.length) {
      await setDoc(doc(db, "posts", post.id), { media: [...(post.media || []), ...uploaded] }, { merge: true });
    }
  }

  async function handleDelete(post) {
    if (!uid || !post?.id) return;
    await deleteDoc(doc(db, "posts", post.id));
  }

  async function handleReport(post, details) {
    const me = auth.currentUser;
    if (!me || !post?.id) { openLogin(`/posts/${post?.id ?? ""}`); throw new Error("AUTH_REQUIRED"); }
    const reason = typeof details?.reason === "string" ? details.reason.trim() : "";
    if (reason.length < 10) throw new Error("Please provide at least 10 characters explaining the issue.");
    const postRef = doc(db, "posts", post.id, "reports", me.uid);
    const postPreview = (post?.title || post?.text || post?.description || "").toString().slice(0, 180);
    await setDoc(postRef, { uid: me.uid, postId: post.id, postOwnerUid: post?.uid ?? null, postPreview, reason, createdAt: serverTimestamp() }, { merge: false });
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: post.id, postOwnerUid: post.uid ?? null, postAuthor: post.author ?? null,
          reporterUid: me.uid, reporterEmail: userEmail || null, reason,
          postText: post.text || post.description || "", postUrl: details?.postUrl || null, postPreview,
        }),
      });
      let payload = null;
      try { payload = await response.json(); } catch {}
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to deliver report (status ${response.status}).`);
      }
    } catch (err) {
      console.warn("Report email failed", err);
      throw err instanceof Error ? err : new Error("Failed to deliver the report.");
    }
  }

  async function handleComment() {}

  function handleRecipeShare(id, title, source) {
    const path = source === "ext" ? `/recipes/ext/${id}` : `/recipes/${id}`;
    const url = `${window.location.origin}${path}`;
    const shareData = { title: title || "Recipe", url };
    if (typeof navigator.share === "function" && navigator.canShare?.(shareData)) {
      navigator.share(shareData).catch(() => {});
      return;
    }
    navigator.clipboard.writeText(url).then(() => {}).catch(() => {});
    if (shareToastTimer.current) clearTimeout(shareToastTimer.current);
    setShareToast("Recipe link copied!");
    shareToastTimer.current = setTimeout(() => setShareToast(null), 2800);
  }

  function onPick(e) {
    const list = Array.from(e.target.files || []).slice(0, 4);
    setPostFiles(list);
    setPreviews(list.map((f) => ({ url: URL.createObjectURL(f), type: f.type.startsWith("video") ? "video" : "image" })));
  }

  async function createPost() {
    if (!uid) { openRegister("/dashboard"); return; }
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
            displayName: u.firstName ? `${u.firstName}${u.lastName ? " " + u.lastName : ""}` : u.displayName || null,
            avatarURL: u.photoURL || null,
          };
        }
      } catch {}
      const postRef = await addDoc(collection(db, "posts"), { uid, text: text || null, media: [], likes: 0, reposts: 0, createdAt: serverTimestamp(), author });
      if (postFiles.length) {
        const uploaded = [];
        for (const file of postFiles) {
          const isVideo = file.type.startsWith("video");
          let w = 0, h = 0, duration;
          try {
            if (isVideo) { const d = await getVideoDims(file); w = d.w; h = d.h; duration = d.duration; }
            else { const d = await getImageDims(file); w = d.w; h = d.h; }
          } catch {}
          const safeName = `${Date.now()}-${file.name}`.replace(/\s+/g, "_");
          const storagePath = `posts/${uid}/${postRef.id}/${safeName}`;
          const url = await uploadWithProgress(ref(storage, storagePath), file);
          uploaded.push({ mid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type: isVideo ? "video" : "image", url, storagePath, w, h, ...(isVideo ? { duration } : {}) });
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
      setErrPost(/permission|insufficient|denied/i.test(msg) ? "Permission denied. Check auth and rules." : msg);
    } finally {
      setBusyPost(false);
    }
  }

  if (!ready) return null;

  const greeting = userName ? `Welcome back, ${userName}` : "Welcome back";

  return (
    <div className="page">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="hero-wrap container">
        <div className="hero-card">
          <div className="hero-glow" aria-hidden />
          <div className="hero-inner">
            <div className="hero-left">
              <h1 className="hero-title">{greeting}! 👋</h1>
              <p className="hero-sub">What are you cooking today?</p>
              <div className="hero-btns">
                <button
                  className="hero-btn-primary"
                  type="button"
                  onClick={() => uid ? setShowWizard(true) : openRegister("/dashboard")}
                >
                  <IconPlus /> Create Recipe
                </button>
                <Link href="/recipes" className="hero-btn-secondary">
                  Explore Recipes →
                </Link>
              </div>
              {!uid && (
                <p className="hero-notice">
                  Browse in read-only mode. Sign in to create recipes, like posts, and connect.
                </p>
              )}
            </div>
            <div className="hero-right" aria-hidden>
              <span className="hero-deco">🌿</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTINUE WHERE YOU LEFT OFF ──────────────────────── */}
      <section className="container">
        <div className="section-header">
          <h2 className="section-title">Continue where you left off</h2>
          <Link href="/recipes" className="view-all-link">View all</Link>
        </div>
        <div className="overview-grid">
          <div className="ov-card ov-green">
            <div className="ov-icon"><IconRecipe /></div>
            <div className="ov-body">
              <div className="ov-num">{myRecipesCount}</div>
              <div className="ov-label">My Recipes</div>
              <div className="ov-hint">Recipes you&apos;ve created</div>
            </div>
            <Link href="/recipes" className="ov-link">View <IconArrow /></Link>
          </div>
          <div className="ov-card ov-amber">
            <div className="ov-icon"><IconBookmark /></div>
            <div className="ov-body">
              <div className="ov-num">{savedCount}</div>
              <div className="ov-label">Saved Recipes</div>
              <div className="ov-hint">Saved for later</div>
            </div>
            <Link href="/saved" className="ov-link">View <IconArrow /></Link>
          </div>
          <div className="ov-card ov-teal">
            <div className="ov-icon"><IconPantry /></div>
            <div className="ov-body">
              <div className="ov-num">{pantryItems.length}</div>
              <div className="ov-label">Pantry Items</div>
              <div className="ov-hint">
                {expiringItems.length > 0
                  ? <span className="ov-warn"><IconAlert /> {expiringItems.length} expiring soon</span>
                  : "All items in stock"}
              </div>
            </div>
            <Link href="/dashboard/pantry" className="ov-link">View <IconArrow /></Link>
          </div>
        </div>
      </section>


      {/* ── MAIN LAYOUT ──────────────────────────────────────── */}
      <div className="container layout">
        <main className="main-col">

          {/* PANTRY BLOCK */}
          {uid && (
            <section className="pantry-block">
              <div className="pantry-head">
                <div>
                  <h2 className="block-title">🥬 Cook with what you have</h2>
                  <p className="block-sub pantry-sub">
                    {pantryItems.length === 0
                      ? "Add pantry items to get personalised recipe suggestions."
                      : `${pantryItems.length} items in your pantry${expiringItems.length > 0 ? ` · ${expiringItems.length} expiring within 7 days` : ""}`}
                  </p>
                </div>
                <div className="pantry-ctas">
                  <Link href={pantrySearchHref} className="pant-btn pant-primary">
                    {pantryItems.length > 0 ? "Find Recipes with My Pantry" : "Find Recipes"}
                  </Link>
                  <Link href="/pantry" className="pant-btn pant-ghost">Manage Pantry</Link>
                </div>
              </div>
              {pantryItems.length > 0 && (
                <div className="ingredient-pills">
                  {pantryItems.slice(0, 12).map((item) => {
                    const days = daysUntilExpiry(item.expiryDate);
                    const expiring = days !== null && days <= 7 && days >= 0;
                    return (
                      <span key={item.id} className={`pill${expiring ? " pill-warn" : ""}`}>
                        {expiring && <IconAlert />}
                        {item.name}
                        {expiring && <span className="pill-days">{days === 0 ? "today" : `${days}d`}</span>}
                      </span>
                    );
                  })}
                  {pantryItems.length > 12 && (
                    <Link href="/pantry" className="pill pill-more">
                      +{pantryItems.length - 12} more
                    </Link>
                  )}
                </div>
              )}
            </section>
          )}

          {/* RECIPE SPOTLIGHT */}
          {communityRecipes.length > 0 && (
            <section className="spotlight-section">
              <h2 className="section-title">Recipe Spotlight</h2>
              <div className="spotlight-grid">
                {spotlightRecipe && (
                  <div className="spot-card spot-featured">
                    <div
                      className="spot-img"
                      style={spotlightRecipe.image ? { backgroundImage: `url(${spotlightRecipe.image})` } : {}}
                    >
                      {!spotlightRecipe.image && <span className="spot-emoji">🍳</span>}
                      <div className="spot-badge spot-badge-green">Recommended</div>
                    </div>
                    <div className="spot-body">
                      <p className="spot-meta">
                        {spotlightRecipe.category || "Recipe"} · {spotlightRecipe.area || "Community"}
                      </p>
                      <h3 className="spot-title">{spotlightRecipe.title || "Untitled Recipe"}</h3>
                      <p className="spot-desc">
                        {spotlightRecipe.instructions
                          ? spotlightRecipe.instructions.slice(0, 90) + "…"
                          : `${(spotlightRecipe.ingredients?.length || 0)} ingredients · Ready to cook`}
                      </p>
                      <div className="spot-cta-row">
                        <Link href={`/recipes/${spotlightRecipe.id}`} className="spot-cta">
                          View Recipe <IconArrow />
                        </Link>
                        <button
                          className="spot-share-btn"
                          onClick={() => handleRecipeShare(spotlightRecipe.id, spotlightRecipe.title)}
                          title="Copy recipe link"
                        >
                          <IconLinkSmall /> Share
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {trendingRecipe && trendingRecipe.id !== spotlightRecipe?.id && (
                  <div className="spot-card spot-trending">
                    <div
                      className="spot-img"
                      style={trendingRecipe.image ? { backgroundImage: `url(${trendingRecipe.image})` } : {}}
                    >
                      {!trendingRecipe.image && <span className="spot-emoji">🔥</span>}
                      <div className="spot-badge spot-badge-amber">
                        <IconFlame /> Trending
                      </div>
                    </div>
                    <div className="spot-body">
                      <p className="spot-meta">
                        {trendingRecipe.category || "Recipe"} · {trendingRecipe.area || "Community"}
                      </p>
                      <h3 className="spot-title">{trendingRecipe.title || "Untitled Recipe"}</h3>
                      <p className="spot-desc">
                        {trendingRecipe.instructions
                          ? trendingRecipe.instructions.slice(0, 90) + "…"
                          : `${(trendingRecipe.ingredients?.length || 0)} ingredients · Ready to cook`}
                      </p>
                      <div className="spot-cta-row">
                        <Link href={`/recipes/${trendingRecipe.id}`} className="spot-cta">
                          View Recipe <IconArrow />
                        </Link>
                        <button
                          className="spot-share-btn"
                          onClick={() => handleRecipeShare(trendingRecipe.id, trendingRecipe.title)}
                          title="Copy recipe link"
                        >
                          <IconLinkSmall /> Share
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* DISCOVER */}
          {discoverRecipes.length > 0 && (
            <section className="discover-section">
              <div className="discover-head">
                <div>
                  <h2 className="section-title" style={{ marginBottom: 2 }}>Discover Recipes</h2>
                  <p className="block-sub">Fresh recipes from the community</p>
                </div>
                <Link href="/recipes" className="see-all-link">See all →</Link>
              </div>
              <div className="discover-scroll">
                {discoverRecipes.map((recipe) => (
                  <div key={recipe.id} className="disc-card">
                    <Link href={`/recipes/${recipe.id}`} className="disc-link">
                      <div
                        className="disc-img"
                        style={recipe.image ? { backgroundImage: `url(${recipe.image})` } : {}}
                      >
                        {!recipe.image && <span className="disc-emoji">🍽️</span>}
                      </div>
                      <div className="disc-body">
                        <p className="disc-cat">{recipe.category || "Recipe"}</p>
                        <h4 className="disc-title">{recipe.title || "Untitled"}</h4>
                        {recipe.author?.name && (
                          <p className="disc-author">by {recipe.author.name}</p>
                        )}
                      </div>
                    </Link>
                    <button
                      className="disc-share-btn"
                      onClick={() => handleRecipeShare(recipe.id, recipe.title)}
                      title="Copy recipe link"
                      aria-label="Copy recipe link"
                    >
                      <IconLinkSmall />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* COMMUNITY FEED */}
          <section className="feed-section">
            <div className="feed-head">
              <h2 className="section-title" style={{ marginBottom: 0 }}>Community Feed</h2>
              <div className="feed-head-right">
                <span className="feed-sort-label">Latest ▾</span>
                <button
                  className="feed-new-btn"
                  onClick={() => uid ? setOpenComposer(true) : openRegister("/dashboard")}
                >
                  <IconShare /> Create Post
                </button>
              </div>
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
              {recentPosts.length === 0 && (
                <div className="feed-empty">
                  <p>No community posts yet. Be the first to share!</p>
                  <button
                    className="pant-btn pant-primary"
                    onClick={() => uid ? setOpenComposer(true) : openRegister("/dashboard")}
                  >
                    Create First Post
                  </button>
                </div>
              )}
            </div>
          </section>
        </main>

        {/* SIDEBAR */}
        <aside className="sidebar">
          {/* Expiring Soon */}
          {uid && expiringItems.length > 0 && (
            <div className="sb-card sb-warn-card">
              <div className="sb-head">
                <h3 className="sb-title">⚠️ Expiring Soon</h3>
                <span className="sb-badge">{expiringItems.length}</span>
              </div>
              <ul className="sb-list">
                {expiringItems.slice(0, 5).map((item) => {
                  const days = daysUntilExpiry(item.expiryDate);
                  return (
                    <li key={item.id} className="sb-item">
                      <span className="sb-item-name">{item.name}</span>
                      <span className={`sb-item-days${days === 0 ? " sb-today" : days <= 2 ? " sb-urgent" : ""}`}>
                        {days === 0 ? "Today!" : days === 1 ? "Tomorrow" : `${days} days`}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <Link href="/dashboard/pantry" className="sb-cta">Manage Pantry →</Link>
            </div>
          )}

          {/* Recipe of the Day */}
          {spotlightRecipe && (
            <div className="sb-card sb-recipe-card">
              <h3 className="sb-title">🍽️ Recipe of the Day</h3>
              <div
                className="sb-recipe-img"
                style={spotlightRecipe.image ? { backgroundImage: `url(${spotlightRecipe.image})` } : {}}
              >
                {!spotlightRecipe.image && <span className="sb-recipe-emoji">🥘</span>}
              </div>
              <p className="sb-recipe-name">{spotlightRecipe.title || "Today's Pick"}</p>
              <p className="sb-recipe-meta">
                {spotlightRecipe.category || "Recipe"} · {(spotlightRecipe.ingredients?.length || 0)} ingredients
              </p>
              <Link href={`/recipes/${spotlightRecipe.id}`} className="sb-cta">
                Cook this →
              </Link>
            </div>
          )}

          {/* Quick Actions */}
          <div className="sb-card">
            <h3 className="sb-title">Quick Actions</h3>
            <div className="qa-list">
              <QuickActionCard
                tone="green"
                icon={<IconChef />}
                label="Create Recipe"
                onClick={() => uid ? setShowWizard(true) : openRegister("/dashboard")}
                className="qa-list-item"
              />
              <QuickActionCard href="/pantry" tone="amber" icon={<IconPlus />} label="Add Pantry Item" className="qa-list-item" />
              <QuickActionCard href="/recipes" tone="blue" icon={<IconSearch />} label="Browse Recipes" className="qa-list-item" />
              <QuickActionCard
                tone="violet"
                icon={<IconPencilSquare />}
                label="Create Post"
                onClick={() => uid ? setOpenComposer(true) : openRegister("/dashboard")}
                className="qa-list-item"
              />
              <QuickActionCard href="/saved" tone="rose" icon={<IconBookmark />} label="Saved Recipes" className="qa-list-item" />
            </div>
            <Link href="/recipes" className="sb-cta">View all →</Link>
          </div>

          {/* Trending Posts */}
          <div className="sb-card sb-trend-card">
            <div className="sb-head">
              <h3 className="sb-title">🔥 Trending Now</h3>
              <span className="trend-dot" aria-hidden />
            </div>
            {trendingSorted.length === 0 ? (
              <p className="sb-empty">No trending posts yet.</p>
            ) : (
              <ul className="sb-trend-list">
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
                              <NextImage
                                src={thumb.url}
                                alt={p.title || p.text || "Trending post"}
                                fill
                                sizes="56px"
                                className="trendImage"
                                unoptimized
                              />
                            )
                          ) : (
                            <span className="trend-rank-num">#{i + 1}</span>
                          )}
                        </div>
                        <div className="trend-body">
                          <div className="trend-row">
                            <span className="trend-rank">#{i + 1}</span>
                            <span className="trend-title">
                              {(p.text || p.description || p.title || "Untitled").slice(0, 70)}
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

      {/* CREATE RECIPE WIZARD */}
      <CreateRecipeWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onSaved={() => {}}
        meUid={uid}
      />

      {/* SHARE TOAST */}
      {shareToast && (
        <div className="share-toast" role="status" aria-live="polite">
          <span className="share-toast-check">✓</span> {shareToast}
        </div>
      )}

      {/* COMPOSER MODAL */}
      {openComposer && (
        <div className="backdrop" onClick={() => setOpenComposer(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="mHead">
              <div className="mTitle">Share with the community</div>
              <button className="x" onClick={() => setOpenComposer(false)}>✕</button>
            </div>
            <div className="mBody">
              {errPost ? <p className="bad">{errPost}</p> : null}
              <label className="lab">What&apos;s on your mind?</label>
              <textarea
                rows={4}
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="Share a recipe tip, kitchen win, or food photo..."
              />
              <label className="lab">Add photos or videos (up to 4)</label>
              <input ref={fileRef} type="file" accept="image/*,video/*" multiple onChange={onPick} />
              {previews.length > 0 && (
                <div className="videoWarn">
                  <span className="videoWarnIcon">⚠</span>
                  {previews.some((m) => m.type === "video")
                    ? "Videos can take a few minutes to upload — please keep this window open until posting is done."
                    : "Photos may take a few seconds to upload — please keep this window open until posting is done."}
                </div>
              )}
              {previews.length > 0 && (
                <div className={`preview grid-${Math.min(previews.length, 2)}`}>
                  {previews.map((m, i) => (
                    <div key={i} className="pCell">
                      {m.type === "video" ? (
                        <video src={m.url} controls muted />
                      ) : (
                        <NextImage src={m.url} alt={`Selected media ${i + 1}`} fill sizes="(max-width: 768px) 100vw, 420px" className="pImage" unoptimized />
                      )}
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
        /* ── BASE ── */
        .page {
          display: flex;
          flex-direction: column;
          gap: 32px;
          padding-top: 28px;
          padding-bottom: 64px;
        }
        .container {
          width: min(1180px, 100%);
          margin: 0 auto;
          padding: 0 24px;
        }
        .section-title {
          margin: 0 0 16px;
          font-size: 20px;
          font-weight: 800;
          color: var(--text);
        }
        .block-sub {
          margin: 0;
          font-size: 14px;
          color: var(--muted);
          line-height: 1.5;
        }

        /* ── HERO ── */
        .hero-wrap {
          margin-top: 24px;
        }
        .hero-card {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          border-radius: var(--radius-card);
          padding: clamp(28px, 5vw, 44px);
          background: linear-gradient(
            135deg,
            #15803d 0%,
            #166534 40%,
            #14532d 100%
          );
          color: #fff;
        }
        .hero-glow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(ellipse at 10% 15%, rgba(134,239,172,0.22) 0%, transparent 50%),
            radial-gradient(ellipse at 85% -10%, rgba(251,191,36,0.16) 0%, transparent 48%);
        }
        .hero-inner {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 32px;
        }
        .hero-left {
          display: grid;
          gap: 14px;
          max-width: 540px;
        }
        .hero-eyebrow {
          margin: 0;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          opacity: 0.8;
        }
        .hero-title {
          margin: 0;
          font-size: clamp(26px, 4.5vw, 38px);
          font-weight: 800;
          line-height: 1.1;
        }
        .hero-sub {
          margin: 0;
          font-size: 15px;
          line-height: 1.6;
          color: rgba(255,255,255,0.76);
        }
        .hero-notice {
          margin: 0;
          padding: 10px 14px;
          border-radius: 12px;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.18);
          font-size: 13px;
          color: rgba(255,255,255,0.88);
          width: fit-content;
        }
        .hero-btns {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .hero-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 22px;
          border-radius: var(--radius-button);
          background: #fff;
          color: #15803d;
          font-weight: 700;
          font-size: 15px;
          text-decoration: none;
          box-shadow: 0 12px 28px rgba(0,0,0,0.22);
          transition: transform 0.12s, box-shadow 0.14s, opacity 0.14s;
          border: none;
          cursor: pointer;
          font-family: inherit;
          -webkit-appearance: none;
          appearance: none;
        }
        .hero-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 36px rgba(0,0,0,0.26);
          text-decoration: none;
        }
        .hero-btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 22px;
          border-radius: var(--radius-button);
          background: rgba(255,255,255,0.14);
          border: 1px solid rgba(255,255,255,0.28);
          color: #fff;
          font-weight: 700;
          font-size: 15px;
          text-decoration: none;
          backdrop-filter: blur(10px);
          transition: background 0.16s, transform 0.12s;
        }
        .hero-btn-secondary:hover {
          background: rgba(255,255,255,0.22);
          text-decoration: none;
          transform: translateY(-1px);
        }
        .hero-pantry-link {
          font-size: 13px;
          color: rgba(255,255,255,0.7);
          text-decoration: none;
          width: fit-content;
          transition: color 0.14s;
        }
        .hero-pantry-link:hover {
          color: #fff;
          text-decoration: none;
        }
        .hero-right {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .hero-deco {
          font-size: 80px;
          line-height: 1;
          opacity: 0.6;
          filter: drop-shadow(0 8px 20px rgba(0,0,0,0.18));
          user-select: none;
        }
        @media (max-width: 680px) {
          .hero-right { display: none; }
          .hero-card { padding: 24px 20px; }
        }

        /* ── SECTION HEADER ── */
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .section-header .section-title { margin-bottom: 0; }
        .view-all-link {
          font-size: 13px;
          font-weight: 700;
          color: var(--primary);
          text-decoration: none;
          flex-shrink: 0;
        }
        .view-all-link:hover { opacity: 0.75; text-decoration: none; }

        /* ── OVERVIEW CARDS ── */
        .overview-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 900px) {
          .overview-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 600px) {
          .overview-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
        }
        .ov-card {
          position: relative;
          padding: 20px;
          border-radius: var(--radius-card);
          background: var(--bg-raised);
          border: 1px solid var(--border);
          box-shadow: var(--shadow);
          display: grid;
          gap: 12px;
          grid-template-rows: auto 1fr auto;
          transition: transform 0.14s, box-shadow 0.16s;
        }
        .ov-card:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,0.1); }
        .ov-icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: grid;
          place-items: center;
        }
        .ov-green .ov-icon { background: #dcfce7; color: #16a34a; }
        .ov-amber .ov-icon { background: #fef3c7; color: #d97706; }
        .ov-teal  .ov-icon { background: #ccfbf1; color: #0d9488; }
        .ov-purple .ov-icon { background: #ede9fe; color: #7c3aed; }
        [data-theme="dark"] .ov-green .ov-icon  { background: rgba(22,163,74,0.18); color: #4ade80; }
        [data-theme="dark"] .ov-amber .ov-icon  { background: rgba(217,119,6,0.18); color: #fbbf24; }
        [data-theme="dark"] .ov-teal .ov-icon   { background: rgba(13,148,136,0.18); color: #2dd4bf; }
        [data-theme="dark"] .ov-purple .ov-icon { background: rgba(124,58,237,0.18); color: #a78bfa; }
        .ov-body { display: grid; gap: 4px; }
        .ov-num {
          font-size: 30px;
          font-weight: 800;
          line-height: 1;
          color: var(--text);
        }
        .ov-label {
          font-size: 14px;
          font-weight: 700;
          color: var(--text);
        }
        .ov-hint {
          font-size: 12px;
          color: var(--muted);
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .ov-warn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #dc2626;
        }
        [data-theme="dark"] .ov-warn { color: #f87171; }
        .ov-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 700;
          color: var(--primary);
          text-decoration: none;
          transition: gap 0.14s;
        }
        .ov-link:hover { gap: 8px; text-decoration: none; }

        /* ── QUICK ACTIONS ── */
        /*
         * .qa-grid lives on a DOM element rendered directly in DashboardPage,
         * so it can stay scoped. All .qa-card rules use :global() because
         * QuickActionCard is defined outside this component — styled-jsx's
         * hash is never applied to elements it renders, so scoped selectors
         * would never match and the cards would inherit only browser defaults.
         */
        .qa-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
        }
        :global(.qa-card) {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 14px;
          min-height: 128px;
          padding: 18px;
          border-radius: var(--radius-card);
          border: 1.5px solid transparent;
          text-decoration: none;
          cursor: pointer;
          transition: transform 0.14s, box-shadow 0.16s;
          background: var(--bg-raised);
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
          font-family: inherit;
          -webkit-appearance: none;
          appearance: none;
          color: var(--text);
          font-size: 14px;
          line-height: 1;
          box-sizing: border-box;
          width: 100%;
          text-align: left;
        }
        :global(.qa-card:hover) {
          transform: translateY(-3px);
          box-shadow: 0 10px 26px rgba(0,0,0,0.1);
          text-decoration: none;
          color: var(--text);
        }
        :global(.qa-card:active) {
          transform: translateY(1px);
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        :global(.qa-card:focus-visible) {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }
        :global(.qa-icon) {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }
        :global(.qa-label) {
          font-size: 13px;
          font-weight: 700;
          color: var(--text);
          text-align: left;
          line-height: 1.35;
        }
        :global(.qa-green)  { border-color: #bbf7d0; }
        :global(.qa-amber)  { border-color: #fde68a; }
        :global(.qa-blue)   { border-color: color-mix(in oklab, var(--primary) 28%, var(--border)); }
        :global(.qa-violet) { border-color: #ddd6fe; }
        :global(.qa-rose)   { border-color: #fecdd3; }
        :global(.qa-green  .qa-icon) { background: #dcfce7; color: #16a34a; }
        :global(.qa-amber  .qa-icon) { background: #fef3c7; color: #d97706; }
        :global(.qa-blue   .qa-icon) { background: color-mix(in oklab, var(--primary) 12%, transparent); color: var(--primary); }
        :global(.qa-violet .qa-icon) { background: #ede9fe; color: #7c3aed; }
        :global(.qa-rose   .qa-icon) { background: #fff1f2; color: #e11d48; }
        :global([data-theme="dark"] .qa-green  .qa-icon) { background: rgba(22,163,74,0.18);  color: #4ade80; }
        :global([data-theme="dark"] .qa-amber  .qa-icon) { background: rgba(217,119,6,0.18);  color: #fbbf24; }
        :global([data-theme="dark"] .qa-violet .qa-icon) { background: rgba(124,58,237,0.18); color: #a78bfa; }
        :global([data-theme="dark"] .qa-rose   .qa-icon) { background: rgba(225,29,72,0.18);  color: #fb7185; }
        @media (max-width: 900px) {
          .qa-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 600px) {
          .qa-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          :global(.qa-card) {
            min-height: 112px;
            padding: 16px;
            gap: 12px;
          }
        }
        @media (max-width: 380px) {
          .qa-grid { grid-template-columns: 1fr; }
        }

        /* ── LAYOUT ── */
        .layout {
          display: grid;
          gap: 32px;
          grid-template-columns: minmax(0, 1fr) 296px;
          align-items: start;
        }
        @media (max-width: 1100px) {
          .layout { grid-template-columns: 1fr; }
          .sidebar { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
        }
        .main-col { display: grid; gap: 40px; }
        .sidebar { display: grid; gap: 20px; }

        /* ── PANTRY BLOCK ── */
        .pantry-block {
          padding: 24px;
          border-radius: var(--radius-card);
          background: linear-gradient(135deg, color-mix(in oklab, #dcfce7 80%, var(--bg-raised)), var(--bg-raised));
          border: 1.5px solid #bbf7d0;
          display: grid;
          gap: 18px;
        }
        [data-theme="dark"] .pantry-block {
          background: linear-gradient(135deg, rgba(22,163,74,0.08), var(--bg-raised));
          border-color: rgba(22,163,74,0.24);
        }
        .pantry-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .block-title {
          margin: 0 0 4px;
          font-size: 18px;
          font-weight: 800;
          color: var(--text);
        }
        .pantry-sub {
          color: #475569;
        }
        [data-theme="dark"] .pantry-sub {
          color: #94a3b8;
        }
        .pantry-ctas {
          display: flex;
          gap: 10px;
          flex-shrink: 0;
          flex-wrap: wrap;
        }
        .pant-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 16px;
          border-radius: var(--radius-button);
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          transition: transform 0.12s, opacity 0.14s;
          cursor: pointer;
          border: none;
          font-family: inherit;
        }
        .pant-btn:hover { transform: translateY(-1px); text-decoration: none; }
        .pant-primary { background: #16a34a; color: #fff; box-shadow: 0 6px 18px rgba(22,163,74,0.28); }
        .pant-ghost {
          background: transparent;
          border: 1.5px solid #16a34a;
          color: #16a34a;
        }
        [data-theme="dark"] .pant-ghost { color: #4ade80; border-color: #4ade80; }
        .ingredient-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          background: color-mix(in oklab, #dcfce7 70%, var(--bg-raised));
          border: 1px solid #bbf7d0;
          color: #15803d;
          transition: transform 0.12s;
        }
        [data-theme="dark"] .pill {
          background: rgba(22,163,74,0.12);
          border-color: rgba(22,163,74,0.28);
          color: #4ade80;
        }
        .pill-warn {
          background: #fef2f2;
          border-color: #fecaca;
          color: #dc2626;
        }
        [data-theme="dark"] .pill-warn {
          background: rgba(220,38,38,0.12);
          border-color: rgba(220,38,38,0.28);
          color: #f87171;
        }
        .pill-days {
          font-size: 11px;
          font-weight: 700;
          opacity: 0.75;
        }
        .pill-more {
          text-decoration: none;
          background: var(--bg);
          border-color: var(--border);
          color: var(--primary);
        }
        .pill-more:hover { transform: translateY(-1px); text-decoration: none; }

        /* ── RECIPE SPOTLIGHT ── */
        .spotlight-section { display: grid; gap: 16px; }
        .spotlight-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        @media (max-width: 640px) {
          .spotlight-grid { grid-template-columns: 1fr; }
        }
        .spot-card {
          border-radius: var(--radius-card);
          background: var(--bg-raised);
          border: 1px solid var(--border);
          box-shadow: var(--shadow);
          overflow: hidden;
          display: grid;
          grid-template-rows: 200px 1fr;
          transition: transform 0.14s, box-shadow 0.16s;
        }
        .spot-card:hover { transform: translateY(-3px); box-shadow: 0 12px 36px rgba(0,0,0,0.12); }
        .spot-img {
          position: relative;
          background: linear-gradient(135deg, #d1fae5, #a7f3d0);
          background-size: cover;
          background-position: center;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .spot-trending .spot-img {
          background: linear-gradient(135deg, #fef3c7, #fde68a);
        }
        .spot-emoji { font-size: 64px; }
        .spot-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
        }
        .spot-badge-green { background: #16a34a; color: #fff; }
        .spot-badge-amber { background: #d97706; color: #fff; }
        .spot-body { padding: 20px; display: grid; gap: 8px; align-content: start; }
        .spot-meta { margin: 0; font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
        .spot-title { margin: 0; font-size: 17px; font-weight: 800; color: var(--text); line-height: 1.3; }
        .spot-desc { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.5; }
        .spot-cta-row {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 4px;
          flex-wrap: wrap;
        }
        .spot-cta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 700;
          color: var(--primary);
          text-decoration: none;
          transition: gap 0.14s;
        }
        .spot-cta:hover { gap: 9px; text-decoration: none; }
        .spot-share-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 600;
          color: var(--muted);
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 5px 11px;
          cursor: pointer;
          font-family: inherit;
          transition: color 0.14s, border-color 0.14s, background 0.14s;
          -webkit-appearance: none;
          appearance: none;
        }
        .spot-share-btn:hover {
          color: var(--text);
          border-color: color-mix(in oklab, var(--border) 60%, var(--primary));
          background: color-mix(in oklab, var(--primary) 6%, transparent);
        }

        /* ── DISCOVER ── */
        .discover-section { display: grid; gap: 16px; }
        .discover-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
        }
        .see-all-link {
          font-size: 13px;
          font-weight: 700;
          color: var(--primary);
          text-decoration: none;
          flex-shrink: 0;
          margin-bottom: 2px;
        }
        .see-all-link:hover { text-decoration: none; opacity: 0.8; }
        .discover-scroll {
          display: grid;
          grid-template-columns: repeat(4, minmax(180px, 1fr));
          gap: 16px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .discover-scroll::-webkit-scrollbar { display: none; }
        @media (max-width: 900px) {
          .discover-scroll {
            grid-template-columns: repeat(4, 180px);
          }
        }
        .disc-card {
          position: relative;
          border-radius: var(--radius-card);
          background: var(--bg-raised);
          border: 1px solid var(--border);
          overflow: hidden;
          display: grid;
          grid-template-rows: 140px 1fr;
          transition: transform 0.14s, box-shadow 0.16s;
          flex-shrink: 0;
        }
        .disc-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
        .disc-link {
          display: contents;
          color: inherit;
          text-decoration: none;
        }
        .disc-share-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 30px;
          height: 30px;
          border-radius: 999px;
          border: none;
          background: rgba(15,23,42,0.52);
          color: #fff;
          display: grid;
          place-items: center;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.18s, transform 0.14s;
          backdrop-filter: blur(6px);
          z-index: 1;
          padding: 0;
        }
        .disc-card:hover .disc-share-btn { opacity: 1; }
        .disc-share-btn:hover { transform: scale(1.1); }
        .disc-img {
          background: linear-gradient(135deg, #d1fae5, #a7f3d0);
          background-size: cover;
          background-position: center;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .disc-emoji { font-size: 40px; }
        .disc-body { padding: 14px; display: grid; gap: 4px; }
        .disc-cat { margin: 0; font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
        .disc-title { margin: 0; font-size: 14px; font-weight: 700; color: var(--text); line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .disc-author { margin: 0; font-size: 12px; color: var(--muted); }

        /* ── FEED ── */
        .feed-section { display: grid; gap: 20px; }
        .feed-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .feed-head-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .feed-sort-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--muted);
          cursor: pointer;
          user-select: none;
        }
        .feed-new-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: var(--radius-button);
          border: 1.5px solid color-mix(in oklab, var(--primary) 32%, var(--border));
          background: color-mix(in oklab, var(--primary) 10%, transparent);
          color: var(--primary);
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.16s, transform 0.12s;
          flex-shrink: 0;
          margin-bottom: 2px;
        }
        .feed-new-btn:hover { background: color-mix(in oklab, var(--primary) 18%, transparent); transform: translateY(-1px); }
        .feed { display: grid; gap: 18px; }
        :global(.feed > *) { max-width: 720px; width: 100%; margin: 0 auto; }
        .feed-empty {
          display: grid;
          gap: 16px;
          justify-items: center;
          padding: 40px 28px;
          border-radius: var(--radius-card);
          background: var(--bg-raised);
          border: 1px dashed color-mix(in oklab, var(--primary) 24%, var(--border));
          text-align: center;
          color: var(--muted);
        }
        .feed-empty p { margin: 0; }

        /* ── QUICK ACTIONS LIST (sidebar) ── */
        .qa-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        :global(.qa-list-item) {
          min-height: auto !important;
          flex-direction: row !important;
          align-items: center !important;
          padding: 10px 14px !important;
          gap: 10px !important;
        }
        :global(.qa-list-item .qa-icon) {
          width: 32px !important;
          height: 32px !important;
          border-radius: 8px !important;
        }
        :global(.qa-list-item .qa-label) {
          font-size: 13px !important;
        }

        /* ── SIDEBAR ── */
        .sb-card {
          padding: 22px;
          border-radius: var(--radius-card);
          background: var(--bg-raised);
          border: 1px solid var(--border);
          box-shadow: var(--shadow);
          display: grid;
          gap: 16px;
          position: sticky;
          top: 20px;
        }
        .sb-warn-card { border-color: #fca5a5; background: color-mix(in oklab, #fef2f2 60%, var(--bg-raised)); }
        [data-theme="dark"] .sb-warn-card { border-color: rgba(220,38,38,0.3); background: color-mix(in oklab, rgba(220,38,38,0.08) 100%, var(--bg-raised)); }
        .sb-recipe-card { border-color: color-mix(in oklab, #16a34a 22%, var(--border)); }
        .sb-trend-card {}
        .sb-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .sb-title { margin: 0; font-size: 16px; font-weight: 800; color: var(--text); }
        .sb-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 22px;
          height: 22px;
          padding: 0 6px;
          border-radius: 999px;
          background: #dc2626;
          color: #fff;
          font-size: 12px;
          font-weight: 800;
        }
        .sb-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
        .sb-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .sb-item-name { font-size: 14px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sb-item-days { font-size: 12px; font-weight: 700; color: var(--muted); flex-shrink: 0; }
        .sb-today { color: #dc2626 !important; }
        .sb-urgent { color: #ea580c !important; }
        .sb-cta {
          display: inline-flex;
          font-size: 13px;
          font-weight: 700;
          color: var(--primary);
          text-decoration: none;
          transition: opacity 0.14s;
        }
        .sb-cta:hover { opacity: 0.75; text-decoration: none; }
        .sb-empty { margin: 0; font-size: 13px; color: var(--muted); }
        .sb-recipe-img {
          height: 120px;
          border-radius: 12px;
          background: linear-gradient(135deg, #d1fae5, #a7f3d0);
          background-size: cover;
          background-position: center;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sb-recipe-emoji { font-size: 48px; }
        .sb-recipe-name { margin: 0; font-size: 15px; font-weight: 800; color: var(--text); line-height: 1.3; }
        .sb-recipe-meta { margin: 0; font-size: 12px; color: var(--muted); }
        .sb-trend-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }

        /* ── TREND ITEMS (sidebar) ── */
        .trend-dot {
          width: 12px; height: 12px;
          border-radius: 999px;
          background: #22c55e;
          box-shadow: 0 0 0 6px rgba(34,197,94,0.18);
        }
        .trend-item {
          border-radius: var(--radius-button);
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          background: color-mix(in oklab, var(--bg-raised) 92%, transparent);
          transition: border-color 0.18s, transform 0.14s, background 0.18s;
        }
        .trend-item:hover {
          background: color-mix(in oklab, var(--primary) 8%, var(--bg-raised));
          border-color: color-mix(in oklab, var(--primary) 26%, var(--border));
          transform: translateY(-2px);
        }
        .trend-link {
          display: grid;
          grid-template-columns: 52px 1fr;
          gap: 12px;
          align-items: center;
          padding: 10px 12px;
          text-decoration: none;
          color: inherit;
        }
        .trend-thumb {
          position: relative;
          width: 52px; height: 52px;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--border);
          background: var(--bg);
          display: grid;
          place-items: center;
        }
        .trend-rank-num { font-weight: 800; font-size: 14px; color: var(--muted); }
        .trend-thumb video { width: 100%; height: 100%; object-fit: cover; display: block; }
        .trend-thumb :global(.trendImage) { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .trend-body { min-width: 0; display: grid; gap: 5px; }
        .trend-row { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
        .trend-rank { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); flex-shrink: 0; }
        .trend-title { font-size: 13px; font-weight: 700; color: var(--text); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .trend-meta { font-size: 11px; color: var(--muted); }

        /* ── SHARE TOAST ── */
        .share-toast {
          position: fixed;
          bottom: 28px;
          left: 50%;
          transform: translateX(-50%);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 20px;
          border-radius: 999px;
          background: #1e293b;
          color: #f8fafc;
          font-size: 14px;
          font-weight: 600;
          box-shadow: 0 8px 32px rgba(0,0,0,0.28);
          z-index: 2000;
          pointer-events: none;
          white-space: nowrap;
          animation: toastIn 0.22s ease;
        }
        [data-theme="dark"] .share-toast {
          background: #f1f5f9;
          color: #0f172a;
        }
        .share-toast-check {
          color: #4ade80;
          font-size: 16px;
          font-weight: 800;
          flex-shrink: 0;
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        /* ── MODAL ── */
        .backdrop {
          position: fixed; inset: 0;
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
          box-shadow: 0 28px 68px rgba(15,23,42,0.42);
          overflow: hidden;
        }
        .mHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
        }
        .mTitle { font-weight: 800; font-size: 18px; }
        .x {
          border: 0; background: transparent; color: var(--muted);
          cursor: pointer; font-size: 18px; border-radius: var(--radius-button);
          width: 32px; height: 32px; display: grid; place-items: center;
        }
        .x:hover { color: var(--text); background: color-mix(in oklab, var(--primary) 12%, transparent); }
        .mBody { padding: 20px; display: grid; gap: 14px; }
        .lab { font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
        textarea, input[type="text"], input[type="file"] {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: var(--radius-button);
          background: var(--bg);
          color: var(--text);
          padding: 12px 14px;
          font: inherit;
        }
        textarea:focus, input[type="text"]:focus, input[type="file"]:focus {
          outline: none;
          border-color: color-mix(in oklab, var(--primary) 42%, var(--border));
          box-shadow: 0 0 0 4px color-mix(in oklab, var(--primary) 18%, transparent);
        }
        textarea { min-height: 120px; resize: vertical; }
        .videoWarn { display: flex; align-items: flex-start; gap: 8px; background: #fef2f2; border: 1.5px solid #fca5a5; border-radius: 10px; padding: 10px 12px; font-size: 13px; color: #991b1b; line-height: 1.45; }
        .videoWarnIcon { flex-shrink: 0; font-size: 15px; margin-top: 1px; }
        .preview { display: grid; gap: 12px; }
        .preview.grid-1 { grid-template-columns: 1fr; }
        .preview.grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .pCell {
          position: relative;
          border: 1px solid var(--border);
          border-radius: var(--radius-button);
          overflow: hidden;
          background: #000;
          aspect-ratio: 16 / 10;
        }
        .pCell video { width: 100%; height: 100%; object-fit: cover; display: block; }
        .pCell :global(.pImage) { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
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
          padding: 10px 18px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.12s, background 0.16s, border-color 0.16s, box-shadow 0.16s;
          font-family: inherit;
        }
        .btn:hover { background: color-mix(in oklab, var(--bg) 80%, var(--primary) 10%); }
        .btn:active { transform: translateY(1px); }
        .btn-primary {
          background: var(--primary);
          color: var(--primary-contrast);
          border-color: color-mix(in oklab, var(--primary) 55%, var(--border));
          box-shadow: 0 10px 28px color-mix(in oklab, var(--primary) 28%, transparent);
        }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }
        .ghost { background: transparent; }
        .bad {
          margin: 0;
          padding: 10px 12px;
          border-radius: var(--radius-button);
          border: 1px solid rgba(239,68,68,0.26);
          background: rgba(239,68,68,0.12);
          color: #7f1d1d;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}
