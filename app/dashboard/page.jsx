"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  CalendarDays,
  ChefHat,
  Clock3,
  Flame,
  Leaf,
  Plus,
  Refrigerator,
  Sparkles,
  Users,
} from "lucide-react";

import { auth, db } from "@/lib/firebas1e";
import { useAuthModal } from "@/context/AuthModalContext";
import CreateRecipeWizard from "@/components/recipes/CreateRecipeWizard";

function daysUntilExpiry(dateStr) {
  if (!dateStr) return null;
  const expiry = new Date(dateStr);
  const now = new Date();
  expiry.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((expiry - now) / 86400000);
}

function formatExpiry(days) {
  if (days === null) return "No date";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days`;
}

function timeAgo(value) {
  if (!value) return "Recently";
  const millis = value?.seconds ? value.seconds * 1000 : Date.parse(value);
  if (!millis || Number.isNaN(millis)) return "Recently";
  const diff = Math.max(0, Date.now() - millis);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function StatCard({ title, value, label, Icon, tone = "green" }) {
  return (
    <article className={`ck-card ck-stat-card dash-stat dash-${tone}`}>
      <div className="ck-stat-top">
        <p className="ck-stat-title">{title}</p>
        <span className="ck-stat-icon"><Icon size={24} /></span>
      </div>
      <p className="ck-stat-value">{value}</p>
      <p className="ck-stat-label">{label}</p>
      <span className="ck-pill">↑ Live from your account</span>
    </article>
  );
}

function EmptyState({ title, copy, href, cta }) {
  return (
    <div className="empty-state">
      <Sparkles size={20} />
      <strong>{title}</strong>
      <p>{copy}</p>
      {href ? <Link href={href}>{cta}<ArrowRight size={14} /></Link> : null}
    </div>
  );
}

export default function DashboardPage() {
  const { openLogin, openRegister } = useAuthModal();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(auth.currentUser);
  const [showWizard, setShowWizard] = useState(false);
  const [myRecipesCount, setMyRecipesCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [pantryItems, setPantryItems] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setMyRecipesCount(0);
      return;
    }
    const q = query(collection(db, "recipes"), where("uid", "==", user.uid));
    return onSnapshot(q, (snap) => setMyRecipesCount(snap.size), () => setMyRecipesCount(0));
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setSavedCount(0);
      return;
    }
    return onSnapshot(collection(db, "users", user.uid, "savedFoods"), (snap) => setSavedCount(snap.size), () => setSavedCount(0));
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setPantryItems([]);
      return;
    }
    const q = query(collection(db, "pantryItems"), where("uid", "==", user.uid));
    return onSnapshot(q, (snap) => setPantryItems(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))), () => setPantryItems([]));
  }, [user?.uid]);

  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(3));
    return onSnapshot(q, (snap) => setRecentPosts(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))), () => setRecentPosts([]));
  }, []);

  const displayName = user?.displayName || user?.email?.split("@")[0] || "there";

  const expiringSoon = useMemo(() => {
    return pantryItems
      .map((item) => ({ ...item, days: daysUntilExpiry(item.expiryDate || item.expiresAt || item.expiry) }))
      .filter((item) => item.days !== null && item.days <= 7)
      .sort((a, b) => a.days - b.days)
      .slice(0, 5);
  }, [pantryItems]);

  const pantryMatch = useMemo(() => {
    if (!pantryItems.length) return 0;
    const withDate = pantryItems.filter((item) => item.expiryDate || item.expiresAt || item.expiry).length;
    return Math.round((withDate / pantryItems.length) * 100);
  }, [pantryItems]);

  const signedOut = ready && !user;

  return (
    <div className="ck-page dashboard-page">
      <div className="ck-page-pad">
        <section className="dash-hero">
          <div className="dash-hero-copy">
            <p className="ck-eyebrow">Dashboard</p>
            <h1 className="ck-display">
              {signedOut ? "See what Clean Kitchen can do." : <>Welcome back, <em>{displayName}</em>.</>}
            </h1>
            <p className="ck-copy">
              {signedOut
                ? "This page explains the app clearly before users sign in: recipes, pantry, saved meals, meal planning and community all live in one place."
                : "Start here to understand your kitchen: what you saved, what is expiring, what to cook next, and where to go next."}
            </p>
            <div className="dash-actions">
              {signedOut ? (
                <>
                  <button type="button" className="ck-btn ck-btn-primary" onClick={() => openRegister("/dashboard")}>Create account</button>
                  <button type="button" className="ck-btn ck-btn-soft" onClick={() => openLogin("/dashboard")}>Sign in</button>
                </>
              ) : (
                <>
                  <button type="button" className="ck-btn ck-btn-primary" onClick={() => setShowWizard(true)}><Plus size={16} /> Add recipe</button>
                  <Link className="ck-btn ck-btn-soft" href="/pantry"><Refrigerator size={16} /> Update pantry</Link>
                  <Link className="ck-btn ck-btn-dark" href="/meal-plan"><CalendarDays size={16} /> Plan week</Link>
                </>
              )}
            </div>
          </div>

          <div className="dash-guide ck-panel">
            <p className="ck-eyebrow">How to use this app</p>
            <div className="guide-list">
              <Link href="/recipes"><ChefHat size={18} /><span><strong>Find a recipe</strong><small>Cook ideas that match your goals.</small></span></Link>
              <Link href="/pantry"><Refrigerator size={18} /><span><strong>Check your pantry</strong><small>See what you own and what expires soon.</small></span></Link>
              <Link href="/saved"><Bookmark size={18} /><span><strong>Save favourites</strong><small>Build your personal meal library.</small></span></Link>
            </div>
          </div>
        </section>

        <section className="ck-grid-3 dash-stats">
          <StatCard title="Saved" value={savedCount} label="recipes saved" Icon={Bookmark} />
          <StatCard title="Pantry" value={pantryItems.length} label="items tracked" Icon={Leaf} />
          <StatCard title="Recipes" value={myRecipesCount} label="created by you" Icon={BookOpen} />
        </section>

        <section className="dashboard-layout">
          <div className="main-column">
            <article className="ck-card next-card">
              <div className="section-title-row">
                <div>
                  <p className="ck-eyebrow">Next best move</p>
                  <h2>Keep your kitchen moving.</h2>
                </div>
                <Flame size={26} />
              </div>
              <div className="next-grid">
                <Link href="/recipes" className="next-action">
                  <ChefHat size={22} />
                  <strong>Cook from pantry</strong>
                  <span>Use ingredients you already have.</span>
                  <div className="next-action-btn">Open recipes <ArrowRight size={13} /></div>
                </Link>
                <Link href="/meal-plan" className="next-action">
                  <CalendarDays size={22} />
                  <strong>Build this week</strong>
                  <span>Plan meals before shopping.</span>
                  <div className="next-action-btn">Open plan <ArrowRight size={13} /></div>
                </Link>
                <Link href="/fitness" className="next-action">
                  <Flame size={22} />
                  <strong>Match your goals</strong>
                  <span>Keep food and training connected.</span>
                  <div className="next-action-btn">Open training <ArrowRight size={13} /></div>
                </Link>
              </div>
            </article>

            <article className="ck-card">
              <div className="section-title-row">
                <div>
                  <p className="ck-eyebrow">Community</p>
                  <h2>Recent ideas from other users.</h2>
                </div>
                <Link href="/posts" className="view-link">View all <ArrowRight size={14} /></Link>
              </div>

              {recentPosts.length ? (
                <div className="post-list">
                  {recentPosts.map((post) => (
                    <Link href="/posts" key={post.id} className="post-mini">
                      <span><Users size={16} /></span>
                      <div>
                        <strong>{post.title || post.recipeTitle || post.authorName || "Community post"}</strong>
                        <p>{post.content || post.caption || post.body || "Someone shared a new kitchen idea."}</p>
                      </div>
                      <div className="post-mini-right">
                        <small>{timeAgo(post.createdAt)}</small>
                        <span className="post-mini-arrow"><ArrowRight size={14} /></span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState title="No community posts yet" copy="When people share recipes or tips, they will show here." href="/posts" cta="Open community" />
              )}
            </article>
          </div>

          <aside className="side-column">
            <article className="ck-card pantry-card">
              <div className="section-title-row">
                <div>
                  <p className="ck-eyebrow">Pantry health</p>
                  <h2>{pantryMatch}% tracked</h2>
                </div>
                <Clock3 size={24} />
              </div>
              <p>Items with expiry dates help users understand what to cook before food goes bad.</p>
              <Link href="/pantry" className="ck-btn ck-btn-soft">Manage pantry <ArrowRight size={14} /></Link>
            </article>

            <article className="ck-card expiry-card">
              <div className="section-title-row">
                <div>
                  <p className="ck-eyebrow">Expiring soon</p>
                  <h2>Use these first.</h2>
                </div>
              </div>

              {expiringSoon.length ? (
                <div className="expiry-list">
                  {expiringSoon.map((item) => (
                    <Link key={item.id} href="/pantry" className="expiry-item">
                      <span>{item.name || item.itemName || "Pantry item"}</span>
                      <strong>{formatExpiry(item.days)}</strong>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState title="Nothing urgent" copy="Add pantry expiry dates and urgent items will appear here." href="/pantry" cta="Add pantry items" />
              )}
            </article>
          </aside>
        </section>
      </div>

      {showWizard && (
        <CreateRecipeWizard
          open={showWizard}
          meUid={user?.uid ?? null}
          onClose={() => setShowWizard(false)}
          onSaved={() => setShowWizard(false)}
        />
      )}

      <style jsx>{`
        .dash-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(320px, .75fr);
          gap: clamp(16px, 2.5vw, 24px);
          align-items: stretch;
        }

        .dash-hero-copy,
        .dash-guide {
          min-height: 360px;
          border-radius: var(--ck-radius-xl);
        }

        .dash-hero-copy {
          padding: clamp(28px, 5vw, 52px);
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 20px;
          background:
            radial-gradient(circle at 96% 16%, color-mix(in oklab, var(--ck-accent) 18%, transparent), transparent 30%),
            color-mix(in oklab, var(--text) 90%, black 10%);
          color: color-mix(in oklab, var(--bg) 94%, white 6%);
          box-shadow: var(--ck-soft-shadow);
        }

        .dash-hero-copy :global(.ck-display),
        .dash-hero-copy :global(.ck-copy) { color: inherit; }
        .dash-hero-copy :global(.ck-copy) { opacity: .72; max-width: 70ch; }

        .dash-actions { display: flex; flex-wrap: wrap; gap: 12px; }

        .dash-guide {
          padding: 26px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          gap: 18px;
        }

        .guide-list { display: grid; gap: 10px; }
        .guide-list :global(a) { display: flex; gap: 12px; align-items: center; padding: 14px; border-radius: 18px; text-decoration: none; color: var(--text); background: color-mix(in oklab, var(--bg-raised) 70%, transparent); }
        .guide-list :global(a):hover { background: color-mix(in oklab, var(--ck-accent) 10%, var(--bg-raised)); }
        .guide-list span { display: grid; gap: 2px; }
        .guide-list strong { font-size: 14px; letter-spacing: -.03em; }
        .guide-list small { color: var(--muted); font-weight: 650; }

        .dash-stats { margin-top: 22px; }
        .dashboard-layout { margin-top: 22px; display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(300px, .55fr); gap: 22px; align-items: start; }
        .main-column, .side-column { display: grid; gap: 22px; }
        .next-card, .pantry-card, .expiry-card, .dashboard-layout :global(.ck-card) { padding: clamp(18px, 2.4vw, 26px); }

        .section-title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 18px; }
        .section-title-row h2 { margin: 7px 0 0; font-size: clamp(24px, 3vw, 36px); line-height: 1; letter-spacing: -.065em; color: var(--text); }
        .section-title-row :global(svg) { color: var(--ck-accent); flex-shrink: 0; }
        .view-link { display: inline-flex; gap: 6px; align-items: center; color: var(--text); text-decoration: none; font-weight: 900; }
        .view-link:hover { color: var(--ck-accent); text-decoration: none; }

        .next-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .next-action { display: grid; gap: 9px; min-height: 170px; align-content: end; padding: 18px; border-radius: 22px; text-decoration: none; color: var(--text); background: color-mix(in oklab, var(--bg-raised) 78%, var(--ck-accent) 22%); border: 1px solid transparent; transition: transform .15s, border-color .15s, box-shadow .15s; }
        .next-action:hover { transform: translateY(-3px); text-decoration: none; border-color: color-mix(in oklab, var(--ck-accent) 40%, transparent); box-shadow: 0 12px 28px rgba(0,0,0,.10); }
        .next-action :global(svg) { color: var(--ck-accent); }
        .next-action strong { font-size: 18px; line-height: 1.1; letter-spacing: -.045em; }
        .next-action > span { color: var(--muted); font-size: 13px; font-weight: 650; }
        .next-action-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px; background: var(--ck-accent); color: var(--ck-accent-contrast, #061006); font-size: 12px; font-weight: 800; width: fit-content; margin-top: 4px; }

        .post-list, .expiry-list { display: grid; gap: 10px; }
        .post-mini, .expiry-item { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 18px; color: var(--text); text-decoration: none; background: color-mix(in oklab, var(--bg-raised) 76%, transparent); border: 1px solid transparent; transition: background .15s, border-color .15s; }
        .post-mini:hover, .expiry-item:hover { background: color-mix(in oklab, var(--ck-accent) 10%, var(--bg-raised)); border-color: color-mix(in oklab, var(--ck-accent) 30%, transparent); text-decoration: none; }
        .post-mini > span:first-child { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 999px; background: color-mix(in oklab, var(--ck-accent) 13%, transparent); color: var(--ck-accent); flex-shrink: 0; }
        .post-mini div { min-width: 0; flex: 1; }
        .post-mini strong { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .post-mini p { margin: 2px 0 0; color: var(--muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .post-mini-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
        .post-mini-right small { color: var(--muted); font-weight: 750; white-space: nowrap; }
        .post-mini-arrow { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; background: color-mix(in oklab, var(--ck-accent) 14%, transparent); color: var(--ck-accent); }

        .pantry-card p { margin: 0 0 18px; color: var(--muted); line-height: 1.7; }
        .expiry-item { justify-content: space-between; }
        .expiry-item strong { color: var(--ck-accent); }

        .empty-state { min-height: 180px; display: grid; place-items: center; text-align: center; gap: 8px; padding: 24px; color: var(--muted); border-radius: 22px; background: color-mix(in oklab, var(--bg-raised) 72%, transparent); }
        .empty-state :global(svg) { color: var(--ck-accent); }
        .empty-state strong { color: var(--text); font-size: 18px; letter-spacing: -.04em; }
        .empty-state p { max-width: 36ch; margin: 0; color: var(--muted); }
        .empty-state :global(a) { display: inline-flex; align-items: center; gap: 6px; color: var(--text); font-weight: 900; text-decoration: none; }

        @media (max-width: 1080px) {
          .dash-hero, .dashboard-layout { grid-template-columns: 1fr; }
          .next-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .dash-hero-copy { padding: 28px 22px; }
          .dash-hero-copy :global(.ck-display) { font-size: 44px; }
        }
      `}</style>
    </div>
  );
}
