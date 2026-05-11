"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getAggregateFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  sum,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebas1e";
import { isAdminUid } from "@/lib/admin";
import {
  banUser,
  clearModeration,
  deleteAllPostsByUser,
  deleteComment,
  deletePostAdmin,
  deleteRecipeAdmin,
  timeoutUser,
} from "@/lib/adminModeration";

/* ─── types ─────────────────────────────────────────────────────────────── */

type Tab = "overview" | "users" | "reports" | "content" | "moderation";

type Stats = { users: number; posts: number; recipes: number; bans: number };

type UserRow = {
  uid: string;
  displayName?: string | null;
  username?: string | null;
  avatarURL?: string | null;
  banned?: boolean;
  timedOut?: boolean;
};

type ReportRow = {
  id: string;
  uid?: string | null;
  postId?: string | null;
  reason?: string | null;
  createdAt?: unknown;
  postOwnerUid?: string | null;
};

type PostItem = {
  id: string;
  uid?: string | null;
  text?: string | null;
  author?: { username?: string | null; displayName?: string | null } | null;
};

type RecipeItem = {
  id: string;
  uid?: string | null;
  title?: string | null;
  author?: { uid?: string | null; name?: string | null } | null;
};

type ModerationStatus = {
  active: boolean;
  type?: string;
  reason?: string;
  until?: { seconds: number } | null;
};

const PAGE_SIZE = 20;

/* ─── helpers ────────────────────────────────────────────────────────────── */

function timeAgo(val: unknown): string {
  if (!val) return "—";
  let ms = 0;
  if (typeof val === "object" && val !== null && "seconds" in val) {
    ms = (val as { seconds: number }).seconds * 1000;
  } else if (val instanceof Date) {
    ms = val.getTime();
  }
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function StatCard({ label, value, color }: { label: string; value: number | "…"; color: string }) {
  return (
    <div className={`statCard statCard--${color}`}>
      <div className="statValue">{value}</div>
      <div className="statLabel">{label}</div>
      <style jsx>{`
        .statCard {
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 18px 20px;
          background: var(--card-bg);
          box-shadow: 0 4px 18px rgba(0,0,0,.06);
          display: grid;
          gap: 4px;
        }
        .statCard--blue  { border-top: 3px solid #3b82f6; }
        .statCard--green { border-top: 3px solid #22c55e; }
        .statCard--amber { border-top: 3px solid #f59e0b; }
        .statCard--red   { border-top: 3px solid #ef4444; }
        .statValue { font-size: 32px; font-weight: 900; color: var(--text); line-height: 1; }
        .statLabel { font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
      `}</style>
    </div>
  );
}

/* ─── main page ──────────────────────────────────────────────────────────── */

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  /* ── stats ── */
  const [stats, setStats] = useState<Stats | null>(null);

  /* ── moderation form ── */
  const [modUid, setModUid] = useState("");
  const [modReason, setModReason] = useState("");
  const [modDays, setModDays] = useState("7");
  const [bulkUid, setBulkUid] = useState("");

  /* ── ban status lookup ── */
  const [lookupUid, setLookupUid] = useState("");
  const [lookupResult, setLookupResult] = useState<ModerationStatus | null | "none">(null);
  const [lookupBusy, setLookupBusy] = useState(false);

  /* ── user search ── */
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<UserRow[]>([]);
  const [userSearchBusy, setUserSearchBusy] = useState(false);

  /* ── user list ── */
  const [userList, setUserList] = useState<UserRow[]>([]);
  const [userListBusy, setUserListBusy] = useState(false);
  const userListCursor = useRef<QueryDocumentSnapshot | null>(null);
  const [userListHasMore, setUserListHasMore] = useState(true);

  /* ── reports ── */
  const [reports, setReports] = useState<ReportRow[]>([]);

  /* ── content ── */
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [comments, setComments] = useState<{ id: string; uid?: string | null; text?: string | null }[]>([]);

  /* ─── auth guard ─── */
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      const ok = isAdminUid(user?.uid);
      setIsAdmin(ok);
      setReady(true);
      if (!ok) router.replace("/dashboard");
    });
  }, [router]);

  /* ─── load stats ─── */
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const [usersSnap, postsSnap, recipesSnap, bansSnap] = await Promise.all([
          getAggregateFromServer(collection(db, "usersPublic"), { count: sum("__name__") }).catch(() => null),
          getAggregateFromServer(collection(db, "posts"), { count: sum("__name__") }).catch(() => null),
          getAggregateFromServer(collection(db, "recipes"), { count: sum("__name__") }).catch(() => null),
          getDocs(query(collection(db, "userModeration"), where("active", "==", true), where("type", "==", "ban"))),
        ]);
        // getAggregateFromServer with sum("__name__") doesn't work — use getDocs count instead
        const [uCount, pCount, rCount] = await Promise.all([
          getDocs(query(collection(db, "usersPublic"), limit(1000))).then(s => s.size),
          getDocs(query(collection(db, "posts"), limit(1000))).then(s => s.size),
          getDocs(query(collection(db, "recipes"), limit(1000))).then(s => s.size),
        ]);
        void usersSnap; void postsSnap; void recipesSnap;
        setStats({ users: uCount, posts: pCount, recipes: rCount, bans: bansSnap.size });
      } catch {
        setStats({ users: 0, posts: 0, recipes: 0, bans: 0 });
      }
    })();
  }, [isAdmin]);

  /* ─── load reports ─── */
  useEffect(() => {
    if (!isAdmin || tab !== "reports") return;
    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(50));
    return onSnapshot(q, (snap) => {
      setReports(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ReportRow, "id">) })));
    });
  }, [isAdmin, tab]);

  /* ─── load posts + recipes ─── */
  useEffect(() => {
    if (!isAdmin || tab !== "content") return;
    const stopPosts = onSnapshot(
      query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(40)),
      (s) => setPosts(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PostItem, "id">) })))
    );
    const stopRecipes = onSnapshot(
      query(collection(db, "recipes"), orderBy("createdAt", "desc"), limit(40)),
      (s) => setRecipes(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RecipeItem, "id">) })))
    );
    return () => { stopPosts(); stopRecipes(); };
  }, [isAdmin, tab]);

  /* ─── load comments ─── */
  useEffect(() => {
    if (!selectedPostId || !isAdmin) { setComments([]); return; }
    return onSnapshot(
      query(collection(db, "posts", selectedPostId, "comments"), orderBy("createdAt", "desc"), limit(50)),
      (s) => setComments(s.docs.map((d) => ({ id: d.id, ...(d.data() as { uid?: string; text?: string }) })))
    );
  }, [selectedPostId, isAdmin]);

  /* ─── load initial user list ─── */
  useEffect(() => {
    if (!isAdmin || tab !== "users") return;
    loadUserPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, tab]);

  /* ─── helpers ─── */

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    try {
      const result = await fn();
      showToast(typeof result === "string" ? result : "Done.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Action failed.", false);
    } finally {
      setBusy(null);
    }
  }

  async function loadUserPage(reset = false) {
    setUserListBusy(true);
    try {
      const base = query(collection(db, "usersPublic"), orderBy("username"), limit(PAGE_SIZE));
      const q = reset || !userListCursor.current ? base : query(base, startAfter(userListCursor.current));
      const snap = await getDocs(q);

      const rows: UserRow[] = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data() as UserRow;
          let banned = false; let timedOut = false;
          try {
            const mod = await getDoc(doc(db, "userModeration", d.id));
            if (mod.exists()) {
              const m = mod.data() as ModerationStatus;
              if (m.active && m.type === "ban") banned = true;
              if (m.active && m.type === "timeout") timedOut = true;
            }
          } catch { /* ignore */ }
          return { ...data, uid: d.id, banned, timedOut };
        })
      );

      userListCursor.current = snap.docs[snap.docs.length - 1] ?? null;
      setUserListHasMore(snap.size === PAGE_SIZE);
      setUserList((prev) => reset ? rows : [...prev, ...rows]);
    } finally {
      setUserListBusy(false);
    }
  }

  async function searchUsers() {
    if (!userQuery.trim()) return;
    setUserSearchBusy(true);
    try {
      const term = userQuery.trim().toLowerCase();
      const snap = await getDocs(
        query(collection(db, "usersPublic"),
          where("username", ">=", term),
          where("username", "<=", term + ""),
          limit(15))
      );
      const rows: UserRow[] = snap.docs.map((d) => ({ ...(d.data() as UserRow), uid: d.id }));
      setUserResults(rows);
    } finally {
      setUserSearchBusy(false);
    }
  }

  async function lookupBanStatus() {
    if (!lookupUid.trim()) return;
    setLookupBusy(true);
    setLookupResult(null);
    try {
      const snap = await getDoc(doc(db, "userModeration", lookupUid.trim()));
      if (!snap.exists()) { setLookupResult("none"); return; }
      setLookupResult(snap.data() as ModerationStatus);
    } finally {
      setLookupBusy(false);
    }
  }

  const canMod = modUid.trim().length > 5;

  async function deleteUserAccount(targetUid: string) {
    if (!confirm(`Permanently delete account ${targetUid.slice(0, 12)}…?\n\nDeletes their Firebase Auth account and profile. Posts must be removed separately. Cannot be undone.`)) return;
    setBusy("del-acct");
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ targetUid }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to delete user");
      showToast(`Account ${targetUid.slice(0, 10)}… deleted.`);
      setModUid("");
      loadUserPage(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to delete user.", false);
    } finally {
      setBusy(null);
    }
  }

  if (!ready || !isAdmin) return null;

  /* ─── render ─── */
  return (
    <main className="adminWrap">
      {toast && (
        <div className={`toast ${toast.ok ? "toast--ok" : "toast--err"}`}>{toast.msg}</div>
      )}

      <div className="adminHeader">
        <div>
          <h1 className="adminTitle">Admin Panel</h1>
          <p className="adminSub">Clean Kitchen — internal tools</p>
        </div>
      </div>

      {/* stats */}
      <div className="statsRow">
        <StatCard label="Total users"   value={stats?.users   ?? "…"} color="blue"  />
        <StatCard label="Total posts"   value={stats?.posts   ?? "…"} color="green" />
        <StatCard label="Total recipes" value={stats?.recipes ?? "…"} color="amber" />
        <StatCard label="Active bans"   value={stats?.bans    ?? "…"} color="red"   />
      </div>

      {/* tabs */}
      <div className="tabs" role="tablist">
        {(["overview","users","reports","content","moderation"] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tabBtn ${tab === t ? "tabBtn--active" : ""}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <section className="card">
          <h2 className="cardTitle">Quick actions</h2>
          <div className="quickGrid">
            <button className="quickBtn" onClick={() => setTab("users")}>👤 Manage users</button>
            <button className="quickBtn" onClick={() => setTab("reports")}>🚩 View reports</button>
            <button className="quickBtn" onClick={() => setTab("content")}>📝 Moderate content</button>
            <button className="quickBtn" onClick={() => setTab("moderation")}>🔨 Ban / timeout</button>
          </div>
        </section>
      )}

      {/* ── USERS ── */}
      {tab === "users" && (
        <>
          {/* search */}
          <section className="card">
            <h2 className="cardTitle">Search users</h2>
            <div className="searchRow">
              <input
                className="input"
                placeholder="Search by username…"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchUsers()}
              />
              <button className="btn btn--primary" onClick={searchUsers} disabled={userSearchBusy}>
                {userSearchBusy ? "Searching…" : "Search"}
              </button>
            </div>
            {userResults.length > 0 && (
              <div className="tableWrap">
                <table className="table">
                  <thead><tr><th>Username</th><th>Display name</th><th>UID</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {userResults.map((u) => (
                      <tr key={u.uid}>
                        <td>@{u.username || "—"}</td>
                        <td>{u.displayName || "—"}</td>
                        <td><code className="code">{u.uid}</code></td>
                        <td>
                          {u.banned ? <span className="badge badge--red">Banned</span>
                          : u.timedOut ? <span className="badge badge--amber">Timed out</span>
                          : <span className="badge badge--green">Active</span>}
                        </td>
                        <td>
                          <button className="btn btn--sm btn--danger" onClick={() => run(`ban-${u.uid}`, () => banUser(u.uid, "Banned via admin panel"))}>Ban</button>
                          <button className="btn btn--sm btn--ghost" onClick={() => { setModUid(u.uid); setTab("moderation"); }}>Moderate</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ban status lookup */}
          <section className="card">
            <h2 className="cardTitle">Ban status lookup</h2>
            <div className="searchRow">
              <input className="input" placeholder="User UID…" value={lookupUid} onChange={(e) => setLookupUid(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookupBanStatus()} />
              <button className="btn btn--primary" onClick={lookupBanStatus} disabled={lookupBusy}>{lookupBusy ? "Looking up…" : "Check"}</button>
            </div>
            {lookupResult === "none" && <p className="muted small">No moderation record found — user is in good standing.</p>}
            {lookupResult && lookupResult !== "none" && (
              <div className={`modResult ${lookupResult.active ? "modResult--warn" : "modResult--ok"}`}>
                <strong>{lookupResult.active ? (lookupResult.type === "ban" ? "🚫 Banned" : "⏳ Timed out") : "✅ Clear"}</strong>
                {lookupResult.reason && <span> — {lookupResult.reason}</span>}
                {lookupResult.until && (
                  <span> until {new Date(lookupResult.until.seconds * 1000).toLocaleDateString()}</span>
                )}
              </div>
            )}
          </section>

          {/* user list */}
          <section className="card">
            <h2 className="cardTitle">All users</h2>
            <div className="tableWrap">
              <table className="table">
                <thead><tr><th>Username</th><th>Display name</th><th>UID</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {userList.map((u) => (
                    <tr key={u.uid}>
                      <td>@{u.username || "—"}</td>
                      <td>{u.displayName || "—"}</td>
                      <td><code className="code">{u.uid}</code></td>
                      <td>
                        {u.banned ? <span className="badge badge--red">Banned</span>
                        : u.timedOut ? <span className="badge badge--amber">Timed out</span>
                        : <span className="badge badge--green">Active</span>}
                      </td>
                      <td>
                        <button className="btn btn--sm btn--ghost" onClick={() => { setModUid(u.uid); setTab("moderation"); }}>Moderate</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {userListBusy && <p className="muted small" style={{ marginTop: 8 }}>Loading…</p>}
            {userListHasMore && !userListBusy && (
              <button className="btn btn--secondary" style={{ marginTop: 12 }} onClick={() => loadUserPage(false)}>Load more</button>
            )}
          </section>
        </>
      )}

      {/* ── REPORTS ── */}
      {tab === "reports" && (
        <section className="card">
          <h2 className="cardTitle">Reports queue <span className="badge badge--red">{reports.length}</span></h2>
          {reports.length === 0 ? (
            <p className="muted small">No reports found.</p>
          ) : (
            <div className="tableWrap">
              <table className="table">
                <thead><tr><th>Reporter UID</th><th>Post ID</th><th>Reason</th><th>Time</th><th>Actions</th></tr></thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td><code className="code">{r.uid?.slice(0, 10)}…</code></td>
                      <td><code className="code">{r.postId?.slice(0, 10)}…</code></td>
                      <td className="reasonCell">{r.reason || "—"}</td>
                      <td className="muted small">{timeAgo(r.createdAt)}</td>
                      <td>
                        {r.postId && (
                          <button className="btn btn--sm btn--danger" disabled={!!busy} onClick={() => run(`del-post-${r.postId}`, () => deletePostAdmin(r.postId!))}>
                            Delete post
                          </button>
                        )}
                        {r.postOwnerUid && (
                          <button className="btn btn--sm btn--ghost" onClick={() => { setModUid(r.postOwnerUid!); setTab("moderation"); }}>
                            Ban poster
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── CONTENT ── */}
      {tab === "content" && (
        <>
          <section className="card">
            <h2 className="cardTitle">Posts <span className="muted small">({posts.length} loaded)</span></h2>
            <div className="tableWrap">
              <table className="table">
                <thead><tr><th>Author</th><th>Preview</th><th>ID</th><th>Actions</th></tr></thead>
                <tbody>
                  {posts.map((p) => (
                    <tr key={p.id}>
                      <td>{p.author?.username || p.author?.displayName || <code className="code">{p.uid?.slice(0, 8)}</code>}</td>
                      <td className="preview">{(p.text || "").slice(0, 80)}</td>
                      <td><code className="code">{p.id.slice(0, 10)}…</code></td>
                      <td>
                        <button className="btn btn--sm btn--ghost" onClick={() => setSelectedPostId(selectedPostId === p.id ? "" : p.id)}>
                          {selectedPostId === p.id ? "Hide comments" : "Comments"}
                        </button>
                        <button className="btn btn--sm btn--danger" disabled={!!busy} onClick={() => run(`del-post-${p.id}`, () => deletePostAdmin(p.id))}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedPostId && (
              <div className="commentsInline">
                <h3 className="inlineTitle">Comments on {selectedPostId.slice(0, 10)}…</h3>
                {comments.length === 0 ? <p className="muted small">No comments.</p> : (
                  <div className="tableWrap">
                    <table className="table">
                      <thead><tr><th>UID</th><th>Text</th><th>ID</th><th>Actions</th></tr></thead>
                      <tbody>
                        {comments.map((c) => (
                          <tr key={c.id}>
                            <td><code className="code">{c.uid?.slice(0, 8)}</code></td>
                            <td className="preview">{(c.text || "").slice(0, 80)}</td>
                            <td><code className="code">{c.id.slice(0, 10)}…</code></td>
                            <td>
                              <button className="btn btn--sm btn--danger" disabled={!!busy} onClick={() => run(`del-c-${c.id}`, () => deleteComment(selectedPostId, c.id))}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="cardTitle">Recipes <span className="muted small">({recipes.length} loaded)</span></h2>
            <div className="tableWrap">
              <table className="table">
                <thead><tr><th>Title</th><th>Owner</th><th>ID</th><th>Actions</th></tr></thead>
                <tbody>
                  {recipes.map((r) => (
                    <tr key={r.id}>
                      <td>{r.title || "Untitled"}</td>
                      <td>{r.author?.name || <code className="code">{(r.author?.uid || r.uid || "").slice(0, 8)}</code>}</td>
                      <td><code className="code">{r.id.slice(0, 10)}…</code></td>
                      <td>
                        <button className="btn btn--sm btn--danger" disabled={!!busy} onClick={() => run(`del-r-${r.id}`, () => deleteRecipeAdmin(r.id))}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* ── MODERATION ── */}
      {tab === "moderation" && (
        <>
          <section className="card">
            <h2 className="cardTitle">Ban / timeout user</h2>
            <div className="modGrid">
              <label className="lbl">
                User UID
                <input className="input" value={modUid} onChange={(e) => setModUid(e.target.value)} placeholder="Paste UID here…" />
              </label>
              <label className="lbl">
                Reason
                <input className="input" value={modReason} onChange={(e) => setModReason(e.target.value)} placeholder="Reason (optional)…" />
              </label>
              <label className="lbl">
                Timeout days
                <input className="input" type="number" min={1} value={modDays} onChange={(e) => setModDays(e.target.value)} />
              </label>
            </div>
            <div className="actionRow">
              <button className="btn btn--danger" disabled={!canMod || !!busy} onClick={() => run("ban", () => banUser(modUid.trim(), modReason.trim()))}>
                🚫 Ban user
              </button>
              <button className="btn btn--amber" disabled={!canMod || !!busy} onClick={() => run("timeout", () => timeoutUser(modUid.trim(), new Date(Date.now() + Number(modDays) * 86_400_000), modReason.trim()))}>
                ⏳ Timeout user
              </button>
              <button className="btn btn--secondary" disabled={!canMod || !!busy} onClick={() => run("clear", () => clearModeration(modUid.trim()))}>
                ✅ Clear ban
              </button>
              <button className="btn btn--danger" disabled={!canMod || !!busy} onClick={() => deleteUserAccount(modUid.trim())}>
                🗑 Delete account
              </button>
            </div>
          </section>

          <section className="card">
            <h2 className="cardTitle">Bulk actions</h2>
            <p className="muted small" style={{ marginBottom: 12 }}>Permanently delete all posts made by a specific user.</p>
            <div className="searchRow">
              <input className="input" placeholder="User UID…" value={bulkUid} onChange={(e) => setBulkUid(e.target.value)} />
              <button
                className="btn btn--danger"
                disabled={bulkUid.trim().length < 6 || !!busy}
                onClick={() => {
                  if (!confirm(`Delete ALL posts by ${bulkUid.trim()}? This cannot be undone.`)) return;
                  run("bulk", async () => {
                    const n = await deleteAllPostsByUser(bulkUid.trim());
                    return `Deleted ${n} post${n === 1 ? "" : "s"}.`;
                  });
                }}
              >
                🗑 Delete all posts by user
              </button>
            </div>
          </section>
        </>
      )}

      <style jsx>{`
        .adminWrap {
          max-width: 1200px;
          margin: 0 auto;
          padding: 28px 24px 48px;
          display: grid;
          gap: 20px;
        }
        .adminHeader { display: grid; gap: 4px; }
        .adminTitle { margin: 0; font-size: 28px; font-weight: 900; color: var(--text); letter-spacing: -.02em; }
        .adminSub { margin: 0; font-size: 13px; color: var(--muted); }

        .statsRow {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }

        .tabs {
          display: flex;
          gap: 0;
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          background: var(--bg2);
        }
        .tabBtn {
          flex: 1;
          padding: 11px 0;
          font-size: 13px;
          font-weight: 700;
          border: none;
          background: transparent;
          color: var(--muted);
          cursor: pointer;
          transition: background .15s, color .15s;
        }
        .tabBtn + .tabBtn { border-left: 1px solid var(--border); }
        .tabBtn--active { background: var(--primary); color: var(--primary-contrast); }
        .tabBtn:hover:not(.tabBtn--active) { background: color-mix(in oklab, var(--bg2) 60%, var(--primary) 40%); color: var(--text); }

        .card {
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 20px;
          background: var(--card-bg);
          box-shadow: 0 4px 18px rgba(0,0,0,.05);
        }
        .cardTitle {
          margin: 0 0 16px;
          font-size: 16px;
          font-weight: 800;
          color: var(--text);
          letter-spacing: -.01em;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .quickGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .quickBtn {
          padding: 18px;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--bg2);
          color: var(--text);
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          text-align: left;
          transition: background .15s;
        }
        .quickBtn:hover { background: color-mix(in oklab, var(--bg2) 60%, var(--primary) 40%); }

        .searchRow {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .searchRow .input { flex: 1; min-width: 200px; }

        .modGrid {
          display: grid;
          grid-template-columns: 1fr 1fr auto;
          gap: 12px;
          align-items: end;
          margin-bottom: 14px;
        }
        .lbl { display: grid; gap: 6px; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }

        .actionRow {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .input {
          height: 44px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--bg);
          color: var(--text);
          padding: 0 12px;
          font-size: 14px;
          width: 100%;
        }

        .btn {
          height: 40px;
          padding: 0 16px;
          border-radius: 12px;
          border: 1px solid var(--border);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          background: var(--bg2);
          color: var(--text);
        }
        .btn:disabled { opacity: .5; cursor: not-allowed; }
        .btn--primary  { background: var(--primary); color: var(--primary-contrast); border-color: var(--primary); }
        .btn--secondary { background: var(--bg2); color: var(--text); }
        .btn--danger   { background: #ef4444; color: #fff; border-color: #ef4444; }
        .btn--amber    { background: #f59e0b; color: #fff; border-color: #f59e0b; }
        .btn--ghost    { background: transparent; color: var(--text); }
        .btn--sm       { height: 32px; padding: 0 10px; font-size: 12px; border-radius: 8px; margin-right: 6px; }

        .tableWrap { overflow-x: auto; }
        .table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .table th { text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); border-bottom: 1px solid var(--border); }
        .table td { padding: 10px 10px; border-bottom: 1px solid color-mix(in oklab, var(--border) 60%, transparent); vertical-align: middle; }
        .table tr:last-child td { border-bottom: none; }
        .table tr:hover td { background: color-mix(in oklab, var(--bg2) 60%, transparent); }

        .code { font-family: monospace; font-size: 11px; background: var(--bg2); padding: 2px 5px; border-radius: 4px; }
        .preview { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); }
        .reasonCell { max-width: 220px; }

        .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 800; }
        .badge--green { background: #dcfce7; color: #166534; }
        .badge--red   { background: #fee2e2; color: #991b1b; }
        .badge--amber { background: #fef3c7; color: #92400e; }

        .modResult { margin-top: 10px; padding: 10px 14px; border-radius: 12px; font-size: 13px; font-weight: 600; }
        .modResult--warn { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
        .modResult--ok   { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }

        .commentsInline { margin-top: 16px; border-top: 1px solid var(--border); padding-top: 16px; }
        .inlineTitle { margin: 0 0 10px; font-size: 13px; font-weight: 800; color: var(--text); }

        .muted { color: var(--muted); }
        .small { font-size: 12px; }

        .toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          padding: 10px 20px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          z-index: 9999;
          box-shadow: 0 8px 24px rgba(0,0,0,.2);
        }
        .toast--ok  { background: #166534; color: #fff; }
        .toast--err { background: #991b1b; color: #fff; }

        @media (max-width: 900px) {
          .statsRow { grid-template-columns: repeat(2, 1fr); }
          .modGrid  { grid-template-columns: 1fr; }
          .quickGrid { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .adminWrap { padding: 16px 14px 36px; }
          .statsRow { grid-template-columns: repeat(2, 1fr); }
          .tabs { overflow-x: auto; }
        }
      `}</style>
    </main>
  );
}
