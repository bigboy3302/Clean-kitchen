"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/firebase";
import {
  collection, doc, getDoc, onSnapshot, query, where, limit as fsLimit,
} from "firebase/firestore";

type AnyTs = { toDate?: () => Date; seconds?: number } | null | undefined;
const toMillis = (ts: AnyTs) =>
  !ts ? 0 :
  typeof ts?.toDate === "function" ? ts!.toDate().getTime() :
  typeof (ts as any)?.seconds === "number" ? (ts as any).seconds * 1000 : 0;

function trim(str: string, n: number) {
  if (!str) return "";
  return str.length <= n ? str : str.slice(0, n - 1) + "…";
}

export default function PublicProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const [uid, setUid] = useState<string | null>(null);

  const [profile, setProfile] = useState<{ displayName?: string|null; username?: string|null; avatarURL?: string|null } | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"posts"|"recipes">("recipes");

  // 1) resolve slug -> uid
  useEffect(() => {
    (async () => {
      try {
        if (!slug) return;
        const unameSnap = await getDoc(doc(db, "usernames", String(slug)));
        if (unameSnap.exists()) {
          const u = (unameSnap.data() || {}) as any;
          setUid(String(u.uid));
          return;
        }
        setUid(String(slug));
      } catch (e: any) {
        setErr(e?.message ?? "Failed to resolve profile.");
      }
    })();
  }, [slug]);

  // 2) public header
  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "usersPublic", uid))
      .then((s) => {
        if (s.exists()) {
          const p = s.data() as any;
          setProfile({
            displayName: p.displayName ?? null,
            username: p.username ?? null,
            avatarURL: p.avatarURL ?? null,
          });
        }
      })
      .catch(() => {});
  }, [uid]);

  // 3) posts (client-sort to avoid index)
  useEffect(() => {
    if (!uid) return;
    const qy = query(collection(db, "posts"), where("uid","==",uid), fsLimit(300));
    const stop = onSnapshot(qy, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setPosts(list);
      if (!profile && list[0]?.author) {
        const a = list[0].author || {};
        setProfile(p => p ?? {
          displayName: a.displayName ?? null,
          username: a.username ?? null,
          avatarURL: a.avatarURL ?? null,
        });
      }
    }, (e)=>setErr(e?.message ?? "Failed to load posts."));
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // 4) recipes (client-sort to avoid index)
  useEffect(() => {
    if (!uid) return;
    const qy = query(collection(db, "recipes"), where("uid","==",uid), fsLimit(300));
    const stop = onSnapshot(qy, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setRecipes(list);
    }, (e)=>setErr(e?.message ?? "Failed to load recipes."));
    return () => stop();
  }, [uid]);

  const sortedPosts   = useMemo(()=>posts.slice().sort((a,b)=>toMillis(b.createdAt)-toMillis(a.createdAt)),[posts]);
  const sortedRecipes = useMemo(()=>recipes.slice().sort((a,b)=>toMillis(b.createdAt)-toMillis(a.createdAt)),[recipes]);

  if (err) {
    return (
      <main className="wrap">
        <div className="card bad">{err}</div>
        <style jsx>{styles}</style>
      </main>
    );
  }
  if (!uid) {
    return (
      <main className="wrap">
        <div className="card">Loading profile…</div>
        <style jsx>{styles}</style>
      </main>
    );
  }

  const name = profile?.displayName || profile?.username || uid.slice(0,6);

  return (
    <main className="wrap">
      {/* HEADER */}
      <header className="head">
        <div className="who">
          {profile?.avatarURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="avatar" src={profile.avatarURL} alt="" />
          ) : (
            <div className="avatar ph">{name[0]?.toUpperCase() || "U"}</div>
          )}
          <div className="names">
            <h1 className="title">{name}</h1>
            {profile?.username ? <div className="muted">@{profile.username}</div> : null}
          </div>
        </div>
        <Link className="btn" href="/dashboard">Home</Link>
      </header>

      {/* TABS */}
      <nav className="tabs" role="tablist" aria-label="Profile sections">
        <button role="tab" aria-selected={tab==="recipes"} className={`tab ${tab==="recipes"?"on":""}`} onClick={()=>setTab("recipes")}>Recipes</button>
        <button role="tab" aria-selected={tab==="posts"} className={`tab ${tab==="posts"?"on":""}`} onClick={()=>setTab("posts")}>Posts</button>
      </nav>

      {/* RECIPES */}
      {tab==="recipes" && (
        <section className="section">
          {sortedRecipes.length===0 ? (
            <p className="muted">No recipes yet.</p>
          ) : (
            <ul className="recipeGrid">
              {sortedRecipes.map((r)=>(
                <li key={r.id} className="rc">
                  <Link href={`/recipes/${r.id}`} className="cardLink" aria-label={`Open recipe ${r.title || ""}`}>
                    <article className="recipeCard">
                      <div className="media">
                        {r.imageURL
                          ? <img src={r.imageURL} alt="" />
                          : <div className="ph" aria-hidden><svg width="24" height="24" viewBox="0 0 24 24"><path d="M4 5h16v14H4z M8 11a2 2 0 114 0 2 2 0 01-4 0zm10 6l-4.5-6-3.5 4.5L8 13l-4 4h14z" fill="currentColor"/></svg></div>}
                      </div>
                      <div className="rcBody">
                        <h3 className="rcTitle">{trim(r.title || "Untitled recipe", 64)}</h3>
                        {r.description ? <p className="rcDesc">{trim(r.description, 120)}</p> : null}
                        <div className="rcMeta">
                          {r.ingredients?.length ? <span className="badge">{r.ingredients.length} ingredients</span> : <span className="badge secondary">No ingredients</span>}
                          {r.createdAt ? <span className="muted">{new Date(toMillis(r.createdAt)).toLocaleDateString()}</span> : null}
                        </div>
                      </div>
                    </article>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* POSTS */}
      {tab==="posts" && (
        <section className="section">
          {sortedPosts.length===0 ? (
            <p className="muted">No posts yet.</p>
          ) : (
            <div className="feed">
              {sortedPosts.map((p)=>(
                <div key={p.id} className="postRow">
                  <Link href={`/posts/${p.id}`} className="postRowLink">
                    <article className="postMini">
                      {Array.isArray(p.media) && p.media[0]?.url
                        ? <img className="thumb" src={p.media[0].url} alt="" />
                        : <div className="thumb ph" />}
                      <div className="pmBody">
                        <div className="pmTitle">{trim(p.text || p.title || "Untitled post", 80)}</div>
                        <div className="pmMeta">
                          <span className="muted">{p.createdAt ? new Date(toMillis(p.createdAt)).toLocaleString() : ""}</span>
                          {p.reposts ? <span className="badge">↻ {p.reposts}</span> : null}
                        </div>
                      </div>
                    </article>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
.wrap { max-width: 1120px; margin: 0 auto; padding: 14px; color: var(--text); }
.card { border:1px solid var(--border); background: var(--card-bg); color: var(--text); border-radius:12px; padding:12px; }
.bad { background: color-mix(in oklab, #ef4444 12%, var(--card-bg)); color: color-mix(in oklab, #7f1d1d 70%, var(--text) 30%); border-color: color-mix(in oklab, #ef4444 35%, var(--border)); }

.head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px; }
.who { display:flex; gap:12px; align-items:center; min-width:0; }
.avatar { width:72px; height:72px; border-radius:999px; object-fit:cover; border:1px solid var(--border); }
.avatar.ph { width:72px; height:72px; border-radius:999px; display:grid; place-items:center; background:var(--bg2); color:var(--text); font-weight:900; }
.names { min-width:0; }
.title { margin:0; font-size: clamp(22px, 3.2vw, 32px); font-weight:900; letter-spacing:-.02em; }
.muted { color: var(--muted); }
.btn { border:1px solid var(--border); background: var(--bg2); color: var(--text); padding:8px 12px; border-radius:12px; text-decoration:none; font-weight:800; }
.btn:hover { background: color-mix(in oklab, var(--bg2) 90%, var(--bg)); }

.tabs { display:flex; gap:8px; border-bottom:1px solid var(--border); margin: 8px 0 12px; }
.tab { border:1px solid transparent; border-bottom: none; background: transparent; color: var(--muted); padding:8px 12px; border-radius:12px 12px 0 0; cursor: pointer; font-weight:800; }
.tab.on { color: var(--text); background: var(--bg2); border-color: var(--border); border-bottom-color: transparent; }

.section { margin-top: 8px; }

/* Recipe grid */
.recipeGrid {
  list-style:none; margin:0; padding:0;
  display:grid; gap:14px;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
}
.cardLink{ text-decoration:none; color:inherit; display:block; }
.recipeCard{
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  overflow:hidden;
  transition: transform .08s ease, box-shadow .14s ease, border-color .14s ease, background .14s ease;
}
.recipeCard:hover{
  transform: translateY(-2px);
  box-shadow: 0 18px 36px rgba(0,0,0,.12);
  border-color: color-mix(in oklab, var(--primary) 28%, var(--card-border));
}
.media{ aspect-ratio: 16/11; background:#000; }
.media img{ width:100%; height:100%; object-fit:cover; display:block; }
.media .ph{ width:100%; height:100%; display:grid; place-items:center; color: var(--muted); background: var(--bg2); }
.rcBody{ padding: 12px; display:grid; gap:6px; }
.rcTitle{ font-weight:900; letter-spacing:-.01em; }
.rcDesc{ color: var(--muted); font-size: 13px; line-height: 1.35; }
.rcMeta{ display:flex; align-items:center; justify-content:space-between; margin-top:2px; }
.badge{ font-size:12px; font-weight:800; padding: 2px 8px; border-radius:999px; background: color-mix(in oklab, var(--primary) 12%, var(--bg)); border:1px solid color-mix(in oklab, var(--primary) 35%, var(--border)); }
.badge.secondary{ background: color-mix(in oklab, var(--muted) 12%, var(--bg)); border-color: color-mix(in oklab, var(--muted) 35%, var(--border)); }

/* Posts list (compact) */
.feed{ display:grid; gap:10px; }
.postRowLink{ text-decoration:none; color:inherit; display:block; }
.postMini{
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 10px;
  display:grid; grid-template-columns: 80px 1fr; gap: 12px; align-items:center;
}
.thumb{ width:80px; height:80px; border-radius:12px; object-fit:cover; border:1px solid var(--border); background:#000; }
.thumb.ph{ background: var(--bg2) }
.pmBody{ min-width:0 }
.pmTitle{ font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pmMeta{ display:flex; gap:10px; align-items:center; margin-top:2px; }

@media (max-width: 560px){
  .recipeGrid{ grid-template-columns: repeat(auto-fill, minmax(180px,1fr)); }
  .postMini{ grid-template-columns: 64px 1fr; }
  .thumb{ width:64px; height:64px; }
}
`;
