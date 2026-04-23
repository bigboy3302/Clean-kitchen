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
          .ck-sidebar {
            width: 278px;
            height: 100dvh;
            position: fixed;
            top: 0;
            left: 0;
            display: flex;
            flex-direction: column;
            padding: 14px 12px;
            background:
              radial-gradient(circle at top left, color-mix(in oklab, var(--primary) 14%, transparent), transparent 28%),
              linear-gradient(
                180deg,
                color-mix(in oklab, var(--bg-raised) 96%, var(--bg) 4%),
                color-mix(in oklab, var(--bg) 98%, black 2%)
              );
            border-right: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
            box-shadow: inset -1px 0 0 color-mix(in oklab, var(--border) 42%, transparent);
            overflow: hidden;
            z-index: 70;
            color: var(--text);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
          }

          .sidebar-backdrop {
            display: none;
          }

          .sidebar-brand {
            padding: 6px 4px 14px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            border-bottom: 1px solid color-mix(in oklab, var(--border) 84%, transparent);
          }

          .brand-link {
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 0;
            text-decoration: none;
            color: var(--text);
          }

          .brand-icon {
            width: 40px;
            height: 40px;
            border-radius: 12px;
            background: linear-gradient(
              135deg,
              var(--primary),
              color-mix(in oklab, var(--primary) 74%, white 26%)
            );
            box-shadow: 0 10px 24px color-mix(in oklab, var(--primary) 24%, transparent);
            display: grid;
            place-items: center;
            overflow: hidden;
            flex-shrink: 0;
          }

          .brand-logo {
            width: 24px;
            height: 24px;
            object-fit: contain;
          }

          .brand-copy {
            display: flex;
            flex-direction: column;
            min-width: 0;
            gap: 2px;
          }

          .brand-kicker {
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.2em;
            color: color-mix(in oklab, var(--muted) 82%, var(--text));
          }

          .brand-name {
            font-size: 17px;
            font-weight: 800;
            line-height: 1.1;
            letter-spacing: -0.03em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: var(--text);
          }

          .mobile-close {
            display: none;
            width: 40px;
            height: 40px;
            border-radius: 12px;
            border: 1px solid color-mix(in oklab, var(--border) 84%, transparent);
            background: color-mix(in oklab, var(--bg) 82%, transparent);
            color: var(--text);
            place-items: center;
            cursor: pointer;
            flex-shrink: 0;
          }

          .sidebar-nav,
          .kitchen-section,
          .sidebar-footer {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .nav-section-label,
          .kitchen-label {
            padding: 0 10px 8px;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.22em;
            text-transform: uppercase;
            color: color-mix(in oklab, var(--muted) 76%, var(--text));
          }

          .sidebar-link {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px;
            border-radius: 16px;
            color: color-mix(in oklab, var(--text) 80%, var(--muted));
            text-decoration: none;
            border: 1px solid transparent;
            transition: 0.18s ease;
          }

          .sidebar-link:hover {
            color: var(--text);
            background: color-mix(in oklab, var(--bg) 76%, var(--primary) 24% / 10%);
            border-color: color-mix(in oklab, var(--border) 72%, var(--primary) 28%);
            transform: translateX(2px);
          }

          .sidebar-link.active {
            color: var(--text);
            background: linear-gradient(
              135deg,
              color-mix(in oklab, var(--primary) 18%, transparent),
              color-mix(in oklab, var(--bg) 88%, transparent)
            );
            border-color: color-mix(in oklab, var(--primary) 30%, var(--border));
            box-shadow: 0 10px 22px color-mix(in oklab, var(--primary) 10%, transparent);
          }

          .admin-link {
            margin-top: 2px;
          }

          .link-icon {
            width: 38px;
            height: 38px;
            border-radius: 12px;
            display: grid;
            place-items: center;
            flex-shrink: 0;
            color: inherit;
            background: color-mix(in oklab, var(--bg) 72%, var(--primary) 28% / 8%);
            border: 1px solid color-mix(in oklab, var(--border) 84%, transparent);
          }

          .link-copy {
            min-width: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 2px;
          }

          .link-label {
            font-size: 13px;
            font-weight: 700;
            line-height: 1.2;
            letter-spacing: -0.02em;
            color: inherit;
          }

          .link-hint {
            font-size: 11px;
            line-height: 1.25;
            color: var(--muted);
            white-space: normal;
          }

          .sidebar-link.active .link-hint {
            color: color-mix(in oklab, var(--muted) 72%, var(--text));
          }

          .kitchen-section {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid color-mix(in oklab, var(--border) 84%, transparent);
            margin-bottom: 12px;
          }

          .kitchen-item,
          .footer-link {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 9px 10px;
            border-radius: 14px;
            color: color-mix(in oklab, var(--text) 76%, var(--muted));
            text-decoration: none;
            font-size: 12.5px;
            font-weight: 600;
            border: 1px solid transparent;
            transition: 0.16s ease;
          }

          .kitchen-item:hover,
          .footer-link:hover {
            color: var(--text);
            background: color-mix(in oklab, var(--bg) 76%, var(--primary) 24% / 10%);
            border-color: color-mix(in oklab, var(--border) 72%, var(--primary) 28%);
          }

          .kitchen-text {
            flex: 1;
            line-height: 1.2;
          }

          .kitchen-count {
            min-width: 28px;
            text-align: center;
            padding: 3px 8px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 800;
            color: var(--text);
            background: color-mix(in oklab, var(--primary) 12%, transparent);
            border: 1px solid color-mix(in oklab, var(--border) 68%, var(--primary) 32%);
          }

          .sidebar-footer {
            margin-top: auto;
            padding-top: 12px;
            border-top: 1px solid color-mix(in oklab, var(--border) 84%, transparent);
          }

          .footer-title {
            padding-bottom: 10px;
          }

          @media (max-width: 768px) {
            .sidebar-backdrop {
              display: block;
              position: fixed;
              inset: 0;
              border: 0;
              padding: 0;
              background: rgba(2, 6, 23, 0.5);
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
              width: min(86vw, 320px);
              transform: translateX(calc(-100% - 22px));
              transition: transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
            }

            .ck-sidebar.mobile-open {
              transform: translateX(0);
            }

            .mobile-close {
              display: grid;
            }

            .sidebar-link:hover,
            .kitchen-item:hover,
            .footer-link:hover {
              transform: none;
            }
          }
        `}</style>
      </aside>
    </>
  );
}
