"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { ChevronDown, LogOut, Menu, X } from "lucide-react";
import clsx from "clsx";
import Avatar from "@/components/ui/Avatar";
import ExpiryBell from "@/components/nav/ExpiryBell";
import { auth } from "@/lib/firebas1e";
import { useAuthModal } from "@/context/AuthModalContext";

const MOBILE_TITLES: Array<{ prefix: string; label: string }> = [
  { prefix: "/dashboard", label: "Dashboard" },
  { prefix: "/pantry", label: "Pantry" },
  { prefix: "/recipes", label: "Recipes" },
  { prefix: "/saved", label: "Saved" },
  { prefix: "/fitness", label: "Fitness" },
  { prefix: "/posts", label: "Community" },
  { prefix: "/profile", label: "Profile" },
  { prefix: "/settings", label: "Settings" },
];

function getPageTitle(pathname: string | null) {
  const path = pathname ?? "/";
  const match = MOBILE_TITLES.find((entry) => path === entry.prefix || path.startsWith(`${entry.prefix}/`));
  return match?.label ?? "Clean Kitchen";
}

export default function TopBar({
  mobileNavOpen = false,
  onOpenMobileNav,
}: {
  mobileNavOpen?: boolean;
  onOpenMobileNav?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { openLogin } = useAuthModal();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => onAuthStateChanged(auth, (nextUser) => setUser(nextUser)), []);

  useEffect(() => {
    if (!menuOpen) return;

    function handleClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }

    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!search.trim()) return;
    router.push(`/recipes?q=${encodeURIComponent(search.trim())}`);
    setSearch("");
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
      setMenuOpen(false);
      openLogin(pathname ?? "/");
    } catch {
      // no-op
    }
  }

  const profileName = user?.displayName || user?.email?.split("@")[0] || "Account";
  const pageTitle = getPageTitle(pathname);

  return (
    <header className="topbar">
      <div className="inner">
        <div className="mobileLead">
          <button
            type="button"
            className={clsx("menuButton", mobileNavOpen && "open")}
            onClick={onOpenMobileNav}
            aria-expanded={mobileNavOpen}
            aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {mobileNavOpen ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
          </button>
          <strong className="mobileTitle">{pageTitle}</strong>
        </div>

        <form className="search" onSubmit={handleSearch} role="search">
          <span className="searchIcon" aria-hidden>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="search"
            className="searchInput"
            placeholder="Search recipes, ingredients, or people..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search recipes, ingredients, or people"
          />
        </form>

        <div className="actions">
          <ExpiryBell />

          <div className="profileWrap" ref={menuRef}>
            {user ? (
              <>
                <button
                  type="button"
                  className="profileButton"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Account menu"
                >
                  <Avatar src={user.photoURL ?? undefined} name={profileName} size={30} />
                  <span className="profileName">{profileName}</span>
                  <ChevronDown size={13} aria-hidden />
                </button>

                <div className={clsx("profileMenu", menuOpen && "open")} role="menu">
                  <Link href="/profile" role="menuitem" onClick={() => setMenuOpen(false)}>
                    Profile
                  </Link>
                  <Link href="/settings" role="menuitem" onClick={() => setMenuOpen(false)}>
                    Settings
                  </Link>
                  <button type="button" role="menuitem" onClick={handleSignOut}>
                    <LogOut size={13} aria-hidden /> Sign out
                  </button>
                </div>
              </>
            ) : (
              <button type="button" className="profileButton" onClick={() => openLogin(pathname ?? "/")}>
                Sign in
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .topbar {
          position: sticky;
          top: 0;
          z-index: 40;
          border-bottom: 1px solid var(--border);
          background: var(--bg);
        }
        .inner {
          width: min(1100px, 100%);
          min-height: 60px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .mobileLead {
          display: none;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .menuButton {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--bg-raised);
          color: var(--text);
          display: grid;
          place-items: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .mobileTitle {
          font-size: 15px;
          line-height: 1.1;
          color: var(--text);
          letter-spacing: -0.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .search {
          position: relative;
          flex: 1;
          max-width: 420px;
        }
        .searchIcon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--muted);
          pointer-events: none;
        }
        .searchInput {
          width: 100%;
          height: 38px;
          padding: 0 14px 0 36px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--bg-raised);
          color: var(--text);
          font: inherit;
          font-size: 13px;
          outline: none;
        }
        .searchInput::placeholder {
          color: var(--muted);
        }
        .searchInput:focus {
          border-color: color-mix(in oklab, var(--primary) 45%, var(--border));
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 12%, transparent);
        }
        .actions {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .profileWrap {
          position: relative;
        }
        .profileButton {
          min-height: 38px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 10px 4px 4px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--bg-raised);
          color: var(--text);
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .profileName {
          max-width: 130px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .profileMenu {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          min-width: 180px;
          padding: 8px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--bg-raised);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.22);
          display: grid;
          gap: 3px;
          opacity: 0;
          pointer-events: none;
          transform: translateY(-6px);
          transition: opacity 0.16s ease, transform 0.16s ease;
        }
        .profileMenu.open {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }
        .profileMenu :global(a),
        .profileMenu button {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border: 0;
          border-radius: 9px;
          background: transparent;
          color: var(--text);
          text-decoration: none;
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          text-align: left;
          cursor: pointer;
        }
        .profileMenu :global(a):hover,
        .profileMenu button:hover {
          background: color-mix(in oklab, var(--primary) 8%, transparent);
        }

        @media (max-width: 768px) {
          .inner {
            min-height: auto;
            padding: 10px 16px;
            flex-wrap: wrap;
            gap: 10px;
          }
          .mobileLead {
            display: flex;
            flex: 1;
          }
          .search {
            order: 3;
            flex-basis: 100%;
            max-width: none;
          }
          .actions {
            margin-left: 0;
            gap: 8px;
          }
          .profileName {
            display: none;
          }
          .searchInput {
            height: 40px;
          }
        }
      `}</style>
    </header>
  );
}
