"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { ChevronDown, LogOut, Menu, Search, X } from "lucide-react";
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
  { prefix: "/meal-plan", label: "Meal Plan" },
  { prefix: "/fitness", label: "Training" },
  { prefix: "/posts", label: "Community" },
  { prefix: "/profile", label: "Profile" },
  { prefix: "/settings", label: "Settings" },
  { prefix: "/privacy", label: "Privacy Policy" },
  { prefix: "/terms", label: "Terms of Service" },
  { prefix: "/support", label: "Help & Support" },
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
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const value = search.trim();
    if (!value) return;
    router.push(`/recipes?q=${encodeURIComponent(value)}`);
    setSearch("");
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
      setMenuOpen(false);
      openLogin(pathname ?? "/");
    } catch {
      // ignore
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
            <Search size={15} />
          </span>
          <input
            type="search"
            className="searchInput"
            placeholder="Search recipes..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search recipes"
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
                  <Link href="/support" role="menuitem" onClick={() => setMenuOpen(false)}>
                    Help &amp; Support
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
          z-index: 80;
          width: 100%;
          padding: 10px 16px 0;
          background: transparent;
        }

        .inner {
          width: min(1120px, 100%);
          min-height: 58px;
          margin: 0 auto;
          padding: 0 4px;
          display: flex;
          align-items: center;
          gap: 14px;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
        }

        .mobileLead {
          display: none;
          align-items: center;
          gap: 12px;
          min-width: 0;
          flex: 1;
        }

        .menuButton {
          width: 40px;
          height: 40px;
          border-radius: 12px;
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
          max-width: 430px;
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
          height: 42px;
          padding: 0 14px 0 38px;
          border-radius: 12px;
          border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
          background: color-mix(in oklab, var(--bg) 76%, transparent);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
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
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 14%, transparent);
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
          min-height: 40px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 10px 4px 4px;
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
          background: color-mix(in oklab, var(--bg) 78%, transparent);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
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
          min-width: 200px;
          padding: 8px;
          border-radius: 16px;
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
          padding: 10px 12px;
          border: 0;
          border-radius: 10px;
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
          .topbar {
            top: 0;
            padding: 8px 12px 0;
          }

          .inner {
            min-height: auto;
            padding: 0;
            flex-wrap: wrap;
            gap: 10px;
          }

          .mobileLead {
            display: flex;
            flex: 1;
            min-width: 0;
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
            height: 42px;
          }
        }
      `}</style>
    </header>
  );
}
