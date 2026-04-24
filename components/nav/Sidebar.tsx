"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  Boxes,
  Dumbbell,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Settings,
  Shield,
  UtensilsCrossed,
  Users,
  X,
  ScrollText,
  Mail,
  BookOpen,
  ShieldAlert,
} from "lucide-react";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebas1e";
import { isAdminUid } from "@/lib/admin";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", hint: "Overview and progress", Icon: LayoutDashboard },
  { href: "/pantry", label: "Pantry", hint: "Stock and expiry tracking", Icon: Boxes },
  { href: "/recipes", label: "Recipes", hint: "Cook and manage meals", Icon: BookOpen },
  { href: "/saved", label: "Saved", hint: "Your saved ideas", Icon: Bookmark },
  { href: "/meal-plan", label: "Meal Plan", hint: "Weekly structure", Icon: UtensilsCrossed },
  { href: "/fitness", label: "Training", hint: "Workouts and goals", Icon: Dumbbell },
  { href: "/posts", label: "Community", hint: "Posts and comments", Icon: Users },
];

const supportLinks = [
  { href: "/privacy", label: "Privacy Policy", Icon: Shield },
  { href: "/terms", label: "Terms of Service", Icon: ScrollText },
  { href: "/support", label: "Help & Support", Icon: HelpCircle },
  { href: "mailto:adriansraitums95@gmail.com", label: "Contact Support", Icon: Mail, external: true },
];

export default function Sidebar({
  mobileOpen = false,
  onRequestClose,
}: {
  mobileOpen?: boolean;
  onRequestClose?: () => void;
}) {
  const pathname = usePathname();
  const [uid, setUid] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myRecipesCount, setMyRecipesCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [pantryCount, setPantryCount] = useState(0);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      const nextUid = u?.uid ?? null;
      setUid(nextUid);
      setIsAdmin(isAdminUid(nextUid));
    });
  }, []);

  useEffect(() => {
    if (!uid) {
      setMyRecipesCount(0);
      return;
    }
    const q = query(collection(db, "recipes"), where("uid", "==", uid));
    return onSnapshot(q, (snap) => setMyRecipesCount(snap.size), () => setMyRecipesCount(0));
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setSavedCount(0);
      return;
    }
    const q = collection(db, "users", uid, "savedFoods");
    return onSnapshot(q, (snap) => setSavedCount(snap.size), () => setSavedCount(0));
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setPantryCount(0);
      return;
    }
    const q = query(collection(db, "pantryItems"), where("uid", "==", uid));
    return onSnapshot(q, (snap) => setPantryCount(snap.size), () => setPantryCount(0));
  }, [uid]);

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
            <span className="brand-copy">
              <span className="brand-kicker">Nutrition Platform</span>
              <span className="brand-name">Clean Kitchen</span>
            </span>
          </Link>

          <button type="button" className="mobile-close" onClick={onRequestClose} aria-label="Close navigation drawer">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="sidebar-scroll">
          <nav className="sidebar-nav" aria-label="Primary">
            <span className="nav-section-label">Main</span>

            {navLinks.map(({ href, label, hint, Icon }) => {
              const active = pathname === href || (href !== "/dashboard" && pathname?.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx("sidebar-link", active && "active")}
                  aria-current={active ? "page" : undefined}
                  onClick={onRequestClose}
                >
                  <span className="link-icon">
                    <Icon size={18} strokeWidth={1.8} aria-hidden />
                  </span>

                  <span className="link-copy">
                    <span className="link-label">{label}</span>
                    <span className="link-hint">{hint}</span>
                  </span>
                </Link>
              );
            })}

            {isAdmin ? (
              <Link
                href="/admin"
                className={clsx("sidebar-link admin-link", pathname?.startsWith("/admin") && "active")}
                onClick={onRequestClose}
              >
                <span className="link-icon">
                  <ShieldAlert size={18} strokeWidth={1.8} aria-hidden />
                </span>
                <span className="link-copy">
                  <span className="link-label">Admin Panel</span>
                  <span className="link-hint">Moderation and controls</span>
                </span>
              </Link>
            ) : null}
          </nav>

          <div className="kitchen-section">
            <span className="kitchen-label">Library</span>

            <Link href="/recipes" className="kitchen-item" onClick={onRequestClose}>
              <FileText size={15} aria-hidden />
              <span className="kitchen-text">My Recipes</span>
              <span className="kitchen-count">{myRecipesCount}</span>
            </Link>

            <Link href="/saved" className="kitchen-item" onClick={onRequestClose}>
              <Bookmark size={15} aria-hidden />
              <span className="kitchen-text">Saved Recipes</span>
              <span className="kitchen-count">{savedCount}</span>
            </Link>

            <Link href="/pantry" className="kitchen-item" onClick={onRequestClose}>
              <Boxes size={15} aria-hidden />
              <span className="kitchen-text">Pantry Items</span>
              <span className="kitchen-count">{pantryCount}</span>
            </Link>
          </div>
        </div>

        <div className="sidebar-footer">
          <span className="nav-section-label footer-title">Support</span>

          <Link href="/settings" className="footer-link" onClick={onRequestClose}>
            <Settings size={15} aria-hidden />
            <span>Settings</span>
          </Link>

          {supportLinks.map(({ href, label, Icon, external }) => (
            <Link
              key={href}
              href={href}
              className="footer-link"
              onClick={onRequestClose}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
            >
              <Icon size={15} aria-hidden />
              <span>{label}</span>
            </Link>
          ))}
        </div>

        <style jsx>{`
          /* ── sidebar shell ── */
          .ck-sidebar {
            width: 272px;
            height: 100dvh;
            position: fixed;
            top: 0;
            left: 0;
            display: flex;
            flex-direction: column;
            padding: 16px 12px 12px;
            background: var(--bg-raised);
            border-right: 1px solid var(--border);
            overflow: hidden;
            z-index: 70;
            color: var(--text);
          }

          .sidebar-backdrop { display: none; }

          /* ── brand ── */
          .sidebar-brand {
            padding: 4px 4px 16px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            border-bottom: 1px solid var(--border);
            flex-shrink: 0;
          }

          .brand-link {
            display: flex;
            align-items: center;
            gap: 11px;
            min-width: 0;
            text-decoration: none;
            color: var(--text);
          }

          .brand-link:hover { text-decoration: none; }

          .brand-icon {
            width: 38px;
            height: 38px;
            border-radius: 11px;
            background: var(--primary);
            box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 22%, transparent);
            display: grid;
            place-items: center;
            overflow: hidden;
            flex-shrink: 0;
          }

          .brand-logo {
            width: 22px;
            height: 22px;
            object-fit: contain;
          }

          .brand-copy {
            display: flex;
            flex-direction: column;
            min-width: 0;
            gap: 1px;
          }

          .brand-kicker {
            font-size: 9.5px;
            font-weight: 600;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--primary);
            opacity: 0.85;
          }

          .brand-name {
            font-size: 16px;
            font-weight: 800;
            line-height: 1.15;
            letter-spacing: -0.04em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: var(--text);
          }

          .mobile-close {
            display: none;
            width: 34px;
            height: 34px;
            border-radius: 10px;
            border: 1px solid var(--border);
            background: transparent;
            color: var(--muted);
            place-items: center;
            cursor: pointer;
            flex-shrink: 0;
            transition: background 0.12s, color 0.12s;
          }

          .mobile-close:hover {
            background: color-mix(in oklab, var(--border) 70%, transparent);
            color: var(--text);
          }

          /* ── scroll area ── */
          .sidebar-scroll {
            flex: 1;
            overflow-y: auto;
            min-height: 0;
            scrollbar-width: none;
          }
          .sidebar-scroll::-webkit-scrollbar { display: none; }

          /* ── section labels ── */
          .nav-section-label,
          .kitchen-label {
            display: flex;
            align-items: center;
            gap: 7px;
            padding: 0 4px 8px;
            font-size: 10.5px;
            font-weight: 600;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--muted);
          }

          .nav-section-label::before,
          .kitchen-label::before {
            content: '';
            display: inline-block;
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background: var(--primary);
            opacity: 0.7;
            flex-shrink: 0;
          }

          /* ── nav ── */
          .sidebar-nav,
          .kitchen-section {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .sidebar-link {
            display: flex;
            align-items: center;
            gap: 11px;
            padding: 8px 10px;
            border-radius: 11px;
            color: var(--muted);
            text-decoration: none;
            transition: background 0.14s, color 0.14s;
          }

          .sidebar-link:hover {
            color: var(--text);
            background: color-mix(in oklab, var(--border) 70%, transparent);
            text-decoration: none;
          }

          .sidebar-link.active {
            color: var(--text);
            background: color-mix(in oklab, var(--primary) 12%, var(--bg-raised));
          }

          .admin-link { margin-top: 4px; }

          /* ── link icon box ── */
          .link-icon {
            width: 36px;
            height: 36px;
            border-radius: 9px;
            display: grid;
            place-items: center;
            flex-shrink: 0;
            color: var(--muted);
            background: color-mix(in oklab, var(--border) 65%, transparent);
            transition: background 0.14s, color 0.14s;
          }

          .sidebar-link.active .link-icon {
            background: color-mix(in oklab, var(--primary) 16%, var(--bg));
            color: var(--primary);
          }

          .sidebar-link:hover .link-icon {
            color: var(--text);
          }

          /* ── link text ── */
          .link-copy {
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 1px;
          }

          .link-label {
            font-size: 14px;
            font-weight: 600;
            line-height: 1.2;
            letter-spacing: -0.02em;
            color: inherit;
          }

          .sidebar-link.active .link-label {
            font-weight: 700;
            color: var(--text);
          }

          .link-hint {
            font-size: 11px;
            line-height: 1.25;
            color: color-mix(in oklab, var(--muted) 85%, transparent);
            letter-spacing: 0;
          }

          .sidebar-link.active .link-hint {
            color: color-mix(in oklab, var(--muted) 75%, var(--text));
          }

          /* ── library section ── */
          .kitchen-section {
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid var(--border);
            margin-bottom: 4px;
          }

          .kitchen-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 7px 10px;
            border-radius: 9px;
            color: var(--muted);
            text-decoration: none;
            font-size: 13px;
            font-weight: 500;
            transition: background 0.13s, color 0.13s;
          }

          .kitchen-item:hover {
            color: var(--text);
            background: color-mix(in oklab, var(--border) 70%, transparent);
            text-decoration: none;
          }

          .kitchen-item :global(svg) {
            flex-shrink: 0;
            color: var(--muted);
          }

          .kitchen-text {
            flex: 1;
            line-height: 1.2;
          }

          .kitchen-count {
            padding: 2px 7px;
            border-radius: 999px;
            font-size: 10.5px;
            font-weight: 700;
            color: var(--primary);
            background: color-mix(in oklab, var(--primary) 12%, transparent);
          }

          /* ── footer ── */
          .sidebar-footer {
            display: flex;
            flex-direction: column;
            gap: 1px;
            flex-shrink: 0;
            padding-top: 12px;
            border-top: 1px solid var(--border);
          }

          .footer-title { padding-bottom: 6px; }

          .footer-link {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 10px;
            border-radius: 8px;
            color: var(--muted);
            text-decoration: none;
            font-size: 12.5px;
            font-weight: 500;
            transition: background 0.12s, color 0.12s;
          }

          .footer-link:hover {
            color: var(--text);
            background: color-mix(in oklab, var(--border) 70%, transparent);
            text-decoration: none;
          }

          .footer-link :global(svg) { flex-shrink: 0; opacity: 0.7; }

          /* ── mobile ── */
          @media (max-width: 768px) {
            .sidebar-backdrop {
              display: none;
              position: fixed;
              inset: 0;
              width: 100vw;
              height: 100dvh;
              min-width: 0;
              min-height: 0;
              border: 0;
              padding: 0;
              margin: 0;
              appearance: none;
              -webkit-appearance: none;
              border-radius: 0;
              outline: none;
              background: transparent;
              color: transparent;
              font-size: 0;
              line-height: 0;
              backdrop-filter: blur(6px);
              opacity: 0;
              pointer-events: none;
              transition: opacity 0.22s ease;
              z-index: 69;
            }

            .sidebar-backdrop.open {
              display: block;
              background: rgba(2, 6, 23, 0.5);
              opacity: 1;
              pointer-events: auto;
            }

            .ck-sidebar {
              width: min(78vw, 260px);
              padding: 12px 10px;
              transform: translateX(calc(-100% - 20px));
              transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
            }

            .ck-sidebar.mobile-open { transform: translateX(0); }

            .mobile-close { display: grid; }

            .sidebar-brand {
              padding: 2px 2px 12px;
              margin-bottom: 6px;
            }

            .brand-icon { width: 32px; height: 32px; border-radius: 9px; }
            .brand-logo { width: 18px; height: 18px; }
            .brand-name { font-size: 14px; }
            .brand-kicker { font-size: 8.5px; }

            .nav-section-label,
            .kitchen-label {
              font-size: 9.5px;
              padding-bottom: 6px;
            }

            .sidebar-nav,
            .kitchen-section,
            .sidebar-footer { gap: 1px; }

            .sidebar-link {
              padding: 7px 8px;
              border-radius: 9px;
              gap: 9px;
            }

            .link-icon {
              width: 30px;
              height: 30px;
              border-radius: 8px;
            }

            .link-label { font-size: 13px; }
            .link-hint { font-size: 10.5px; }

            .kitchen-section {
              margin-top: 12px;
              padding-top: 12px;
              margin-bottom: 2px;
            }

            .kitchen-item { padding: 6px 8px; font-size: 12.5px; }
            .footer-link { padding: 5px 8px; font-size: 12px; }
            .footer-link :global(svg) { width: 13px; height: 13px; }
          }

          @media (max-width: 380px) {
            .ck-sidebar { width: 82vw; padding: 10px 8px; }
            .link-icon { width: 28px; height: 28px; }
            .link-label { font-size: 12.5px; }
          }
        `}</style>
      </aside>
    </>
  );
}
