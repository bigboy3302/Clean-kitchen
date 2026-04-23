"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Boxes, BookOpen, Bookmark, UtensilsCrossed,
  Dumbbell, Users, Settings, HelpCircle, Plus, FileText, X,
} from "lucide-react";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebas1e";
import { useAuthModal } from "@/context/AuthModalContext";

const navLinks = [
  { href: "/dashboard", label: "Overview", Icon: LayoutDashboard },
  { href: "/pantry", label: "Pantry", Icon: Boxes },
  { href: "/recipes", label: "Recipes", Icon: BookOpen },
  { href: "/saved", label: "Saved", Icon: Bookmark },
  { href: "/meal-plan", label: "Meal Plan", Icon: UtensilsCrossed },
  { href: "/fitness", label: "Fitness", Icon: Dumbbell },
  { href: "/posts", label: "Community", Icon: Users },
];

export default function Sidebar({
  mobileOpen = false,
  onRequestClose,
}: {
  mobileOpen?: boolean;
  onRequestClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { openRegister } = useAuthModal();
  const [uid, setUid] = useState<string | null>(null);
  const [myRecipesCount, setMyRecipesCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [pantryCount, setPantryCount] = useState(0);

  useEffect(() => onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null)), []);

  useEffect(() => {
    if (!uid) { setMyRecipesCount(0); return; }
    const q = query(collection(db, "recipes"), where("uid", "==", uid));
    return onSnapshot(q, (snap) => setMyRecipesCount(snap.size), () => setMyRecipesCount(0));
  }, [uid]);

  useEffect(() => {
    if (!uid) { setSavedCount(0); return; }
    const q = collection(db, "users", uid, "savedFoods");
    return onSnapshot(q, (snap) => setSavedCount(snap.size), () => setSavedCount(0));
  }, [uid]);

  useEffect(() => {
    if (!uid) { setPantryCount(0); return; }
    const q = query(collection(db, "pantryItems"), where("uid", "==", uid));
    return onSnapshot(q, (snap) => setPantryCount(snap.size), () => setPantryCount(0));
  }, [uid]);

  const hideCreateRecipeButton = pathname?.startsWith("/recipes");

  return (
    <>
      <button
        type="button"
        className={clsx("sidebar-backdrop", mobileOpen && "open")}
        onClick={onRequestClose}
        aria-label="Close navigation drawer"
      />

      <aside className={clsx("ck-sidebar", mobileOpen && "mobile-open")}>
      <div className="sidebar-brand">
        <Link href="/dashboard" className="brand-link" aria-label="Clean Kitchen home">
          <span className="brand-icon">
            <Image src="/logo.png" alt="" width={24} height={24} className="brand-logo" />
          </span>
          <span className="brand-name">Clean Kitchen</span>
        </Link>
        <button type="button" className="mobile-close" onClick={onRequestClose} aria-label="Close navigation drawer">
          <X size={18} aria-hidden />
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Primary">
        <span className="nav-section-label">Workspace</span>
        {navLinks.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname?.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx("sidebar-link", active && "active")}
              aria-current={active ? "page" : undefined}
              onClick={onRequestClose}
            >
              <span className="link-icon"><Icon size={17} strokeWidth={1.8} aria-hidden /></span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="kitchen-section">
        <span className="kitchen-label">Library</span>
        <Link href="/recipes" className="kitchen-item" onClick={onRequestClose}>
          <FileText size={14} aria-hidden />
          <span>My Recipes</span>
          <span className="kitchen-count">{myRecipesCount}</span>
        </Link>
        <Link href="/saved" className="kitchen-item" onClick={onRequestClose}>
          <Bookmark size={14} aria-hidden />
          <span>Saved Recipes</span>
          <span className="kitchen-count">{savedCount}</span>
        </Link>
        <Link href="/pantry" className="kitchen-item" onClick={onRequestClose}>
          <Boxes size={14} aria-hidden />
          <span>Pantry Items</span>
          <span className="kitchen-count">{pantryCount}</span>
        </Link>
      </div>

      {!hideCreateRecipeButton ? (
        <button
          type="button"
          className="create-recipe-btn"
          onClick={() => {
            if (uid) {
              router.push("/recipes?create=1");
              onRequestClose?.();
              return;
            }
            openRegister("/recipes?create=1");
            onRequestClose?.();
          }}
        >
          <Plus size={15} aria-hidden />
          Create Recipe
        </button>
      ) : null}

      <div className="sidebar-footer">
        <Link href="/settings" className="footer-link" onClick={onRequestClose}>
          <Settings size={15} aria-hidden />
          <span>Settings</span>
        </Link>
        <Link href="https://github.com/anthropics/claude-code/issues" className="footer-link" target="_blank" rel="noopener">
          <HelpCircle size={15} aria-hidden />
          <span>Help &amp; Support</span>
        </Link>
      </div>

      <style jsx>{`
        .ck-sidebar {
          width: 240px;
          height: 100dvh;
          position: fixed;
          top: 0;
          left: 0;
          display: flex;
          flex-direction: column;
          padding: 22px 14px 18px;
          background: var(--bg-raised);
          border-right: 1px solid var(--border);
          overflow-y: auto;
          z-index: 60;
          scrollbar-width: none;
        }
        .ck-sidebar::-webkit-scrollbar { display: none; }
        .sidebar-backdrop {
          display: none;
        }

        /* ── Brand ── */
        .sidebar-brand {
          padding: 0 6px;
          margin-bottom: 28px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .brand-link {
          display: flex;
          align-items: center;
          gap: 11px;
          text-decoration: none;
          color: var(--text);
        }
        .brand-link:hover { text-decoration: none; }
        .brand-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: linear-gradient(135deg, #166534, #15803d);
          box-shadow: 0 4px 12px rgba(22, 101, 52, 0.45);
          display: grid;
          place-items: center;
          flex-shrink: 0;
          overflow: hidden;
        }
        .brand-logo {
          width: 24px;
          height: 24px;
          object-fit: contain;
          border-radius: 6px;
        }
        .brand-name {
          font-weight: 800;
          font-size: 16px;
          color: var(--text);
          letter-spacing: -0.03em;
          line-height: 1;
        }
        .mobile-close {
          display: none;
          width: 40px;
          height: 40px;
          border-radius: 14px;
          border: 1px solid color-mix(in oklab, var(--border) 82%, transparent);
          background: color-mix(in oklab, var(--bg2) 92%, transparent);
          color: var(--text);
          place-items: center;
          cursor: pointer;
          flex-shrink: 0;
        }

        /* ── Nav ── */
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 10px;
        }
        .nav-section-label {
          padding: 0 10px 8px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: color-mix(in oklab, var(--muted) 88%, var(--text));
        }
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 14px;
          color: var(--muted);
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.01em;
          transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.15s;
          position: relative;
          border: 1px solid transparent;
        }
        .sidebar-link:hover {
          background: color-mix(in oklab, var(--primary) 8%, transparent);
          color: var(--text);
          border-color: color-mix(in oklab, var(--primary) 18%, transparent);
          transform: translateX(2px);
          text-decoration: none;
        }
        .sidebar-link.active {
          background: linear-gradient(
            135deg,
            color-mix(in oklab, var(--primary) 16%, transparent),
            color-mix(in oklab, var(--bg-raised) 88%, transparent)
          );
          color: var(--text);
          font-weight: 700;
          border-color: color-mix(in oklab, var(--primary) 20%, transparent);
          box-shadow: 0 10px 24px color-mix(in oklab, var(--primary) 10%, transparent);
        }
        .link-icon {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          color: var(--muted);
          background: color-mix(in oklab, var(--bg) 74%, var(--bg2));
          border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .sidebar-link:hover .link-icon {
          color: var(--text);
          border-color: color-mix(in oklab, var(--primary) 20%, transparent);
        }
        .sidebar-link.active .link-icon {
          background: color-mix(in oklab, var(--primary) 18%, transparent);
          color: var(--primary);
          border-color: color-mix(in oklab, var(--primary) 22%, transparent);
        }

        /* ── Your Kitchen ── */
        .kitchen-section {
          margin-top: 14px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 16px;
        }
        .kitchen-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
          padding: 0 10px 8px;
          opacity: 0.8;
        }
        .kitchen-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 14px;
          color: var(--muted);
          text-decoration: none;
          font-size: 12.5px;
          font-weight: 600;
          letter-spacing: 0.01em;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
          border: 1px solid transparent;
        }
        .kitchen-item:hover {
          background: color-mix(in oklab, var(--primary) 7%, transparent);
          color: var(--text);
          border-color: color-mix(in oklab, var(--primary) 14%, transparent);
          text-decoration: none;
        }
        .kitchen-item span:nth-child(2) { flex: 1; }
        .kitchen-count {
          font-size: 10px;
          font-weight: 800;
          color: var(--muted);
          background: color-mix(in oklab, var(--border) 120%, transparent);
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 2px 8px;
          min-width: 24px;
          text-align: center;
          letter-spacing: 0.08em;
          line-height: 1.6;
          text-transform: uppercase;
        }

        /* ── Create button ── */
        .create-recipe-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          width: 100%;
          padding: 10px 16px;
          border-radius: 11px;
          background: linear-gradient(135deg, #166534 0%, #16a34a 100%);
          box-shadow: 0 4px 16px rgba(22, 163, 74, 0.3);
          color: #fff;
          font-weight: 700;
          font-size: 13.5px;
          letter-spacing: -0.01em;
          border: none;
          cursor: pointer;
          font-family: inherit;
          transition: box-shadow 0.18s, transform 0.14s, filter 0.18s;
          margin-bottom: 16px;
          flex-shrink: 0;
        }
        .create-recipe-btn:hover {
          box-shadow: 0 6px 22px rgba(22, 163, 74, 0.44);
          transform: translateY(-1px);
          filter: brightness(1.06);
        }
        .create-recipe-btn:active {
          transform: translateY(0);
          filter: brightness(0.97);
        }

        /* ── Footer ── */
        .sidebar-footer {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 4px;
          border-top: 1px solid var(--border);
          padding-top: 12px;
          flex-shrink: 0;
        }
        .footer-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 14px;
          color: var(--muted);
          text-decoration: none;
          font-size: 12.5px;
          font-weight: 600;
          letter-spacing: 0.01em;
          opacity: 0.8;
          transition: background 0.15s, color 0.15s, opacity 0.15s;
        }
        .footer-link:hover {
          background: color-mix(in oklab, var(--primary) 7%, transparent);
          color: var(--text);
          opacity: 1;
          text-decoration: none;
        }

        @media (max-width: 768px) {
          .sidebar-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            border: 0;
            padding: 0;
            background: rgba(2, 6, 23, 0.36);
            backdrop-filter: blur(6px);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.22s ease;
            z-index: 69;
          }
          .sidebar-backdrop.open {
            opacity: 1;
            pointer-events: auto;
          }
          .ck-sidebar {
            width: min(84vw, 320px);
            padding: 18px 14px 18px;
            box-shadow: 0 28px 80px rgba(2, 6, 23, 0.26);
            transform: translateX(calc(-100% - 18px));
            transition: transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
            z-index: 70;
            border-right: 1px solid color-mix(in oklab, var(--border) 86%, transparent);
            background:
              radial-gradient(circle at top left, color-mix(in oklab, var(--primary) 12%, transparent), transparent 34%),
              linear-gradient(180deg, color-mix(in oklab, var(--bg2) 96%, transparent), var(--bg));
          }
          .ck-sidebar.mobile-open {
            transform: translateX(0);
          }
          .mobile-close {
            display: grid;
          }
          .sidebar-link:hover,
          .kitchen-item:hover {
            transform: none;
          }
        }
      `}</style>
      </aside>
    </>
  );
}
