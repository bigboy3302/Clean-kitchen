// app/dashboard/page.jsx
"use client";

import { useEffect, useState } from "react";
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
  getDoc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import PostCard from "@/components/posts/PostCard";

/* --- super-simple profanity guard --- */
const BAD_WORDS = ["fuck","shit","bitch","asshole","cunt","nigger","faggot"];
const clean = (t) => !t || !BAD_WORDS.some((w) => String(t).toLowerCase().includes(w));

/* --- strip undefined deeply (arrays & objects) --- */
function stripUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value.map(stripUndefinedDeep).filter((v) => v !== undefined);
  }
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

/* --- build ingredients without undefined keys --- */
function parseIngr(src) {
  return src
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((x) => x.trim());
      const rawName = parts[0] || "";
      const rawQty  = parts[1] || "";
      const rawUnit = parts[2] || "";
      const item = { name: rawName };
      const qtyNum = Number(rawQty);
      if (rawQty !== "" && !Number.isNaN(qtyNum)) item.qty = qtyNum;
      if (rawUnit) item.unit = rawUnit;
      return item;
    });
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

    // Recent posts
    const qAll = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const stopAll = onSnapshot(qAll, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() || {}) }))
        .filter((p) => p.isRepost !== true);
      setRecentPosts(list.slice(0, 20));
    });

    return () => { stopP(); stopR(); stopAll(); };
  }, [uid]);

  // modal state
  const [open, setOpen] = useState(false);
  const [tab, setTab]   = useState("post"); // 'post' | 'recipe'
  const [err, setErr]   = useState(null);
  const [ok, setOk]     = useState(null);

  // create post (media support)
  const [pText, setPText] = useState("");
  const [pFiles, setPFiles] = useState([]);
  const [pPreviews, setPPreviews] = useState([]); // [{url,type}]
  const [busyPost, setBusyPost] = useState(false);

  function onPickPostFiles(e) {
    const files = Array.from(e.target.files || []);
    const limited = files.slice(0, 4); // X limit
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
        (err) => {
          console.error("UPLOAD ERROR:", err?.code, err?.message);
          reject(err ?? new Error("upload failed"));
        },
        async () => {
          const url = await getDownloadURL(storageRef);
          resolve(url);
        }
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
      } catch (_) {}

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
          if (isVideo) {
            const dim = await getVideoDims(file);
            w = dim.w; h = dim.h; duration = dim.duration;
          } else {
            const dim = await getImageDims(file);
            w = dim.w; h = dim.h;
          }
        } catch {}

        const safeName = `${Date.now()}-${file.name}`.replace(/\s+/g, "_");
        const storagePath = `posts/${uid}/${draftRef.id}/${safeName}`;
        const sref = ref(storage, storagePath);
        const url = await uploadWithProgress(sref, file);

        uploaded.push({
          type: isVideo ? "video" : "image",
          url,
          storagePath,
          w, h,
          aspect: h ? w / h : undefined,
          ...(isVideo ? { duration } : {}),
        });
      }

      if (uploaded.length > 0) {
        await updateDoc(draftRef, { media: uploaded });
      }

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

  // recipe
  const [rTitle, setRTitle] = useState("");
  const [rDesc, setRDesc]   = useState("");
  const [rSteps, setRSteps] = useState("");
  const [rIngr, setRIngr]   = useState("");
  const [rFile, setRFile]   = useState(null);
  const [busyRecipe, setBusyRecipe] = useState(false);

  async function createRecipe() {
    setErr(null); setOk(null);
    if (!uid) return;
    if (!rTitle.trim()) { setErr("Please enter recipe title."); return; }
    if (![rTitle,rDesc,rSteps,rIngr].every(clean)) { setErr("Please avoid offensive words in your recipe."); return; }

    setBusyRecipe(true);
    try {
      const draft = await addDoc(collection(db,"recipes"), stripUndefinedDeep({
        uid,
        title: rTitle.trim(),
        description: rDesc.trim() ? rDesc.trim() : null,
        steps: rSteps.trim() ? rSteps.trim() : null,
        ingredients: parseIngr(rIngr),
        createdAt: serverTimestamp(),
      }));

      if (rFile) {
        const sref = ref(storage, `recipeImages/${uid}/${draft.id}`);
        const url = await uploadWithProgress(sref, rFile);
        await updateDoc(fsDoc(db,"recipes",draft.id), { imageURL: url });
      }

      setOk("Recipe created!");
      setRTitle(""); setRDesc(""); setRSteps(""); setRIngr(""); setRFile(null);
      setOpen(false);
    } catch (e) {
      setErr(e?.message ?? "Failed to create recipe.");
    } finally {
      setBusyRecipe(false);
    }
  }

  if (!ready) return null;

  return (
    <main className="wrap">
      <Card className="hero">
        <h1 className="heroTitle">Hello 👋 Welcome to <span className="brand">Clean-Kitchen</span></h1>
        <p className="heroText">
          Add <strong>posts</strong>, create <strong>recipes</strong>, and manage your <strong>pantry</strong>.
          Click the <strong>+</strong> to get started!
        </p>
      </Card>

      {recentPosts.length > 0 && (
        <section className="feed">
          <h2 className="h2">Recent Posts</h2>
          <div className="list">
            {recentPosts.map((p) => (
              <PostCard key={p.id} post={p} meUid={uid} />
            ))}
          </div>
        </section>
      )}

      {(myPosts.length > 0 || myRecipes.length > 0) && (
        <section className="feed two">
          {myPosts.length > 0 && (
            <div>
              <h2 className="h3">My Posts</h2>
              <div className="list">
                {myPosts.map((p) => (
                  <PostCard key={p.id} post={p} meUid={uid} />
                ))}
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

      <button className="fab" onClick={() => { setTab("post"); setOpen(true); }} aria-label="Create">
        <span>+</span>
      </button>

      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e)=>e.stopPropagation()}>
            <div className="tabs">
              <button className={`tab ${tab==="post"?"active":""}`} onClick={()=>setTab("post")}>New Post</button>
              <button className={`tab ${tab==="recipe"?"active":""}`} onClick={()=>setTab("recipe")}>New Recipe</button>
              <button className="close" onClick={()=>setOpen(false)}>✕</button>
            </div>

            {err && <p className="bad">{err}</p>}
            {ok &&  <p className="ok">{ok}</p>}

            {tab==="post" ? (
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
            ) : (
              <div className="body">
                <div className="grid">
                  <Input label="Title" value={rTitle} onChange={(e)=>setRTitle(e.target.value)} />
                  <Input label="Short description" value={rDesc} onChange={(e)=>setRDesc(e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">Ingredients (one per line, “Name | qty | unit”)</label>
                  <textarea className="ta" rows={4} value={rIngr} onChange={(e)=>setRIngr(e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">Steps</label>
                  <textarea className="ta" rows={4} value={rSteps} onChange={(e)=>setRSteps(e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">Image (optional)</label>
                  <input type="file" accept="image/*" onChange={(e)=>setRFile(e.target.files?.[0] || null)} />
                </div>
                <div className="actions end">
                  <Button variant="secondary" onClick={()=>setOpen(false)}>Cancel</Button>
                  <Button onClick={createRecipe} disabled={busyRecipe}>{busyRecipe?"Creating…":"Create"}</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .wrap { max-width: 1000px; margin: 0 auto; padding: 28px 24px 80px; }

        .hero { padding: 22px; border-radius: 18px; background:#fff; border:1px solid #eef2f7;
                box-shadow: 0 20px 50px rgba(2,6,23,.05); }
        .heroTitle { font-size: 26px; font-weight: 800; margin: 0 0 6px; color:#0f172a; }
        .brand { background: linear-gradient(90deg,#111827,#334155); -webkit-background-clip:text; color:transparent; }
        .heroText { color:#475569; }

        .feed { margin-top: 18px; }
        .feed.two { display:grid; grid-template-columns: 1fr 1fr; gap:16px; }
        @media (max-width: 900px){ .feed.two { grid-template-columns:1fr; } }

        .h2 { font-size: 18px; font-weight: 700; margin: 0 0 10px; color:#0f172a; }
        .h3 { font-size: 16px; font-weight: 700; margin: 0 0 10px; color:#111827; }

        .list { display: grid; gap: 10px; }

        .recipes { list-style:none; padding:0; margin:0; display:grid; gap:8px; }
        .recipeItem { border:1px solid #e5e7eb; border-radius:10px; background:#fff; }
        .recipeLink { display:block; padding:10px 12px; text-decoration:none; color:inherit; }
        .recipeLink:hover { background:#f8fafc; }
        .recipeTitle { font-weight:700; }
        .recipeDesc { color:#4b5563; font-size:14px; margin-top:2px; }

        .fab {
          position: fixed; right: 24px; bottom: 24px; width: 56px; height: 56px; border-radius: 9999px;
          background:#0f172a; color:#fff; border:none; font-size:30px; display:grid; place-items:center;
          box-shadow: 0 12px 32px rgba(0,0,0,.25); cursor:pointer; z-index:60;
        }
        .fab:hover { transform: translateY(-2px); opacity:.95; transition:.12s ease; }

        .overlay { position:fixed; inset:0; background:rgba(2,6,23,.45); display:grid; place-items:center; padding:16px; z-index:50;}
        .modal { width:100%; max-width:760px; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 24px 60px rgba(0,0,0,.2); }
        .tabs { display:grid; grid-template-columns:auto auto 1fr auto; gap:8px; align-items:center; padding:12px 14px; border-bottom:1px solid #eef2f7; background:#f8fafc; }
        .tab { border:1px solid #e5e7eb; background:#fff; padding:8px 12px; border-radius:10px; font-size:14px; cursor:pointer; }
        .tab.active { background:#0f172a; color:#fff; border-color:#0f172a; }
        .close { border:none; background:transparent; font-size:18px; color:#64748b; cursor:pointer; }
        .body { padding:14px; }
        .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px 16px; }
        @media (max-width: 800px){ .grid { grid-template-columns:1fr; } }
        .field { margin-bottom:12px; }
        .label { display:block; margin-bottom:6px; font-size:.9rem; color:#0f172a; font-weight:600; }
        .ta { width:100%; border:1px solid #d1d5db; border-radius:12px; padding:10px 12px; background:#fff; font-size:14px; }
        .actions { display:flex; gap:12px; }
        .end { justify-content:flex-end; }

        .ok  { margin:10px 0 0; background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; border-radius:8px; padding:8px 10px; font-size:13px; }
        .bad { margin:10px 0 0; background:#fef2f2; color:#991b1b; border:1px solid #fecaca; border-radius:8px; padding:8px 10px; font-size:13px; }

        /* compact preview grid like X (smaller cells) */
        .mediaPreview { display: grid; gap: 6px; margin-top: 8px; }
        .mediaPreview img, .mediaPreview video {
          width: 100%; height: 100%; display: block; object-fit: cover;
          border-radius: 10px; border: 1px solid #e5e7eb; background:#000;
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
