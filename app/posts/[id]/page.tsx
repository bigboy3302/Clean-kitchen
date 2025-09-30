// app/posts/[id]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  limit as fsLimit,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";

/* ---------- types (lightweight) ---------- */
type Author =
  | { username?: string | null; displayName?: string | null; avatarURL?: string | null }
  | null;

type MediaItem = { type: "image"; url: string };

type Post = {
  id: string;
  uid: string;
  title?: string | null;
  description?: string | null;
  text?: string | null;
  media?: { type: "image" | "video"; url: string }[] | null;
  createdAt?: any;
  author?: Author;
};

type CommentDoc = {
  id: string;
  uid: string;
  text?: string | null;
  media?: MediaItem[];                 // <-- images/GIFs
  createdAt?: any;
  author?: Author;
  replyCount?: number;                 // denormalized
  repostCount?: number;                // denormalized
  popScore?: number;                   // = repostCount*3 + replyCount
};

type ReplyDoc = {
  id: string;
  uid: string;
  text?: string | null;
  createdAt?: any;
  author?: Author;
};

/* ---------- helpers ---------- */
async function getMyAuthor(uid: string) {
  try {
    const uref = doc(db, "users", uid);
    const usnap = await getDoc(uref);
    if (usnap.exists()) {
      const u: any = usnap.data() || {};
      return {
        displayName: u.firstName ? `${u.firstName}${u.lastName ? " " + u.lastName : ""}` : u.displayName ?? null,
        username: u.username ?? null,
        avatarURL: u.photoURL ?? null,
      };
    }
  } catch {}
  return { displayName: null, username: null, avatarURL: null };
}

function tsToDate(ts: any): Date | undefined {
  if (!ts) return;
  if (typeof ts?.toDate === "function") return ts.toDate();
  if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000);
  return;
}

async function uploadImage(storagePath: string, file: File) {
  const sref = ref(storage, storagePath);
  const task = uploadBytesResumable(sref, file);
  await new Promise<void>((res, rej) => {
    task.on("state_changed", undefined, rej, () => res());
  });
  const url = await getDownloadURL(sref);
  return url;
}

/* ===================================================================== */

export default function PostThreadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [me, setMe] = useState<any>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, ReplyDoc[]>>({});

  // sort state
  const [sort, setSort] = useState<"top" | "latest">("top");
  const [remoteTopOK, setRemoteTopOK] = useState(true); // if index missing, fallback client sort

  // comment composer (text + images/gifs)
  const [cText, setCText] = useState("");
  const [cFiles, setCFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => setMe(u || null));
    return () => stop();
  }, []);

  // load post
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "posts", String(id)));
        if (!snap.exists()) {
          setLoading(false);
          router.replace("/dashboard");
          return;
        }
        setPost({ id: snap.id, ...(snap.data() as any) });
        setLoading(false);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load post.");
        setLoading(false);
      }
    })();
  }, [id, router]);

  // subscribe comments
  useEffect(() => {
    if (!id) return;
    let stop = () => {};
    try {
      if (sort === "top" && remoteTopOK) {
        // Try remote ordering by popScore desc (then createdAt desc for stability)
        const qTop = query(
          collection(db, "posts", String(id), "comments"),
          orderBy("popScore", "desc"),
          orderBy("createdAt", "desc"),
          fsLimit(100)
        );
        stop = onSnapshot(
          qTop,
          (snap) => {
            setComments(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
            );
            setRemoteTopOK(true);
          },
          // If index missing, fallback to latest and do client-side "top"
          () => {
            setRemoteTopOK(false);
          }
        );
      } else {
        const qLatest = query(
          collection(db, "posts", String(id), "comments"),
          orderBy("createdAt", "desc"),
          fsLimit(100)
        );
        stop = onSnapshot(qLatest, (snap) =>
          setComments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })))
        );
      }
    } catch {
      setRemoteTopOK(false);
    }
    return () => stop();
  }, [id, sort, remoteTopOK]);

  // subscribe replies of an open comment
  useEffect(() => {
    if (!id || !open) return;
    const stop = onSnapshot(
      query(
        collection(db, "posts", String(id), "comments", open, "replies"),
        orderBy("createdAt", "asc")
      ),
      (snap) => {
        setReplies((prev) => ({
          ...prev,
          [open]: snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
        }));
      }
    );
    return () => stop();
  }, [id, open]);

  const authorName = useMemo(() => {
    return (
      post?.author?.username ||
      post?.author?.displayName ||
      (post?.uid ? post.uid.slice(0, 6) : "Unknown")
    );
  }, [post]);

  const created = useMemo(() => tsToDate(post?.createdAt), [post?.createdAt]);

  // client-side top sort fallback
  const sortedComments = useMemo(() => {
    if (sort === "latest" || remoteTopOK) return comments;
    const list = [...comments];
    list.sort((a, b) => {
      const ap = (a.repostCount || 0) * 3 + (a.replyCount || 0);
      const bp = (b.repostCount || 0) * 3 + (b.replyCount || 0);
      if (bp !== ap) return bp - ap;
      const ad = tsToDate(a.createdAt)?.getTime() || 0;
      const bd = tsToDate(b.createdAt)?.getTime() || 0;
      return bd - ad;
    });
    return list;
  }, [comments, sort, remoteTopOK]);

  /* -------------------- actions -------------------- */

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || [])
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 4);
    setCFiles(list);
  }

  async function addComment() {
    if (!me || !id) return;
    const t = cText.trim();
    if (!t && cFiles.length === 0) return;

    setBusy(true);
    try {
      const author = await getMyAuthor(me.uid);

      // create comment document first
      const cref = await addDoc(collection(db, "posts", String(id), "comments"), {
        uid: me.uid,
        text: t || null,
        media: [],
        replyCount: 0,
        repostCount: 0,
        popScore: 0,
        createdAt: serverTimestamp(),
        author,
      });

      // upload images/GIFs
      if (cFiles.length) {
        const uploaded: MediaItem[] = [];
        for (const file of cFiles) {
          const safeName = `${Date.now()}-${file.name}`.replace(/\s+/g, "_");
          const path = `posts/${id}/comments/${cref.id}/${safeName}`;
          const url = await uploadImage(path, file);
          uploaded.push({ type: "image", url });
        }
        await updateDoc(cref, { media: uploaded });
      }

      // reset
      setCText("");
      setCFiles([]);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      alert(e?.message || "Failed to post comment.");
    } finally {
      setBusy(false);
    }
  }

  async function addReply(cid: string, text: string) {
    if (!me || !id) return;
    const t = text.trim();
    if (!t) return;

    const author = await getMyAuthor(me.uid);

    // add reply
    await addDoc(collection(db, "posts", String(id), "comments", cid, "replies"), {
      uid: me.uid,
      text: t,
      createdAt: serverTimestamp(),
      author,
    });

    // bump replyCount and popScore (+1)
    await updateDoc(doc(db, "posts", String(id), "comments", cid), {
      replyCount: increment(1),
      popScore: increment(1),
    }).catch(() => {});
  }

  async function deleteComment(cid: string) {
    if (!me || !id) return;
    await deleteDoc(doc(db, "posts", String(id), "comments", cid));
  }

  async function toggleCommentRepost(cid: string, hasReposted: boolean) {
    if (!me || !id) return;
    const rRef = doc(db, "posts", String(id), "comments", cid, "reposts", me.uid);
    if (hasReposted) {
      // remove
      await deleteDoc(rRef);
      await updateDoc(doc(db, "posts", String(id), "comments", cid), {
        repostCount: increment(-1),
        popScore: increment(-3),
      }).catch(() => {});
    } else {
      // add
      await setDoc(rRef, { uid: me.uid, createdAt: serverTimestamp() });
      await updateDoc(doc(db, "posts", String(id), "comments", cid), {
        repostCount: increment(1),
        popScore: increment(3),
      }).catch(() => {});
    }
  }

  /* -------------------- UI -------------------- */

  if (loading)
    return (
      <main className="wrap">
        <div className="sk" />
      </main>
    );

  if (err) return <main className="wrap"><div className="card bad">{err}</div></main>;
  if (!post) return <main className="wrap"><div className="card">Post not found.</div></main>;

  return (
    <main className="wrap">
      <article className="thread">
        {/* post header */}
        <header className="head">
          <div className="who">
            {post.author?.avatarURL ? (
              <img className="avatar" src={post.author.avatarURL} alt="" />
            ) : (
              <div className="avatar ph">{(authorName?.[0] || "U").toUpperCase()}</div>
            )}
            <div className="names">
              <div className="name">{authorName}</div>
              {created ? (
                <div className="time" title={created.toLocaleString()}>
                  {created.toLocaleDateString()} · {created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              ) : null}
            </div>
          </div>
          <div className="actions">
            <Link className="btn-ghost" href="/dashboard">Back</Link>
          </div>
        </header>

        {/* post body */}
        {post.title ? <h1 className="title">{post.title}</h1> : null}
        {post.description ? <p className="desc">{post.description}</p> : null}

        {Array.isArray(post.media) && post.media.length > 0 ? (
          <div className={`media ${post.media.length > 1 ? "multi" : ""}`}>
            <div className="rail">
              {post.media.map((m, i) => (
                <div className="cell" key={i}>
                  {m.type === "video" ? <video src={m.url} controls playsInline preload="metadata" />
                  : <img src={m.url} alt="" />}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {post.text ? <p className="caption">{post.text}</p> : null}

        {/* composer */}
        <section className="compose">
          <div className="row">
            <textarea
              rows={3}
              placeholder={me ? "Write a comment…" : "Sign in to comment"}
              value={cText}
              disabled={!me}
              onChange={(e) => setCText(e.target.value)}
            />
            <div className="ctrls">
              <label className="fileBtn">
                + GIF/IMG
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onPick}
                  hidden
                />
              </label>
              <button className="btn-primary" disabled={!me || busy || (!cText.trim() && cFiles.length === 0)} onClick={addComment}>
                {busy ? "Posting…" : "Post"}
              </button>
            </div>
          </div>

          {cFiles.length > 0 && (
            <div className={`preview cols-${Math.min(cFiles.length, 2)}`}>
              {cFiles.map((f, i) => (
                <div key={i} className="pCell">
                  <img src={URL.createObjectURL(f)} alt="" />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* comments */}
        <section className="comments">
          <div className="toolbar">
            <h2 className="h2">Comments</h2>
            <div className="tabs" role="tablist" aria-label="Sort comments">
              <button
                className={`tab ${sort === "top" ? "on" : ""}`}
                onClick={() => setSort("top")}
                role="tab"
                aria-selected={sort === "top"}
              >
                Top
              </button>
              <button
                className={`tab ${sort === "latest" ? "on" : ""}`}
                onClick={() => setSort("latest")}
                role="tab"
                aria-selected={sort === "latest"}
              >
                Latest
              </button>
            </div>
          </div>

          {sortedComments.length === 0 ? (
            <p className="muted">No comments yet.</p>
          ) : (
            <ul className="list">
              {sortedComments.map((c) => (
                <CommentRow
                  key={c.id}
                  postId={post.id}
                  me={me}
                  comment={c}
                  isOwner={!!me && (me.uid === c.uid || me.uid === post.uid)}
                  open={open === c.id}
                  onToggleOpen={() => setOpen(open === c.id ? null : c.id)}
                  replies={replies[c.id] || []}
                  onAddReply={addReply}
                  onDelete={() => deleteComment(c.id)}
                  onToggleRepost={toggleCommentRepost}
                />
              ))}
            </ul>
          )}
        </section>
      </article>

      <style jsx>{`
        .wrap { max-width: 860px; margin: 0 auto; padding: 16px; color: var(--text); }
        :root { --border:#1f2937; --card:#0f1320; --bg:#0b0c10; --text:#e7ecf3; --muted:#a3adbb; --primary:#6d5dfc; }
        @media (prefers-color-scheme: light) {
          :root { --border:#e5e7eb; --card:#fff; --bg:#f6f7fb; --text:#0f172a; --muted:#64748b; --primary:#4f46e5; }
        }

        .thread{ background:var(--card); border:1px solid var(--border); border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,.25); padding:14px; }
        .head{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .who{ display:flex; gap:10px; align-items:center; min-width:0; }
        .avatar{ width:44px; height:44px; border-radius:999px; border:1px solid var(--border); object-fit:cover; background:#000; }
        .avatar.ph{ display:grid; place-items:center; background:#0f172a; color:#fff; font-weight:900; }
        .names{ display:grid; line-height:1.1 }
        .name{ font-weight:900 }
        .time{ font-size:12px; color:var(--muted) }
        .btn-ghost{ border:1px solid var(--border); background:transparent; color:var(--text); border-radius:12px; padding:6px 10px; text-decoration:none; }

        .title{ margin: 10px 0 6px; font-size: 22px; font-weight: 900; }
        .desc { margin: 0 0 8px; color: var(--muted); }

        .media{ margin: 10px 0; }
        .rail{ display:flex; gap:6px; overflow:auto; -webkit-overflow-scrolling:touch; scroll-snap-type:x mandatory; padding: 0 2px 6px; }
        .cell{ flex: 0 0 80%; max-width:80%; height: 300px; border:1px solid var(--border); border-radius:12px; overflow:hidden; background:#000; scroll-snap-align:center; }
        @media (max-width:640px){ .cell{ height:220px; } }
        .cell img, .cell video{ width:100%; height:100%; object-fit:cover; display:block; }

        .caption{ margin: 6px 2px 2px; white-space:pre-wrap; }

        .compose{ margin-top: 12px; display:grid; gap:8px; }
        .row{ display:grid; grid-template-columns: 1fr auto; gap:8px; align-items:end; }
        textarea{ border:1px solid var(--border); border-radius:12px; padding:10px 12px; background:transparent; color:var(--text); resize:vertical; min-height:44px; }
        .ctrls{ display:flex; gap:8px; }
        .fileBtn{ display:inline-grid; place-items:center; padding:10px 12px; border:1px dashed var(--border); border-radius:12px; cursor:pointer; color:var(--muted); }
        .btn-primary{ border-radius:12px; border:1px solid var(--primary); background:var(--primary); color:#fff; padding:10px 14px; font-weight:800; cursor:pointer; }
        .preview{ display:grid; gap:8px; }
        .preview.cols-1{ grid-template-columns:1fr; }
        .preview.cols-2{ grid-template-columns:1fr 1fr; }
        .pCell{ border:1px solid var(--border); border-radius:12px; overflow:hidden; background:#000; height:160px; }
        .pCell img{ width:100%; height:100%; object-fit:cover; display:block; }

        .comments{ margin-top: 16px; }
        .toolbar{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .h2{ margin:0; font-size:16px; font-weight:900; }
        .tabs{ display:flex; gap:6px; }
        .tab{ border:1px solid var(--border); background:transparent; color:var(--text); padding:6px 10px; border-radius:999px; cursor:pointer; }
        .tab.on{ background: color-mix(in oklab, var(--primary) 12%, transparent); border-color: color-mix(in oklab, var(--primary) 40%, var(--border)); }

        .list{ list-style:none; margin:0; padding:0; display:grid; gap:10px; }

        .card{ background:var(--card); border:1px solid var(--border); border-radius:12px; padding:12px; }
        .bad{ background: color-mix(in oklab, #ef4444 12%, var(--card)); border-color: color-mix(in oklab, #ef4444 35%, var(--border)); color: #ffe; }
        .sk{ height:200px; border-radius:16px; background: linear-gradient(90deg, transparent, rgba(255,255,255,.08), transparent); border:1px solid var(--border); }
        .muted{ color:var(--muted); }
      `}</style>
    </main>
  );
}

/* ===================== comment row ===================== */

function CommentRow({
  postId,
  me,
  comment,
  isOwner,
  open,
  onToggleOpen,
  replies,
  onAddReply,
  onDelete,
  onToggleRepost,
}: {
  postId: string;
  me: any;
  comment: CommentDoc;
  isOwner: boolean;
  open: boolean;
  onToggleOpen: () => void;
  replies: ReplyDoc[];
  onAddReply: (cid: string, text: string) => Promise<void>;
  onDelete: () => Promise<void> | void;
  onToggleRepost: (cid: string, hasReposted: boolean) => Promise<void>;
}) {
  const [hasReposted, setHasReposted] = useState(false);
  const [draft, setDraft] = useState("");

  // live sub for this comment's reposts to compute hasReposted quickly
  useEffect(() => {
    if (!me) return;
    const rRef = doc(db, "posts", postId, "comments", comment.id, "reposts", me.uid);
    let stop = () => {};
    getDoc(rRef).then((s) => setHasReposted(s.exists()));
    // Also watch the single doc for live toggle state
    stop = onSnapshot(rRef, (s) => setHasReposted(s.exists()));
    return () => stop();
  }, [postId, comment.id, me]);

  const when = tsToDate(comment.createdAt);
  const cName =
    comment.author?.displayName ||
    comment.author?.username ||
    (comment.uid ? `@${comment.uid.slice(0, 6)}` : "user");

  const media = Array.isArray(comment.media) ? comment.media : [];

  return (
    <li className="row">
      <div className="top">
        <span className="name">{cName}</span>
        <span className="dot">•</span>
        <span className="time">{when ? when.toLocaleString() : ""}</span>

        <div className="sp" />

        <button
          className={`chip ${hasReposted ? "on" : ""}`}
          onClick={async () => {
            await onToggleRepost(comment.id, hasReposted);
          }}
          disabled={!me}
          title={hasReposted ? "Undo repost" : "Repost"}
        >
          ↻ Repost {comment.repostCount ? <span className="count">{comment.repostCount}</span> : null}
        </button>

        <button className="chip" onClick={onToggleOpen} aria-expanded={open}>
          {open ? "Hide replies" : `View replies (${comment.replyCount || 0})`}
        </button>

        {isOwner ? (
          <button className="chip danger" onClick={onDelete}>Delete</button>
        ) : null}
      </div>

      <div className="bubble">
        {comment.text ? <p className="text">{comment.text}</p> : null}

        {media.length > 0 && (
          <div className={`thumbs t-${Math.min(media.length, 2)}`}>
            {media.map((m, i) => (
              <div key={i} className="tCell">
                <img src={m.url} alt="" />
              </div>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div className="replies">
          <ul className="rlist">
            {replies.map((r) => {
              const rName =
                r.author?.displayName ||
                r.author?.username ||
                (r.uid ? `@${r.uid.slice(0, 6)}` : "user");
              const rWhen = tsToDate(r.createdAt);
              return (
                <li key={r.id} className="ritem">
                  <div className="rhead">
                    <span className="rname">{rName}</span>
                    <span className="dot">•</span>
                    <span className="rtime">{rWhen ? rWhen.toLocaleString() : ""}</span>
                  </div>
                  <div className="rbubble">
                    <span className="rtext">{r.text}</span>
                  </div>
                </li>
              );
            })}
          </ul>

          <form
            className="rform"
            onSubmit={async (e) => {
              e.preventDefault();
              const t = draft.trim();
              if (!t) return;
              await onAddReply(comment.id, t);
              setDraft("");
            }}
          >
            <input
              type="text"
              placeholder={me ? "Write a reply…" : "Sign in to reply"}
              disabled={!me}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button className="btn-secondary" disabled={!me || !draft.trim()}>
              Reply
            </button>
          </form>
        </div>
      )}

      <style jsx>{`
        .row { border-top: 1px dashed var(--border); padding-top: 10px; display: grid; gap: 8px; }
        .top { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:13px; color: var(--muted); }
        .sp { flex: 1; }
        .name { font-weight:800; color: var(--text); }
        .time { white-space: nowrap; }
        .dot { opacity:.7; }

        .chip {
          background: transparent;
          color: var(--text);
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 4px 10px;
          font-weight: 800;
          cursor: pointer;
        }
        .chip.on { background: color-mix(in oklab, var(--primary) 12%, transparent); border-color: color-mix(in oklab, var(--primary) 35%, var(--border)); }
        .chip .count { margin-left: 6px; opacity:.85; }
        .chip.danger { color:#e11d48; }

        .bubble { background: transparent; border: 1px solid var(--border); border-radius: 12px; padding: 8px 10px; }
        .text { margin: 0 0 8px; white-space: pre-wrap; overflow-wrap: anywhere; }
        .thumbs { display:grid; gap:8px; }
        .thumbs.t-1 { grid-template-columns: 1fr; }
        .thumbs.t-2 { grid-template-columns: 1fr 1fr; }
        .tCell { border:1px solid var(--border); border-radius:10px; overflow:hidden; background:#000; height:160px; }
        .tCell img { width:100%; height:100%; object-fit:cover; display:block; }

        .replies { display:grid; gap:8px; }
        .rlist { list-style:none; padding:0; margin:0; display:grid; gap:6px; }
        .rhead { display:flex; align-items:center; gap:8px; font-size:12px; color: var(--muted); }
        .rname { font-weight:800; color: var(--text); }
        .rbubble { background: transparent; border: 1px solid var(--border); border-radius: 10px; padding: 6px 8px; }
        .rtext { color: var(--text); }

        .rform { display:grid; grid-template-columns: 1fr auto; gap:6px; }
        .rform input { border: 1px solid var(--border); border-radius: 10px; padding: 8px; background: transparent; color: var(--text); }
        .btn-secondary { border-radius: 10px; border: 1px solid var(--border); background: transparent; color: var(--text); padding: 8px 12px; font-weight: 800; cursor: pointer; }
        .btn-secondary:disabled { opacity:.6; cursor:not-allowed; }
      `}</style>
    </li>
  );
}
