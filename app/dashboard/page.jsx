"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NextImage from "next/image";
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
  where,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

import { auth, db, storage } from "@/lib/firebas1e";
import PostCard from "@/components/posts/PostCard";
import { getWeekPlan, getOrCreateDailyMeals, getMetrics } from "@/lib/fitness/store";
import { DEFAULT_AVATAR } from "@/lib/constants";


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
  const [userEmail, setUserEmail] = useState("");
  const [ready, setReady] = useState(false);

  const [recentPosts, setRecentPosts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [trendingReposts, setTrendingReposts] = useState({});
  const [meAuthor, setMeAuthor] = useState(null);
  const meAuthorRef = useRef(null);
  const normalizePostAuthor = useCallback((post) => {
    const author = post?.author || {};
    const avatarURL = author.avatarURL || author.photoURL || DEFAULT_AVATAR;
    const username = author.username || post?.username || null;
    const displayName =
      author.displayName ||
      author.name ||
      (typeof post?.authorName === "string" ? post.authorName : null) ||
      username;
    return {
      ...post,
      author: {
        ...author,
        uid: author.uid || post?.uid || null,
        username,
        displayName: displayName || null,
        avatarURL,
        photoURL: author.photoURL || avatarURL,
      },
    };
  }, []);
  const mergeAuthorIntoPosts = useCallback((list) => {
    const patch = meAuthorRef.current;
    return list.map((post) => {
      const isMine =
        !!(patch && uid) &&
        (post?.uid === uid || (post?.author && post.author.uid === uid));
      const updated = isMine ? { ...post, author: { ...post.author, ...patch } } : post;
      return normalizePostAuthor(updated);
    });
  }, [uid, normalizePostAuthor]);
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
    return ago ? `Last post Ā· ${ago} ago` : "Last post";
  }, [myPosts.length, lastPostMs]);

  const currentUser = useMemo(() => {
    if (!uid) return null;
    const patch = meAuthorRef.current || meAuthor;
    const authUser = auth.currentUser;
    return {
      uid,
      displayName: patch?.displayName || authUser?.displayName || null,
      username: patch?.username || (authUser?.email ? authUser.email.split("@")[0] : null),
      avatarURL:
        patch?.avatarURL ??
        patch?.photoURL ??
        authUser?.photoURL ??
        DEFAULT_AVATAR,
    };
  }, [uid, meAuthor]);

  const [pantryCount, setPantryCount] = useState(null);
  const [recentPantry, setRecentPantry] = useState([]);
  const [todayRecipe, setTodayRecipe] = useState(null);
  const [workoutOfDay, setWorkoutOfDay] = useState(null);
  const [weekSummary, setWeekSummary] = useState({ workouts: 0, meals: 0 });

  const pantryDisplay = pantryCount ?? 12;
  const pantryDisplayValue = pantryDisplay.toLocaleString();
  const workoutSnippet = workoutOfDay?.description
    ? workoutOfDay.description.length > 110
      ? `${workoutOfDay.description.slice(0, 107)}…`
      : workoutOfDay.description
    : "We keep a fresh move ready for your planner.";


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
        setUid(null);
        setUserEmail("");
        setReady(true);
        router.replace("/auth/login");
        return;
      }
      setUid(u.uid);
      setUserEmail(u.email || "");
      setReady(true);
    });
    return () => stop();
  }, [router]);

  useEffect(() => {
    if (!uid) {
      setMeAuthor(null);
      meAuthorRef.current = null;
      return;
    }
    const userRef = doc(db, "users", uid);
    const stop = onSnapshot(userRef, (snap) => {
      if (!snap.exists()) {
        setMeAuthor(null);
        meAuthorRef.current = null;
        return;
      }
      const data = snap.data() || {};
      const displayName = [data.firstName, data.lastName].filter(Boolean).join(" ").trim()
        || data.username
        || data.email
        || "You";
      const avatarURL = data.photoURL || data.avatarURL || DEFAULT_AVATAR;
      const authorPatch = {
        uid,
        displayName,
        username: data.username ?? null,
        avatarURL,
        photoURL: data.photoURL ?? data.avatarURL ?? null,
      };
      setMeAuthor(authorPatch);
      meAuthorRef.current = authorPatch;
      setRecentPosts((prev) => mergeAuthorIntoPosts(prev));
      setTrending((prev) => mergeAuthorIntoPosts(prev));
    });
    return () => stop();
  }, [uid, mergeAuthorIntoPosts]);

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
      setRecentPosts(mergeAuthorIntoPosts(list));
    });
    return () => stop();
  }, [uid, mergeAuthorIntoPosts]);

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
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
      setTrending(mergeAuthorIntoPosts(list));
    });
    return () => stop();
  }, [uid, mergeAuthorIntoPosts]);

  useEffect(() => {
    if (!uid) {
      setPantryCount(null);
      setRecentPantry([]);
      return;
    }
    const pantryQuery = query(
      collection(db, "pantryItems"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc"),
      fsLimit(12)
    );
    const stop = onSnapshot(
      pantryQuery,
      (snap) => {
        const docs = snap.docs.map((docSnap) => {
          const data = docSnap.data() || {};
          const nutrition = data.nutrition || {};
          const calories =
            typeof nutrition?.kcalPer100g === "number"
              ? Math.round(nutrition.kcalPer100g)
              : typeof nutrition?.kcalPerServing === "number"
              ? Math.round(nutrition.kcalPerServing)
              : null;
          return {
            id: docSnap.id,
            name: data.name || "Pantry item",
            calories,
          };
        });
        setPantryCount(snap.size);
        setRecentPantry(docs.slice(0, 3));
      },
      (error) => {
        console.warn("Failed to read pantry items", error);
        setPantryCount(null);
        setRecentPantry([]);
      }
    );
    return () => stop();
  }, [uid]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/recipes/random?count=1", { cache: "no-store" });
        if (!res.ok) throw new Error(`recipes-${res.status}`);
        const payload = await res.json();
        if (ignore) return;
        if (Array.isArray(payload) && payload.length) {
          const recipe = payload[0];
          setTodayRecipe({
            id: recipe?.id || "",
            title: recipe?.title || "Daily recipe",
            image: recipe?.image || null,
            description: recipe?.description || null,
          });
        } else {
          setTodayRecipe(null);
        }
      } catch (error) {
        if (!ignore) {
          console.warn("Failed to fetch daily recipe", error);
          setTodayRecipe(null);
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/workouts?limit=1", { cache: "no-store" });
        if (!res.ok) throw new Error(`workouts-${res.status}`);
        const payload = await res.json();
        if (ignore) return;
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
          ? payload.items
          : [];
        if (list.length) {
          const workout = list[0];
          const snippet = (workout?.description || "Follow the GIF demo.").toString();
          setWorkoutOfDay({
            id: workout?.id || "",
            name: workout?.name || "Workout",
            bodyPart: workout?.bodyPart || "full body",
            description: snippet,
            gifUrl: workout?.gifUrl || "",
          });
        } else {
          setWorkoutOfDay(null);
        }
      } catch (error) {
        if (!ignore) {
          console.warn("Failed to fetch workout of the day", error);
          setWorkoutOfDay(null);
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const metrics = await getMetrics().catch(() => null);
        if (ignore) return;
        const goal = metrics?.goal ?? "maintain";
        const plan = await getWeekPlan();
        if (ignore) return;
        const workouts = Object.values(plan?.days || {}).reduce((total, day) => {
          const items = Array.isArray(day?.items) ? day.items.length : 0;
          return total + items;
        }, 0);
        const meals = await getOrCreateDailyMeals(undefined, goal, 3);
        if (!ignore) {
          setWeekSummary({ workouts, meals: Array.isArray(meals) ? meals.length : 0 });
        }
      } catch (error) {
        if (!ignore) {
          console.warn("Failed to compute weekly summary", error);
          setWeekSummary({ workouts: 0, meals: 0 });
        }
      }
    })();
    return () => {
      ignore = true;
    };
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

  async function handleReport(post, details) {
    const me = auth.currentUser;
    if (!me || !post?.id) {
      throw new Error("You must be signed in to report posts.");
    }
    const reason = typeof details?.reason === "string" ? details.reason.trim() : "";
    if (reason.length < 10) {
      throw new Error("Please provide at least 10 characters explaining the issue.");
    }

    const postRef = doc(db, "posts", post.id, "reports", me.uid);
    const postPreview = (
      post?.title ||
      post?.text ||
      post?.description ||
      ""
    )
      .toString()
      .slice(0, 180);

    await setDoc(
      postRef,
      {
        uid: me.uid,
        postId: post.id,
        postOwnerUid: post?.uid ?? null,
        postPreview,
        reason,
        createdAt: serverTimestamp(),
      },
      { merge: false }
    );

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          payload?.error || payload?.message || `Failed to deliver report (status ${response.status}).`;
        throw new Error(message);
      }
    } catch (err) {
      console.warn("Report email failed", err);
      throw err instanceof Error ? err : new Error("Failed to deliver the report.");
    }
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
    
      let author = { username: null, displayName: null, avatarURL: DEFAULT_AVATAR };
      try {
        const uSnap = await getDoc(doc(db, "users", uid));
        if (uSnap.exists()) {
          const u = uSnap.data() || {};
          author = {
            username: u.username || null,
            displayName: u.firstName
              ? `${u.firstName}${u.lastName ? " " + u.lastName : ""}`
              : u.displayName || null,
            avatarURL: u.photoURL || DEFAULT_AVATAR,
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

      <section className="today container">
        <div className="today-head">
          <div>
            <h2>Today</h2>
            <p>Quick snapshot to jump back into your routine.</p>
          </div>
        </div>
        <div className="today-grid">
          <article className="today-card">
            <span className="today-label">Pantry items</span>
            <span className="today-value">{pantryDisplayValue}</span>
            <p className="today-copy">Currently tracked in your pantry.</p>
          </article>

          <article className="today-card today-media">
            <div className="today-card-body">
              <div className="today-card-text">
                <span className="today-label">Today&apos;s recipe</span>
                <div className="today-title">{todayRecipe?.title ?? "Fetching a meal..."}</div>
                <p className="today-copy">
            {todayRecipe?.description
              ? todayRecipe.description.length > 110
                ? `${todayRecipe.description.slice(0, 107)}…`
                : todayRecipe.description
              : "We refresh this suggestion every few hours."}
                </p>
              </div>
              <div className="today-thumb">
                {todayRecipe?.image ? (
                  <NextImage
                    src={todayRecipe.image}
                    alt={todayRecipe.title}
                    fill
                    sizes="120px"
                    className="today-thumb-img"
                    priority
                  />
                ) : (
                  <span className="today-thumb-fallback" aria-hidden>
                    🍽️
                  </span>
                )}
              </div>
            </div>
            <Link className="today-link" href="/recipes">
              Browse recipes
            </Link>
          </article>

          <article className="today-card today-workout">
            <span className="today-label">Workout of the day</span>
            <div className="today-title">{workoutOfDay?.name ?? "Loading workout..."}</div>
            <p className="today-copy">
              {workoutOfDay?.bodyPart ? `${workoutOfDay.bodyPart.toUpperCase()} · ` : ""}
              {workoutSnippet}
            </p>
            <Link className="today-link" href="/fitness/day">
              Open planner
            </Link>
          </article>
        </div>
      </section>

      <div className="container layout">
        <section className="stream">
          <div className="stream-head">
            <div>
              <h2>Community feed</h2>
              <p>Fresh updates from the people keeping their kitchens on track.</p>
            </div>
          </div>
          <div className="feed">
            {recentPosts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                meUid={uid}
                currentUser={currentUser}
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
          <div className="aside-card">
            <div className="aside-head">
              <div>
                <h2>Recently scanned</h2>
                <p>Last three pantry items with saved nutrition.</p>
              </div>
            </div>
            {recentPantry.length === 0 ? (
              <p className="aside-empty">No items scanned recently.</p>
            ) : (
              <ul className="recent-list">
                {recentPantry.map((item) => (
                  <li key={item.id} className="recent-item">
                    <span className="recent-name">{item.name}</span>
                    <span className="recent-kcal">
                      {typeof item.calories === "number"
                        ? `${item.calories} kcal / 100g`
                        : "No nutrition saved"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="aside-card">
            <div className="aside-head">
              <div>
                <h2>Your week</h2>
                <p>Planned workouts and today&apos;s suggested meals.</p>
              </div>
            </div>
            <div className="week-grid">
              <div className="week-pod">
                <span className="week-value">{weekSummary.workouts}</span>
                <span className="week-label">Workouts planned</span>
              </div>
              <div className="week-pod">
                <span className="week-value">{weekSummary.meals}</span>
                <span className="week-label">Meals suggested today</span>
              </div>
            </div>
          </div>

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
                              <NextImage
                                src={thumb.url}
                                alt={p.title || p.text || "Trending post media"}
                                fill
                                sizes="56px"
                                className="trendImage"
                                unoptimized
                              />
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
              <button className="x" onClick={() => setOpenComposer(false)}>X</button>
            </div>

            <div className="mBody">
              {errPost ? <p className="bad">{errPost}</p> : null}

              <label className="lab">Text</label>
              <textarea
                rows={4}
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="Whats on your mind?"
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
                      {m.type === "video" ? (
                        <video src={m.url} controls muted />
                      ) : (
                        <NextImage
                          src={m.url}
                          alt={`Selected media ${i + 1}`}
                          fill
                          sizes="(max-width: 768px) 100vw, 420px"
                          className="pImage"
                          unoptimized
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mFoot">
              <button className="btn ghost" onClick={() => setOpenComposer(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createPost} disabled={busyPost}>
                {busyPost ? "Publishing..." : "Publish"}
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
        .today {
          display: grid;
          gap: 18px;
          margin: 40px auto;
        }
        .today-head h2 {
          margin: 0;
          font-size: 22px;
          font-weight: 800;
        }
        .today-head p {
          margin: 4px 0 0;
          color: var(--muted);
          font-size: 14px;
        }
        .today-grid {
          display: grid;
          gap: 18px;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        }
        .today-card {
          border: 1px solid var(--border);
          border-radius: var(--radius-card);
          background: var(--card-bg);
          box-shadow: var(--shadow);
          padding: 18px;
          display: grid;
          gap: 10px;
        }
        .today-label {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
        }
        .today-value {
          font-size: 2.4rem;
          font-weight: 800;
          color: var(--text);
          line-height: 1;
        }
        .today-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text);
        }
        .today-copy {
          margin: 0;
          color: var(--muted);
          font-size: 0.9rem;
          line-height: 1.45;
        }
        .today-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--primary);
          font-weight: 700;
          text-decoration: none;
        }
        .today-link:hover {
          text-decoration: underline;
        }
        .today-media .today-card-body {
          display: flex;
          align-items: center;
          gap: 18px;
        }
        .today-card-text {
          display: grid;
          gap: 6px;
          flex: 1;
        }
        .today-thumb {
          position: relative;
          width: 100px;
          height: 100px;
          border-radius: 20px;
          border: 1px solid var(--border);
          background: var(--bg2);
          overflow: hidden;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }
        .today-thumb-img {
          object-fit: cover;
          width: 100%;
          height: 100%;
        }
        .today-thumb-fallback {
          font-size: 32px;
        }
        .today-workout .today-copy {
          min-height: 48px;
        }
        @media (max-width: 720px) {
          .today-grid {
            grid-template-columns: 1fr;
          }
          .today {
            margin: 28px auto;
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
        .aside-card {
          display: grid;
          gap: 14px;
          padding: 20px;
          border-radius: var(--radius-card);
          border: 1px solid var(--border);
          background: var(--bg-raised);
          box-shadow: var(--shadow);
        }
        .aside-head h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
        }
        .aside-head p {
          margin: 4px 0 0;
          color: var(--muted);
          font-size: 13px;
        }
        .aside-empty {
          margin: 0;
          color: var(--muted);
          font-size: 13px;
        }
        .recent-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 10px;
        }
        .recent-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 6px 0;
          border-bottom: 1px dashed color-mix(in oklab, var(--border) 80%, transparent);
        }
        .recent-item:last-of-type {
          border-bottom: none;
        }
        .recent-name {
          font-weight: 700;
          color: var(--text);
        }
        .recent-kcal {
          font-size: 0.85rem;
          color: var(--muted);
          text-align: right;
        }
        .week-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        }
        .week-pod {
          border: 1px solid color-mix(in oklab, var(--border) 85%, transparent);
          border-radius: var(--radius-button);
          padding: 14px;
          background: color-mix(in oklab, var(--bg2) 94%, transparent);
          display: grid;
          gap: 6px;
        }
        .week-value {
          font-size: 1.8rem;
          font-weight: 800;
          color: var(--text);
          line-height: 1;
        }
        .week-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
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
          position: relative;
          width: 56px;
          height: 56px;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid var(--border);
          background: var(--bg);
          display: grid;
          place-items: center;\n          font-weight: 800;\n          font-size: 16px;\n          color: var(--muted);
        }
        .trend-thumb video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .trend-thumb :global(.trendImage) {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
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
          position: relative;
          border: 1px solid var(--border);
          border-radius: var(--radius-button);
          overflow: hidden;
          background: #000;
          aspect-ratio: 16 / 10;
        }
        .pCell video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .pCell :global(.pImage) {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
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
