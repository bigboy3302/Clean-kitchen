// app/dashboard/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db, storage } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc, collection, onSnapshot, query, where, orderBy,
  serverTimestamp, updateDoc, doc as fsDoc, getDoc
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PostCard from "@/components/posts/PostCard";

/* --- super-simple profanity guard --- */
const BAD_WORDS = ["fuck","shit","bitch","asshole","cunt","nigger","faggot"];
const clean = (t) => !t || !BAD_WORDS.some((w) => String(t).toLowerCase().includes(w));

/* --- strip undefined deeply (arrays & objects) --- */
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

/* ---- helpers: get image/video dimensions (optional) ---- */
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
        .map((d) => ({ id: d.id, ...(d.data() || {}) })) // ✅ fixed
        .filter((p) => p.isRepost !== true);
      list.sort((a,b) => (b?.createdAt?.seconds||0) - (a?.createdAt?.seconds||0));
      setMyPosts(list);
    });

    // My recipes (view-only on dashboard)
    const qr = query(collection(db, "recipes"), where("uid", "==", uid));
    const stopR = onSnapshot(qr, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
      list.sort((a,b) => (b?.createdAt?.seconds||0) - (a?.createdAt?.seconds||0));
      setMyRecipes(list);
    });

    // Recent posts
    const qAll = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const stopAll = onSnapshot(qAll, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() || {}) })) // ✅ fixed
        .filter((p) => p.isRepost !== true);
      setRecentPosts(list.slice(0, 20));
    });

    return () => { stopP(); stopR(); stopAll(); };
  }, [uid]);

  // modal state (Post only)
  const [open, setOpen] = useState(false);
  const [err, setErr]   = useState(null);
  const [ok, setOk]     = useState(null);

  // lock background scroll when modal open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = open ? "hidden" : prev || "";
    return () => { document.body.style.overflow = prev || ""; };
  }, [open]);

  // create post (media support)
  const [pText, setPText] = useState("");
  const [pFiles, setPFiles] = useState([]);
  const [pPreviews, setPPreviews] = useState([]); // [{url,type}]
  const [busyPost, setBusyPost] = useState(false);

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

  async function createPost() {
    setErr(null); setOk(null);
    if (!uid) return;
    if (!pText.trim() && pFiles.length === 0) { setErr("Nothing to publish."); return; }
    if (!clean(pText)) { setErr("Please avoid offensive words in your post."); return; }

    setBusyPost(true);
    try {
      // embed author info
      let author = { username: null, displayName: null, avatarURL: null };
      try {
        const snap = await getDoc(fsDoc(db, "users", uid));
        if (snap.exists()) {
          const u = snap.data() || {};
          author = {
            username: u.username || null,
            displayName: u.firstName ? `${u.firstName}${u.lastName ? " " + u.lastName : ""}` : null,
            avatarURL: u.photoURL || null,
          };
        }
      } catch {}

      // draft post
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
      for (const file of pFiles) {
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
      setOpen(false);
    } catch (e) {
      const msg = e?.message || String(e);
      setErr(
        msg.includes("preflight") || msg.includes("CORS") || msg.includes("appCheck")
          ? "Upload blocked by App Check (or CORS symptom). Check App Check setup & debug token."
          : msg
      );
    } finally {
      setBusyPost(false);
    }
  }

  if (!ready) return null;

  return (
    <main className="wrap">
      <Card className="hero">
        <h1 className="heroTitle">Hello 👋 Welcome to <span className="brand">Clean-Kitchen</span></h1>
        <p className="heroText">
          Add <strong>posts</strong>, browse your <strong>recipes</strong>, and manage your <strong>pantry</strong>.
          Click the <strong>+</strong> to post something!
        </p>
      </Card>

      {recentPosts.length > 0 && (
        <section className="feed">
          <h2 className="h2">Recent Posts</h2>
          <div className="list">
            {recentPosts.map((p) => <PostCard key={p.id} post={p} meUid={uid} />)}
          </div>
        </section>
      )}

      {(myPosts.length > 0 || myRecipes.length > 0) && (
        <section className="feed two">
          {myPosts.length > 0 && (
            <div>
              <h2 className="h3">My Posts</h2>
              <div className="list">
                {myPosts.map((p) => <PostCard key={p.id} post={p} meUid={uid} />)}
              </div>
            </div>
          )}

          {myRecipes.length > 0 && (
            <div>
              <h2 className="h3">My Recipes</h2>
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
        </section>
      )}

      {/* FAB opens Post modal only */}
      <button className="fab" onClick={() => setOpen(true)} aria-label="Create post">
        <span>+</span>
      </button>

      {open && (
        <div className="overlay" onClick={() => setOpen(false)} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e)=>e.stopPropagation()}>
            <div className="head">
              <div className="title">New Post</div>
              <button className="close" onClick={()=>setOpen(false)}>✕</button>
            </div>

            {err && <p className="bad">{err}</p>}
            {ok &&  <p className="ok">{ok}</p>}

            <div className="body">
              <div className="field">
                <label className="label">Text</label>
                <textarea className="ta" rows={4} value={pText} onChange={(e)=>setPText(e.target.value)} />
              </div>
              <div className="field">
                <label className="label">Media (up to 4): images or videos</label>
                <input type="file" accept="image/*,video/*" multiple onChange={onPickPostFiles}/>
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
        .wrap { max-width: 1000px; margin: 0 auto; padding: 28px 24px 80px; }

        .hero {
          padding: 22px; border-radius: 18px;
          background: var(--card-bg); border:1px solid var(--border);
          box-shadow: 0 20px 50px color-mix(in oklab, #000 6%, transparent);
        }
        .heroTitle { font-size: 26px; font-weight: 800; margin: 0 0 6px; color: var(--text); }
        .brand { background: linear-gradient(90deg,var(--text),color-mix(in oklab,var(--text) 60%, transparent));
                 -webkit-background-clip:text; color:transparent; }
        .heroText { color: var(--muted); }

        .feed { margin-top: 18px; }
        .feed.two { display:grid; grid-template-columns: 1fr 1fr; gap:16px; }
        @media (max-width: 900px){ .feed.two { grid-template-columns:1fr; } }

        .h2 { font-size: 18px; font-weight: 700; margin: 0 0 10px; color: var(--text); }
        .h3 { font-size: 16px; font-weight: 700; margin: 0 0 10px; color: var(--text); }

        .list { display: grid; gap: 10px; }

        .recipes { list-style:none; padding:0; margin:0; display:grid; gap:8px; }
        .recipeItem { border:1px solid var(--border); border-radius:10px; background: var(--card-bg); }
        .recipeLink { display:block; padding:10px 12px; text-decoration:none; color:inherit; }
        .recipeLink:hover { background: var(--bg2); }
        .recipeTitle { font-weight:700; }
        .recipeDesc { color: var(--muted); font-size:14px; margin-top:2px; }

        .fab {
          position: fixed; right: 24px; bottom: 24px; width: 56px; height: 56px; border-radius: 9999px;
          background: var(--primary); color: var(--primary-contrast); border:none; font-size:30px; display:grid; place-items:center;
          box-shadow: 0 12px 32px rgba(0,0,0,.25); cursor:pointer; z-index:60;
        }
        .fab:hover { transform: translateY(-2px); opacity:.96; transition:.12s ease; }

        .overlay { position:fixed; inset:0; background:rgba(2,6,23,.55); display:grid; place-items:center; padding:16px; z-index:1200;}
        .modal { width:100%; max-width:760px; background: var(--card-bg); border-radius:16px; overflow:hidden; box-shadow:0 24px 60px rgba(0,0,0,.35); border:1px solid var(--border); }
        .head { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:8px; padding:12px 14px; border-bottom:1px solid var(--border); background: var(--bg2); }
        .head .title { font-weight:800; color: var(--text); }
        .close { border:none; background:transparent; font-size:18px; color: var(--muted); cursor:pointer; }
        .body { padding:14px; }
        .field { margin-bottom:12px; }
        .label { display:block; margin-bottom:6px; font-size:.9rem; color: var(--text); font-weight:600; }
        .ta { width:100%; border:1px solid var(--border); border-radius:12px; padding:10px 12px; background: var(--bg2); color: var(--text); font-size:14px; }
        .actions { display:flex; gap:12px; }
        .end { justify-content:flex-end; }

        .ok  { margin:10px 0 0; background: color-mix(in oklab, #10b981 16%, transparent); color:#065f46;
               border:1px solid color-mix(in oklab, #10b981 36%, transparent); border-radius:8px; padding:8px 10px; font-size:13px; }
        .bad { margin:10px 0 0; background: color-mix(in oklab, #ef4444 16%, transparent); color:#7f1d1d;
               border:1px solid color-mix(in oklab, #ef4444 36%, transparent); border-radius:8px; padding:8px 10px; font-size:13px; }

        /* compact preview grid */
        .mediaPreview { display: grid; gap: 6px; margin-top: 8px; }
        .mediaPreview img, .mediaPreview video {
          width: 100%; height: 100%; display: block; object-fit: cover;
          border-radius: 10px; border: 1px solid var(--border); background:#000;
        }
        .mediaPreview.mcount-1 { grid-template-columns: 1fr; grid-auto-rows: 160px; }
        .mediaPreview.mcount-2 { grid-template-columns: 1fr 1fr; grid-auto-rows: 130px; }
        .mediaPreview.mcount-3 { grid-template-columns: 2fr 1fr; grid-auto-rows: 110px; }
        .mediaPreview.mcount-3 .mCell:nth-child(1){ grid-row: 1 / span 2; height: 226px; }
        .mediaPreview.mcount-4 { grid-template-columns: 1fr 1fr; grid-auto-rows: 110px; }
      `}</style>
    </main>
  );
}
