'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebas1e';
import {
  collection,
  doc,
  getDoc,
  limit as fsLimit,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type FirestoreError,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

type AuthorLite = {
  displayName?: string | null;
  username?: string | null;
  avatarURL?: string | null;
};

type TimestampLike =
  | { seconds?: number; toDate?: () => Date }
  | Date
  | number
  | string
  | null
  | undefined;

type PublicProfile = {
  displayName?: string | null;
  username?: string | null;
  avatarURL?: string | null;
};

type MediaItem = {
  url?: string | null;
  src?: string | null;
  downloadURL?: string | null;
  href?: string | null;
  type?: string | null;
};

type PublicPost = {
  id: string;
  uid?: string | null;
  text?: string | null;
  title?: string | null;
  media?: MediaItem[];
  createdAt?: TimestampLike;
  author?: AuthorLite | null;
  reposts?: number | null;
};

type PublicRecipe = {
  id: string;
  title?: string | null;
  description?: string | null;
  ingredients?: unknown[];
  createdAt?: TimestampLike;
  gallery?: unknown;
  images?: unknown;
  media?: unknown;
};

const trim = (value: unknown, max: number): string => {
  const str = typeof value === 'string' ? value : String(value ?? '');
  if (str.length <= max) return str;
  const slicePoint = Math.max(0, max - 3);
  return `${str.slice(0, slicePoint).trimEnd()}...`;
};

const toMillis = (ts: TimestampLike): number => {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof ts === 'object') {
    if (typeof ts.toDate === 'function') {
      try {
        return ts.toDate().getTime();
      } catch {
        return 0;
      }
    }
    if (typeof ts.seconds === 'number') {
      return ts.seconds * 1000;
    }
  }
  return 0;
};

const coerceMediaItem = (value: unknown): MediaItem | null => {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const item: MediaItem = {
    url: typeof record.url === 'string' ? record.url : undefined,
    src: typeof record.src === 'string' ? record.src : undefined,
    downloadURL: typeof record.downloadURL === 'string' ? record.downloadURL : undefined,
    href: typeof record.href === 'string' ? record.href : undefined,
    type: typeof record.type === 'string' ? record.type : undefined,
  };
  return item;
};

const normalizePostDoc = (snapshot: QueryDocumentSnapshot<DocumentData>): PublicPost => {
  const data = snapshot.data() ?? {};
  const mediaRaw = Array.isArray(data.media) ? data.media : [];
  const media = mediaRaw
    .map(coerceMediaItem)
    .filter((item): item is MediaItem => item !== null);

  const authorRaw = data.author;
  const author: AuthorLite | null =
    authorRaw && typeof authorRaw === 'object'
      ? {
          displayName: typeof authorRaw.displayName === 'string' ? authorRaw.displayName : null,
          username: typeof authorRaw.username === 'string' ? authorRaw.username : null,
          avatarURL: typeof authorRaw.avatarURL === 'string' ? authorRaw.avatarURL : null,
        }
      : null;

  return {
    id: snapshot.id,
    uid: typeof data.uid === 'string' ? data.uid : null,
    text: typeof data.text === 'string' ? data.text : null,
    title: typeof data.title === 'string' ? data.title : null,
    media: media.length ? media : undefined,
    createdAt: data.createdAt ?? null,
    author,
    reposts: typeof data.reposts === 'number' ? data.reposts : null,
  };
};

const normalizeRecipeDoc = (snapshot: QueryDocumentSnapshot<DocumentData>): PublicRecipe => {
  const data = snapshot.data() ?? {};
  return {
    id: snapshot.id,
    title: typeof data.title === 'string' ? data.title : null,
    description: typeof data.description === 'string' ? data.description : null,
    ingredients: Array.isArray(data.ingredients) ? data.ingredients : undefined,
    createdAt: data.createdAt ?? null,
    gallery: data.gallery,
    images: data.images,
    media: data.media,
  };
};

const firstMediaUrl = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstMediaUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = ['url', 'src', 'downloadURL', 'href'];
    for (const key of keys) {
      const candidate = record[key];
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (trimmed) return trimmed;
      }
    }
  }
  return null;
};

const pickRecipeCover = (recipe: PublicRecipe): string | null => {
  const fromMedia = firstMediaUrl(recipe.media);
  if (fromMedia) return fromMedia;
  const fromGallery = firstMediaUrl(recipe.gallery);
  if (fromGallery) return fromGallery;
  const fromImages = firstMediaUrl(recipe.images);
  if (fromImages) return fromImages;
  return null;
};

export default function PublicProfilePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';

  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [recipes, setRecipes] = useState<PublicRecipe[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'posts' | 'recipes'>('recipes');

  useEffect(() => {
    let cancelled = false;
    async function resolveUid() {
      try {
        if (!slug) return;
        const usernameSnap = await getDoc(doc(db, 'usernames', String(slug)));
        if (cancelled) return;
        if (usernameSnap.exists()) {
          const data = usernameSnap.data() as { uid?: string } | undefined;
          setUid(data?.uid ? String(data.uid) : String(slug));
        } else {
          setUid(String(slug));
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Failed to resolve profile.';
        setErr(message);
      }
    }
    resolveUid();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getDoc(doc(db, 'usersPublic', uid))
      .then((snapshot) => {
        if (cancelled || !snapshot.exists()) return;
        const data = snapshot.data() as DocumentData;
        setProfile({
          displayName: typeof data.displayName === 'string' ? data.displayName : null,
          username: typeof data.username === 'string' ? data.username : null,
          avatarURL: typeof data.avatarURL === 'string' ? data.avatarURL : null,
        });
      })
      .catch((error: FirestoreError) => {
        if (!cancelled) setErr(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const qy = query(collection(db, 'posts'), where('uid', '==', uid), fsLimit(300));
    const stop = onSnapshot(
      qy,
      (snap) => {
        const list = snap.docs.map(normalizePostDoc);
        setPosts(list);
        const author = list[0]?.author;
        if (author) {
          setProfile((prev) => {
            if (prev) return prev;
            return {
              displayName: author.displayName ?? null,
              username: author.username ?? null,
              avatarURL: author.avatarURL ?? null,
            };
          });
        }
      },
      (error) => {
        setErr(error.message || 'Failed to load posts.');
      }
    );
    return () => stop();
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const qy = query(collection(db, 'recipes'), where('uid', '==', uid), fsLimit(300));
    const stop = onSnapshot(
      qy,
      (snap) => {
        const list = snap.docs.map(normalizeRecipeDoc);
        setRecipes(list);
      },
      (error) => {
        setErr(error.message || 'Failed to load recipes.');
      }
    );
    return () => stop();
  }, [uid]);

  const sortedPosts = useMemo(
    () => [...posts].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
    [posts]
  );
  const sortedRecipes = useMemo(
    () => [...recipes].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
    [recipes]
  );

  if (err) {
    return (
      <main className="wrap">
        <div className="card bad">
          <p>{err}</p>
        </div>
      </main>
    );
  }

  if (!slug) {
    return (
      <main className="wrap">
        <div className="card">
          <p className="muted">Loading…</p>
        </div>
      </main>
    );
  }

  const headingName =
    profile?.displayName ??
    (profile?.username ? `@${profile.username}` : slug);
  const secondaryName =
    profile?.username && profile.username !== headingName
      ? `@${profile.username}`
      : null;
  const avatarInitial = headingName ? headingName.charAt(0).toUpperCase() : 'U';

  return (
    <main className="wrap">
      <header className="head">
        <div className="who">
          {profile?.avatarURL ? (
            <Image
              className="avatar"
              src={profile.avatarURL}
              alt={headingName}
              width={72}
              height={72}
              unoptimized
            />
          ) : (
            <div className="avatar ph" aria-hidden="true">
              {avatarInitial}
            </div>
          )}
          <div className="names">
            <h1 className="title">{headingName}</h1>
            {secondaryName ? <p className="muted">{secondaryName}</p> : null}
          </div>
        </div>
        <Link href="/dashboard" className="btn">
          Explore
        </Link>
      </header>

      <nav className="tabs" role="tablist" aria-label="Profile content">
        <button
          role="tab"
          aria-selected={tab === 'recipes'}
          className={`tab ${tab === 'recipes' ? 'on' : ''}`}
          onClick={() => setTab('recipes')}
        >
          Recipes
        </button>
        <button
          role="tab"
          aria-selected={tab === 'posts'}
          className={`tab ${tab === 'posts' ? 'on' : ''}`}
          onClick={() => setTab('posts')}
        >
          Posts
        </button>
      </nav>

      {tab === 'recipes' && (
        <section className="section">
          {sortedRecipes.length === 0 ? (
            <p className="muted">No recipes yet.</p>
          ) : (
            <ul className="recipeGrid">
              {sortedRecipes.map((recipe) => {
                const cover = pickRecipeCover(recipe);
                return (
                  <li key={recipe.id} className="rc">
                    <Link
                      href={`/recipes/${recipe.id}`}
                      className="cardLink"
                      aria-label={`Open recipe ${recipe.title || ''}`}
                    >
                      <article className="recipeCard">
                        <div className="media">
                          {cover ? (
                            <Image
                              src={cover}
                              alt={recipe.title ?? 'Recipe cover'}
                              width={320}
                              height={220}
                              className="mediaImg"
                              unoptimized
                            />
                          ) : (
                            <div className="ph" aria-hidden="true">
                              <svg width="24" height="24" viewBox="0 0 24 24">
                                <path
                                  d="M4 5h16v14H4z M8 11a2 2 0 114 0 2 2 0 01-4 0zm10 6l-4.5-6-3.5 4.5L8 13l-4 4h14z"
                                  fill="currentColor"
                                />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="rcBody">
                          <h3 className="rcTitle">
                            {trim(recipe.title || 'Untitled recipe', 64)}
                          </h3>
                          {recipe.description ? (
                            <p className="rcDesc">{trim(recipe.description, 120)}</p>
                          ) : null}
                          <div className="rcMeta">
                            {Array.isArray(recipe.ingredients) && recipe.ingredients.length ? (
                              <span className="badge">
                                {recipe.ingredients.length} ingredients
                              </span>
                            ) : (
                              <span className="badge secondary">No ingredients</span>
                            )}
                            {recipe.createdAt ? (
                              <span className="muted">
                                {new Date(toMillis(recipe.createdAt)).toLocaleDateString()}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {tab === 'posts' && (
        <section className="section">
          {sortedPosts.length === 0 ? (
            <p className="muted">No posts yet.</p>
          ) : (
            <div className="feed">
              {sortedPosts.map((post) => {
                const cover = firstMediaUrl(post.media);
                return (
                  <div key={post.id} className="postRow">
                    <Link href={`/posts/${post.id}`} className="postRowLink">
                      <article className="postMini">
                        {cover ? (
                          <Image
                            className="thumb"
                            src={cover}
                            alt=""
                            width={80}
                            height={80}
                            unoptimized
                          />
                        ) : (
                          <div className="thumb ph" aria-hidden="true" />
                        )}
                        <div className="pmBody">
                          <div className="pmTitle">
                            {trim(post.text || post.title || 'Untitled post', 80)}
                          </div>
                          <div className="pmMeta">
                            <span className="muted">
                              {post.createdAt
                                ? new Date(toMillis(post.createdAt)).toLocaleString()
                                : ''}
                            </span>
                            {typeof post.reposts === 'number' && post.reposts > 0 ? (
                              <span className="badge">↻ {post.reposts}</span>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    </Link>
                  </div>
                );
              })}
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

.recipeGrid { list-style:none; margin:0; padding:0; display:grid; gap:14px; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
.cardLink{ text-decoration:none; color:inherit; display:block; }
.recipeCard{ background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 16px; overflow:hidden; transition: transform .08s ease, box-shadow .14s ease, border-color .14s ease, background .14s ease; }
.recipeCard:hover{ transform: translateY(-2px); box-shadow: 0 18px 36px rgba(0,0,0,.12); border-color: color-mix(in oklab, var(--primary) 28%, var(--card-border)); }
.media{ aspect-ratio: 16/11; background:#000; overflow:hidden; }
.mediaImg{ width:100%; height:100%; object-fit:cover; }
.ph{ width:100%; height:100%; display:grid; place-items:center; color: var(--muted); background: var(--bg2); }
.rcBody{ padding: 12px; display:grid; gap:6px; }
.rcTitle{ font-weight:900; letter-spacing:-.01em; }
.rcDesc{ color: var(--muted); font-size: 13px; line-height: 1.35; }
.rcMeta{ display:flex; align-items:center; justify-content:space-between; margin-top:2px; }
.badge{ font-size:12px; font-weight:800; padding: 2px 8px; border-radius:999px; background: color-mix(in oklab, var(--primary) 12%, var(--bg)); border:1px solid color-mix(in oklab, var(--primary) 35%, var(--border)); }
.badge.secondary{ background: color-mix(in oklab, var(--muted) 12%, var(--bg)); border-color: color-mix(in oklab, var(--muted) 35%, var(--border)); }

.feed{ display:grid; gap:10px; }
.postRowLink{ text-decoration:none; color:inherit; display:block; }
.postMini{ background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 16px; padding: 10px; display:grid; grid-template-columns: 80px 1fr; gap: 12px; align-items:center; }
.thumb{ width:80px; height:80px; border-radius:12px; object-fit:cover; border:1px solid var(--border); background:#000; }
.thumb.ph{ background: var(--bg2); }
.pmBody{ min-width:0; }
.pmTitle{ font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pmMeta{ display:flex; gap:10px; align-items:center; margin-top:2px; }

@media (max-width: 560px){
  .recipeGrid{ grid-template-columns: repeat(auto-fill, minmax(180px,1fr)); }
  .postMini{ grid-template-columns: 64px 1fr; }
  .thumb{ width:64px; height:64px; }
}
`;
