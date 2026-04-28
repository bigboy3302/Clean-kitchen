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
  Mail,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ScrollText,
  UtensilsCrossed,
  Users,
  X,
  BookOpen,
} from "lucide-react";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebas1e";
import { isAdminUid } from "@/lib/admin";
import RecipeSearchModal from "@/components/search/RecipeSearchModal";

const navLinks = [
  { href: "/dashboard", label: "Home", hint: "Overview", Icon: LayoutDashboard },
  { href: "/recipes", label: "Recipes", hint: "Cook ideas", Icon: BookOpen },
  { href: "/pantry", label: "Pantry", hint: "Ingredients", Icon: Boxes },
  { href: "/saved", label: "Favorites", hint: "Saved picks", Icon: Bookmark },
  { href: "/meal-plan", label: "Meal Plan", hint: "Weekly plan", Icon: UtensilsCrossed },
  { href: "/fitness", label: "Training", hint: "Goals", Icon: Dumbbell },
  { href: "/posts", label: "Community", hint: "People", Icon: Users },
];

const supportLinks = [
  { href: "/support", label: "Help", Icon: HelpCircle },
  { href: "/settings", label: "Settings", Icon: Settings },
  { href: "/privacy", label: "Privacy", Icon: Shield },
  { href: "/terms", label: "Terms", Icon: ScrollText },
  { href: "mailto:adriansraitums95@gmail.com", label: "Contact", Icon: Mail, external: true },
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
  const [searchOpen, setSearchOpen] = useState(false);

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

  function openSearch() {
    onRequestClose?.();
    setSearchOpen(true);
  }

  return (
    <>
      <button
        type="button"
        className={clsx("ck-sidebar-backdrop", mobileOpen && "open")}
        onClick={onRequestClose}
        aria-label="Close navigation drawer"
      />

      <aside className={clsx("ck-sidebar", mobileOpen && "mobile-open")}> 
        <div className="ck-sidebar-bg" aria-hidden />

        <div className="ck-sidebar-scroll">
          <div className="ck-sidebar-brand">
            <Link href="/dashboard" className="ck-brand-link" onClick={onRequestClose} aria-label="Clean Kitchen home">
              <span className="ck-brand-logo-box">
                <Image src="/logo.png" alt="" width={22} height={22} className="ck-brand-logo" />
              </span>
              <span className="ck-brand-text">Clean Kitchen</span>
            </Link>

            <button type="button" className="ck-mobile-close" onClick={onRequestClose} aria-label="Close navigation">
              <X size={18} />
            </button>
          </div>

          <div className="ck-brand-hero">
            <h2>
              Cook
              <br />
              <em>smarter</em>
            </h2>
            <span />
          </div>

          <button type="button" className="ck-sidebar-search" onClick={openSearch} aria-label="Search recipes">
            <Search size={18} />
            <span>Search recipes, ingredients...</span>
          </button>

          <nav className="ck-sidebar-nav" aria-label="Primary navigation">
            {navLinks.map(({ href, label, hint, Icon }) => {
              const active = pathname === href || (href !== "/dashboard" && pathname?.startsWith(href));

              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx("ck-sidebar-link", active && "active")}
                  aria-current={active ? "page" : undefined}
                  onClick={onRequestClose}
                >
                  {active && <span className="ck-active-bar" aria-hidden />}
                  <Icon size={22} strokeWidth={1.9} />
                  <span className="ck-link-copy">
                    <strong>{label}</strong>
                    <small>{hint}</small>
                  </span>
                </Link>
              );
            })}

            {isAdmin && (
              <Link
                href="/admin"
                className={clsx("ck-sidebar-link", "ck-admin-link", pathname?.startsWith("/admin") && "active")}
                onClick={onRequestClose}
              >
                {pathname?.startsWith("/admin") && <span className="ck-active-bar" aria-hidden />}
                <ShieldAlert size={22} strokeWidth={1.9} />
                <span className="ck-link-copy">
                  <strong>Admin</strong>
                  <small>Controls</small>
                </span>
              </Link>
            )}
          </nav>

          <section className="ck-collections">
            <h3>Library</h3>

            <Link href="/recipes" className="ck-collection-item" onClick={onRequestClose}>
              <FileText size={15} aria-hidden />
              <span>My Recipes</span>
              <b>{myRecipesCount}</b>
            </Link>

            <Link href="/saved" className="ck-collection-item" onClick={onRequestClose}>
              <Bookmark size={15} aria-hidden />
              <span>Saved Recipes</span>
              <b>{savedCount}</b>
            </Link>

            <Link href="/pantry" className="ck-collection-item" onClick={onRequestClose}>
              <Boxes size={15} aria-hidden />
              <span>Pantry Items</span>
              <b>{pantryCount}</b>
            </Link>
          </section>
        </div>

        <div className="ck-sidebar-bottom">
          <div className="ck-footer-links">
            {supportLinks.map(({ href, label, Icon, external }) => (
              <Link
                key={href}
                href={href}
                className="ck-footer-link"
                onClick={onRequestClose}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
              >
                <Icon size={16} />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </aside>

      <RecipeSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      <style jsx global>{`
        .ck-sidebar {
          width: 324px;
          height: 100dvh;
          position: fixed;
          inset: 0 auto 0 0;
          z-index: 70;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 30px 26px 22px;
          color: color-mix(in oklab, var(--text) 12%, white 88%);
          background: color-mix(in oklab, var(--bg) 82%, black 18%);
          box-shadow: 24px 0 80px rgba(0, 0, 0, 0.35);
        }

        .ck-sidebar-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 8% 3%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 28%),
            radial-gradient(circle at 0% 54%, color-mix(in oklab, var(--ring) 20%, transparent), transparent 36%),
            linear-gradient(90deg, rgba(255, 255, 255, 0.045), transparent 22%),
            linear-gradient(180deg, color-mix(in oklab, var(--bg) 62%, black 38%), color-mix(in oklab, var(--bg) 78%, black 22%));
        }

        .ck-sidebar-backdrop { display: none; }

        .ck-sidebar-scroll {
          position: relative;
          z-index: 1;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding-right: 2px;
          scrollbar-width: none;
        }

        .ck-sidebar-scroll::-webkit-scrollbar { display: none; }

        .ck-sidebar-brand {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 34px;
        }

        .ck-brand-link {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          color: #fff;
          text-decoration: none;
        }

        .ck-brand-link:hover { text-decoration: none; }

        .ck-brand-logo-box {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 14px;
          background: var(--primary);
          color: var(--primary-contrast);
          box-shadow: 0 16px 40px color-mix(in oklab, var(--primary) 24%, transparent);
          overflow: hidden;
        }

        .ck-brand-logo {
          width: 23px;
          height: 23px;
          object-fit: contain;
        }

        .ck-brand-text {
          font-size: 20px;
          font-weight: 760;
          letter-spacing: -0.045em;
          white-space: nowrap;
        }

        .ck-mobile-close {
          display: none;
          width: 38px;
          height: 38px;
          border: 0;
          border-radius: 14px;
          place-items: center;
          color: rgba(255, 255, 255, 0.72);
          background: rgba(255, 255, 255, 0.07);
          cursor: pointer;
        }

        .ck-brand-hero { margin-bottom: 28px; }

        .ck-brand-hero h2 {
          margin: 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 54px;
          line-height: 0.88;
          letter-spacing: -0.075em;
          font-weight: 500;
          color: #fff;
        }

        .ck-brand-hero em {
          color: var(--primary);
          font-style: italic;
        }

        .ck-brand-hero span {
          display: block;
          width: 82px;
          height: 3px;
          margin-top: 17px;
          border-radius: 999px;
          background: var(--primary);
          box-shadow: 0 0 22px color-mix(in oklab, var(--primary) 55%, transparent);
        }

        .ck-sidebar-search {
          width: 100%;
          min-height: 56px;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 30px;
          padding: 0 16px;
          border: 0;
          border-radius: 18px;
          color: rgba(255, 255, 255, 0.68);
          background: rgba(255, 255, 255, 0.085);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
          text-decoration: none;
          transition: background 0.18s ease, transform 0.18s ease, color 0.18s ease;
          cursor: pointer;
          text-align: left;
          font: inherit;
        }

        .ck-sidebar-search:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.12);
          transform: translateY(-1px);
        }

        .ck-sidebar-search span {
          min-width: 0;
          font-size: 15px;
          font-weight: 650;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .ck-sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 30px;
        }

        .ck-sidebar-link {
          position: relative;
          min-height: 56px;
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 10px 16px;
          border-radius: 18px;
          color: rgba(255, 255, 255, 0.76);
          text-decoration: none;
          transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        }

        .ck-sidebar-link:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.055);
          transform: translateX(4px);
          text-decoration: none;
        }

        .ck-sidebar-link.active {
          color: #fff;
          background: rgba(255, 255, 255, 0.105);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 18px 44px rgba(0, 0, 0, 0.22);
        }

        .ck-active-bar {
          position: absolute;
          left: -13px;
          top: 9px;
          bottom: 9px;
          width: 4px;
          border-radius: 999px;
          background: var(--primary);
          box-shadow: 0 0 24px color-mix(in oklab, var(--primary) 75%, transparent);
        }

        .ck-link-copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .ck-sidebar-link strong {
          font-size: 16px;
          font-weight: 760;
          line-height: 1.05;
          letter-spacing: -0.035em;
        }

        .ck-sidebar-link small {
          margin-top: 3px;
          font-size: 11px;
          font-weight: 650;
          color: rgba(255, 255, 255, 0.34);
        }

        .ck-sidebar-link.active small { color: rgba(255, 255, 255, 0.48); }

        .ck-collections { padding: 0 2px 20px; }

        .ck-collections h3 {
          margin: 0 0 15px;
          padding: 0 8px;
          color: var(--primary);
          font-size: 13px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.18em;
        }

        .ck-collection-item {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          padding: 9px 8px;
          border-radius: 12px;
          color: rgba(255, 255, 255, 0.84);
          text-decoration: none;
          font-size: 15px;
          font-weight: 550;
          transition: background 0.18s ease, transform 0.18s ease, color 0.18s ease;
        }

        .ck-collection-item:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.045);
          transform: translateX(3px);
          text-decoration: none;
        }

        .ck-collection-item b {
          font-size: 14px;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.74);
        }

        .ck-sidebar-bottom {
          position: relative;
          z-index: 1;
          flex-shrink: 0;
        }

        .ck-idea-card {
          position: relative;
          display: block;
          min-height: 184px;
          margin-bottom: 20px;
          padding: 20px;
          overflow: hidden;
          border-radius: 20px;
          border: 1px solid color-mix(in oklab, var(--primary) 26%, transparent);
          background:
            radial-gradient(circle at 94% 70%, color-mix(in oklab, var(--primary) 45%, #f0a24b 55%) 0 18%, transparent 19%),
            radial-gradient(circle at 82% 58%, color-mix(in oklab, var(--primary) 65%, #6c9d44 35%) 0 5%, transparent 6%),
            linear-gradient(135deg, color-mix(in oklab, var(--primary) 10%, transparent), rgba(255, 255, 255, 0.035)),
            color-mix(in oklab, var(--bg) 72%, black 28%);
          color: #fff;
          text-decoration: none;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }

        .ck-idea-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 28px 80px rgba(0, 0, 0, 0.34);
          text-decoration: none;
        }

        .ck-idea-shine {
          position: absolute;
          right: -42px;
          bottom: -34px;
          width: 150px;
          height: 150px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          filter: blur(2px);
        }

        .ck-idea-icon {
          position: relative;
          z-index: 1;
          margin-bottom: 18px;
          color: var(--primary);
        }

        .ck-idea-copy {
          position: relative;
          z-index: 1;
          display: block;
          max-width: 160px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 24px;
          line-height: 1.08;
          letter-spacing: -0.06em;
        }

        .ck-idea-button {
          position: relative;
          z-index: 1;
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-top: 18px;
          padding: 11px 15px;
          border-radius: 10px;
          background: var(--primary);
          color: var(--primary-contrast);
          font-size: 14px;
          font-weight: 850;
        }

        .ck-footer-links {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
        }

        .ck-footer-link {
          flex: 1 1 calc(50% - 6px);
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 7px;
          border-radius: 12px;
          color: rgba(255, 255, 255, 0.66);
          text-decoration: none;
          font-size: 12px;
          font-weight: 750;
          transition: background 0.18s ease, color 0.18s ease;
        }

        .ck-footer-link:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.055);
          text-decoration: none;
        }

        .ck-footer-link span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        @media (max-height: 820px) {
          .ck-sidebar { padding-top: 22px; }
          .ck-sidebar-brand { margin-bottom: 22px; }
          .ck-brand-hero { margin-bottom: 20px; }
          .ck-brand-hero h2 { font-size: 44px; }
          .ck-sidebar-search { margin-bottom: 20px; }
          .ck-sidebar-link { min-height: 48px; }
          .ck-sidebar-link small { display: none; }
          .ck-idea-card { min-height: 150px; }
          .ck-idea-copy { font-size: 20px; }
        }

        @media (max-width: 768px) {
          .ck-sidebar-backdrop {
            display: none;
            position: fixed;
            inset: 0;
            z-index: 69;
            border: 0;
            padding: 0;
            margin: 0;
            background: rgba(3, 7, 6, 0.6);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.24s ease;
          }

          .ck-sidebar-backdrop.open {
            display: block;
            opacity: 1;
            pointer-events: auto;
          }

          .ck-sidebar {
            width: min(88vw, 324px);
            transform: translateX(calc(-100% - 28px));
            transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
          }

          .ck-sidebar.mobile-open { transform: translateX(0); }
          .ck-mobile-close { display: grid; }
        }
      `}</style>
    </>
  );
}
