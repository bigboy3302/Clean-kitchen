"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { ChevronDown, LogOut, Menu, X } from "lucide-react";
import clsx from "clsx";
import Avatar from "@/components/ui/Avatar";
import ExpiryBell from "@/components/nav/ExpiryBell";
import { auth } from "@/lib/firebas1e";
import { useAuthModal } from "@/context/AuthModalContext";

const MOBILE_TITLES: Array<{ prefix: string; label: string }> = [
  { prefix: "/", label: "Clean Kitchen" },
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
  if (path === "/") return "Clean Kitchen";
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
  const { openLogin } = useAuthModal();

  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [menuOpen, setMenuOpen] = useState(false);
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
    <header className="ck-topbar">
      <div className="ck-topbar-inner">
        <div className="ck-mobile-lead">
          <button
            type="button"
            className={clsx("ck-menu-button", mobileNavOpen && "hidden")}
            onClick={onOpenMobileNav}
            aria-expanded={mobileNavOpen}
            aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {mobileNavOpen ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
          </button>

          <strong className={clsx("ck-mobile-title", mobileNavOpen && "hidden")}>{pageTitle}</strong>
        </div>

        <div className="ck-topbar-actions">
          <ExpiryBell />

          <div className="ck-profile-wrap" ref={menuRef}>
            {user ? (
              <>
                <button
                  type="button"
                  className="ck-profile-button"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Account menu"
                >
                  <Avatar src={user.photoURL ?? undefined} name={profileName} size={30} />
                  <span>{profileName}</span>
                  <ChevronDown size={13} aria-hidden />
                </button>

                <div className={clsx("ck-profile-menu", menuOpen && "open")} role="menu">
                  <Link href="/profile" role="menuitem" onClick={() => setMenuOpen(false)}>Profile</Link>
                  <Link href="/settings" role="menuitem" onClick={() => setMenuOpen(false)}>Settings</Link>
                  <Link href="/support" role="menuitem" onClick={() => setMenuOpen(false)}>Help &amp; Support</Link>
                  <button type="button" role="menuitem" onClick={handleSignOut}>
                    <LogOut size={13} aria-hidden /> Sign out
                  </button>
                </div>
              </>
            ) : (
              <button type="button" className="ck-profile-button signin" onClick={() => openLogin(pathname ?? "/")}>
                Sign in
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .ck-topbar {
          position: sticky;
          top: 0;
          z-index: 60;
          padding: 14px 22px 0;
          background: transparent;
        }

        .ck-topbar-inner {
          min-height: 50px;
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
        }

        .ck-mobile-lead {
          display: none;
          align-items: center;
          gap: 12px;
          min-width: 0;
          flex: 1;
        }

        .ck-menu-button,
        .ck-profile-button {
          border: 0;
          background: rgba(255, 255, 255, 0.68);
          color: #171915;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 10px 30px rgba(39,31,18,0.06);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .ck-menu-button {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          cursor: pointer;
          flex-shrink: 0;
        }

        .ck-mobile-title {
          font-size: 15px;
          line-height: 1.1;
          color: #171915;
          letter-spacing: -0.03em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .hidden { visibility: hidden; }

        .ck-topbar-actions {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .ck-profile-wrap { position: relative; }

        .ck-profile-button {
          min-height: 42px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 5px 12px 5px 5px;
          border-radius: 999px;
          font: inherit;
          font-size: 13px;
          font-weight: 850;
          cursor: pointer;
        }

        .ck-profile-button.signin { padding: 0 16px; }

        .ck-profile-button span {
          max-width: 130px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ck-profile-menu {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          min-width: 210px;
          padding: 8px;
          border-radius: 18px;
          background: #fffdf8;
          box-shadow: 0 24px 70px rgba(39,31,18,0.16);
          display: grid;
          gap: 3px;
          opacity: 0;
          pointer-events: none;
          transform: translateY(-6px);
          transition: opacity 0.16s ease, transform 0.16s ease;
        }

        .ck-profile-menu.open {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }

        .ck-profile-menu a,
        .ck-profile-menu button {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border: 0;
          border-radius: 12px;
          background: transparent;
          color: #171915;
          text-decoration: none;
          font: inherit;
          font-size: 13px;
          font-weight: 750;
          text-align: left;
          cursor: pointer;
        }

        .ck-profile-menu a:hover,
        .ck-profile-menu button:hover { background: rgba(216,255,61,0.18); }

        @media (max-width: 900px) {
          .ck-topbar { padding: 10px 12px 0; }
          .ck-topbar-inner { flex-wrap: wrap; min-height: auto; gap: 8px; }
          .ck-mobile-lead { display: flex; order: 1; }
          .ck-topbar-actions { order: 2; gap: 8px; }
          .ck-profile-button span { display: none; }
        }
      `}</style>
    </header>
  );
}
