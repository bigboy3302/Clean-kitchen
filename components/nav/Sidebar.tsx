"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Bookmark,
  Boxes,
  Dumbbell,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Plus,
  Settings,
  Shield,
  UtensilsCrossed,
  Users,
  X,
  ScrollText,
  Mail,
  BookOpen,
} from "lucide-react";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebas1e";
import { useAuthModal } from "@/context/AuthModalContext";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", hint: "Overview and quick actions", Icon: LayoutDashboard },
  { href: "/pantry", label: "Pantry", hint: "Stock, expiry, and tracking", Icon: Boxes },
  { href: "/recipes", label: "Recipes", hint: "Cook, save, and create", Icon: BookOpen },
  { href: "/saved", label: "Saved", hint: "Shortlisted meals", Icon: Bookmark },
  { href: "/meal-plan", label: "Meal Plan", hint: "Weekly structure", Icon: UtensilsCrossed },
  { href: "/fitness", label: "Training", hint: "Workouts and progress", Icon: Dumbbell },
  { href: "/posts", label: "Community", hint: "Tips and updates", Icon: Users },
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
  const router = useRouter();
  const { openRegister } = useAuthModal();

  const [uid, setUid] = useState<string | null>(null);
  const [myRecipesCount, setMyRecipesCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [pantryCount, setPantryCount] = useState(0);

  useEffect(() => onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null)), []);

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
                  <Icon size={17} strokeWidth={1.6} aria-hidden />
                </span>
                <span className="link-label">{label}</span>
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
            Add New Recipe
          </button>
        ) : null}

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
            width: 264px;
            height: 100dvh;
            position: fixed;
            top: 0;
            left: 0;
            display: flex;
            flex-direction: column;
            padding: 16px 12px;
            background: var(--bg-raised);
            border-right: 1px solid var(--border);
            overflow-y: auto;
            z-index: 70;
            scrollbar-width: none;
            color: var(--text);
          }

          .ck-sidebar::-webkit-scrollbar {
            display: none;
          }

          .sidebar-backdrop {
            display: none;
          }

          .sidebar-brand {
            padding: 6px 4px 16px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            border-bottom: 1px solid var(--border);
          }

          .brand-link {
            display: flex;
            align-items: center;
            gap: 10px;
            text-decoration: none;
            color: var(--text);
            min-width: 0;
          }

          .brand-link:hover {
            text-decoration: none;
          }

          .brand-icon {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            background: var(--primary);
            display: grid;
            place-items: center;
            overflow: hidden;
            flex-shrink: 0;
          }

          .brand-logo {
            width: 20px;
            height: 20px;
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
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.18em;
            color: var(--muted);
          }

          .brand-name {
            font-size: 15px;
            font-weight: 700;
            letter-spacing: -0.03em;
            color: var(--text);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .mobile-close {
            display: none;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            border: 1px solid var(--border);
            background: transparent;
            color: var(--muted);
            place-items: center;
            cursor: pointer;
            flex-shrink: 0;
          }

          .mobile-close:hover {
            color: var(--text);
            background: color-mix(in oklab, var(--border) 60%, transparent);
          }

          .sidebar-nav,
          .kitchen-section,
          .sidebar-footer {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .nav-section-label,
          .kitchen-label {
            padding: 0 8px 6px;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--muted);
          }

          .sidebar-link {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 9px 10px;
            border-radius: 8px;
            color: var(--muted);
            text-decoration: none;
            transition: background 0.12s ease, color 0.12s ease;
          }

          .sidebar-link:hover {
            color: var(--text);
            background: color-mix(in oklab, var(--border) 70%, transparent);
            text-decoration: none;
          }

          .sidebar-link.active {
            color: var(--primary);
            background: color-mix(in oklab, var(--primary) 10%, transparent);
          }

          .link-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            color: inherit;
            width: 20px;
          }

          .link-label {
            font-size: 14px;
            font-weight: 500;
            line-height: 1.25;
            letter-spacing: -0.015em;
            color: inherit;
          }

          .sidebar-link.active .link-label {
            font-weight: 600;
          }

          .kitchen-section {
            margin-top: 14px;
            padding-top: 14px;
            border-top: 1px solid var(--border);
            margin-bottom: 12px;
          }

          .kitchen-item,
          .footer-link {
            display: flex;
            align-items: center;
            gap: 9px;
            padding: 8px 10px;
            border-radius: 8px;
            color: var(--muted);
            text-decoration: none;
            font-size: 12.5px;
            font-weight: 500;
            transition: background 0.12s ease, color 0.12s ease;
          }

          .kitchen-item :global(span:nth-child(2)),
          .footer-link :global(span:last-child) {
            line-height: 1.2;
          }

          .kitchen-item:hover,
          .footer-link:hover {
            color: var(--text);
            background: color-mix(in oklab, var(--border) 70%, transparent);
            text-decoration: none;
          }

          .kitchen-item span:nth-child(2) {
            flex: 1;
            font-size: 12.5px;
            line-height: 1.2;
          }

          .kitchen-count {
            min-width: 22px;
            text-align: center;
            padding: 1px 6px;
            border-radius: 999px;
            font-size: 10.5px;
            font-weight: 600;
            color: var(--muted);
            background: color-mix(in oklab, var(--border) 80%, transparent);
          }

          .create-recipe-btn {
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            width: 100%;
            padding: 10px 16px;
            border: none;
            border-radius: 8px;
            font: inherit;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            color: var(--primary-contrast);
            background: var(--primary);
            transition: filter 0.12s ease;
          }

          .create-recipe-btn:hover {
            filter: brightness(1.06);
          }

          .sidebar-footer {
            margin-top: auto;
            padding-top: 12px;
            border-top: 1px solid var(--border);
          }

          .footer-title {
            padding-bottom: 6px;
          }

          .footer-link span {
            line-height: 1.2;
          }

          @media (max-width: 768px) {
            .sidebar-backdrop {
              display: block;
              position: fixed;
              inset: 0;
              border: 0;
              padding: 0;
              background: rgba(2, 6, 23, 0.48);
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
              width: min(86vw, 300px);
              transform: translateX(calc(-100% - 22px));
              transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
            }

            .ck-sidebar.mobile-open {
              transform: translateX(0);
            }

            .mobile-close {
              display: grid;
            }

            .link-hint {
              white-space: normal;
            }
          }
        `}</style>
      </aside>
    </>
  );
}
