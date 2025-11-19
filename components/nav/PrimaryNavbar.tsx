"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Boxes,
  Dumbbell,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import ExpiryBell from "@/components/nav/ExpiryBell";
import Avatar from "@/components/ui/Avatar";
import { auth } from "@/lib/firebas1e";

type LinkItem = {
  href: string;
  label: string;
  description: string;
  Icon: LucideIcon;
};

const primaryLinks: LinkItem[] = [
  { href: "/dashboard", label: "Dashboard", description: "Today", Icon: LayoutDashboard },
  { href: "/pantry", label: "Pantry", description: "Inventory", Icon: Boxes },
  { href: "/recipes", label: "Recipes", description: "Ideas", Icon: BookOpen },
  { href: "/fitness", label: "Fitness", description: "Training", Icon: Dumbbell },
];

export default function PrimaryNavbar() {
  const pathname = usePathname();
  const today = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      }).format(new Date());
    } catch {
      return "";
    }
  }, []);

  const [user, setUser] = useState<User | null>(auth.currentUser);
  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    }
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  async function handleSignOut() {
    try {
      await signOut(auth);
      setMenuOpen(false);
      router.replace("/auth/login");
    } catch (error) {
      console.error("Sign out failed", error);
    }
  }

  const profileName = user?.displayName || user?.email || "Account";
  const profileInitial = profileName.slice(0, 1);

  // --- scroll-based show/hide logic ---
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      const currentY = window.scrollY;

      // Always show when near the top
      if (currentY < 64) {
        setIsHidden(false);
        lastScrollY.current = currentY;
        return;
      }

      const diff = currentY - lastScrollY.current;

      // Small threshold to avoid flicker
      if (Math.abs(diff) < 5) return;

      if (diff > 0) {
        // scrolling down -> hide
        setIsHidden(true);
      } else {
        // scrolling up -> show
        setIsHidden(false);
      }

      lastScrollY.current = currentY;
    };

    const options: AddEventListenerOptions = { passive: true };
    window.addEventListener("scroll", handleScroll, options);
    return () => {
      window.removeEventListener("scroll", handleScroll, options);
    };
  }, []);

  return (
    <header
      className={clsx("ck-navbar", isHidden && "navHidden")}
      data-modern-nav
    >
      <div className="nav-shell">
        <div className="brandRow">
          <Link href="/dashboard" className="brand" aria-label="Clean Kitchen home">
            <span className="brandMark">CK</span>
            <span className="brandCopy">
              <strong>Clean Kitchen</strong>
              <span>{today}</span>
            </span>
          </Link>
        </div>

        <div className="navGrid">
          <nav className="linkShelf" aria-label="Primary">
            {primaryLinks.map(({ href, label, description, Icon }) => {
              const active =
                pathname === href ||
                (href !== "/dashboard" && pathname?.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx("navLinkChip", active && "active")}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="chipIcon">
                    <Icon strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className="chipText">
                    <span className="chipLabel">{label}</span>
                    <span className="chipDesc">{description}</span>
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="actionRail">
            <div className="quickActions" role="group" aria-label="Quick actions">
              {/* empty for now – no extra buttons per your request */}
            </div>

            <ExpiryBell />

            <div className="profileMenu" ref={menuRef}>
              {user ? (
                <>
                  <button
                    type="button"
                    className="profileBtn"
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                  >
                    <Avatar
                      src={user.photoURL ?? undefined}
                      name={profileName}
                      size={36}
                    />
                    <span className="profileName">{profileName}</span>
                  </button>
                  <div
                    className={clsx("profilePanel", menuOpen && "open")}
                    role="menu"
                  >
                    <Link
                      href="/profile"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                    >
                      Profile
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleSignOut}
                    >
                      <LogOut size={14} aria-hidden />
                      Sign out
                    </button>
                  </div>
                </>
              ) : (
                <Link href="/auth/login" className="profileBtn ghost">
                  <span className="profileAvatar ph">{profileInitial}</span>
                  <span className="profileName">Sign in</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .ck-navbar {
          position: sticky;
          top: 0;
          z-index: 95;
          padding: 10px 0 8px;
          background: linear-gradient(
            180deg,
            rgba(12, 18, 35, 0.45),
            rgba(12, 18, 35, 0.02)
          );
          backdrop-filter: blur(18px);
          transform: translateY(0);
          transition: transform 0.2s ease-out;
        }

        /* HIDE on scroll down */
        .ck-navbar.navHidden {
          transform: translateY(-120%);
        }

        .nav-shell {
          width: min(1120px, 100% - 24px);
          margin: 0 auto;
          padding: 14px 18px 16px;
          background: color-mix(in oklab, var(--bg2) 90%, transparent);
          border: 1px solid
            color-mix(in oklab, var(--border) 72%, transparent);
          border-radius: 20px;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
          display: grid;
          gap: 14px;
        }

        .brandRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          color: inherit;
          text-decoration: none;
        }

        .brandMark {
          width: 40px;
          height: 40px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background: var(--text);
          color: var(--bg);
          font-weight: 800;
          letter-spacing: 0.08em;
          font-size: 12px;
        }

        .brandCopy {
          display: grid;
          gap: 0;
          font-size: 13px;
          color: var(--muted);
        }

        .brandCopy strong {
          font-size: 16px;
          color: var(--text);
          letter-spacing: 0.01em;
        }

        .navGrid {
          display: grid;
          grid-template-columns: minmax(0, 2fr) minmax(0, auto);
          gap: 16px;
          align-items: center;
        }

        .linkShelf {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .navLinkChip {
          flex: 1 1 0;
          min-width: 150px;
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 8px;
          align-items: center;
          padding: 10px 12px;
          border-radius: 16px;
          border: 1px solid
            color-mix(in oklab, var(--border) 80%, transparent);
          color: var(--text);
          background: linear-gradient(
            180deg,
            color-mix(in oklab, var(--bg2) 96%, transparent),
            color-mix(in oklab, var(--bg2) 82%, transparent)
          );
          text-decoration: none;
          transition: border-color 0.2s ease, transform 0.12s ease,
            box-shadow 0.2s ease, background 0.2s ease;
        }

        .navLinkChip:hover {
          border-color: color-mix(
            in oklab,
            var(--primary) 32%,
            var(--border)
          );
          transform: translateY(-1px);
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.1);
        }

        .navLinkChip.active {
          border-color: color-mix(
            in oklab,
            var(--primary) 60%,
            var(--border)
          );
          box-shadow: 0 14px 32px
            color-mix(in oklab, var(--primary) 18%, transparent);
          background: linear-gradient(
            180deg,
            color-mix(in oklab, var(--primary) 12%, var(--bg2)),
            color-mix(in oklab, var(--primary) 5%, var(--bg2))
          );
        }

        .chipIcon {
          width: 32px;
          height: 32px;
          border-radius: 12px;
          background: color-mix(
            in oklab,
            var(--primary) 18%,
            transparent
          );
          display: grid;
          place-items: center;
          color: var(--primary);
        }

        .chipIcon :global(svg) {
          width: 18px;
          height: 18px;
        }

        .chipText {
          display: grid;
        }

        .chipLabel {
          font-weight: 700;
          font-size: 14px;
          color: var(--text);
        }

        .chipDesc {
          font-size: 12px;
          color: var(--muted);
        }

        .fabSlot {
          display: grid;
          place-items: center;
        }

        .actionRail {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }

        .quickActions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .navButton {
          border-radius: 14px;
          border: 1px solid
            color-mix(in oklab, var(--border) 70%, transparent);
          background: color-mix(
            in oklab,
            var(--bg2) 92%,
            transparent
          );
          color: var(--text);
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: transform 0.1s ease, box-shadow 0.2s ease,
            background 0.15s ease;
        }

        .navButton:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.12);
        }

        .profileMenu {
          position: relative;
        }

        .profileBtn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 5px 10px;
          border-radius: 999px;
          border: 1px solid
            color-mix(in oklab, var(--border) 70%, transparent);
          background: color-mix(
            in oklab,
            var(--bg2) 92%,
            transparent
          );
          font-weight: 600;
          cursor: pointer;
        }

        .profileBtn.ghost {
          border-radius: 14px;
        }

        .profileBtn :global(.ui-avatar) {
          border: 0;
        }

        .profileAvatar.ph {
          width: 32px;
          height: 32px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: var(--primary);
          color: var(--primary-contrast);
          font-weight: 700;
        }

        .profileName {
          font-size: 13px;
          color: var(--text);
        }

        .profilePanel {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          min-width: 180px;
          padding: 10px;
          border-radius: 16px;
          border: 1px solid var(--border);
          background: var(--bg2);
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.16);
          display: grid;
          gap: 6px;
          opacity: 0;
          pointer-events: none;
          transform: translateY(-4px);
          transition: opacity 0.18s ease, transform 0.18s ease;
          z-index: 50;
        }

        .profilePanel.open {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }

        .profilePanel a,
        .profilePanel button {
          border: 0;
          background: transparent;
          padding: 8px 10px;
          border-radius: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text);
          text-decoration: none;
          cursor: pointer;
        }

        .profilePanel a:hover,
        .profilePanel button:hover {
          background: color-mix(
            in oklab,
            var(--bg2) 88%,
            var(--primary) 12%
          );
        }

        @media (max-width: 1024px) {
          .nav-shell {
            padding: 12px 12px 14px;
          }

          .navGrid {
            grid-template-columns: 1fr;
          }

          .actionRail {
            justify-content: space-between;
          }
        }

        @media (max-width: 768px) {
          .brandRow {
            flex-direction: row;
            align-items: center;
          }

          .nav-shell {
            border-radius: 0;
            width: 100%;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.2);
          }

          .linkShelf {
            gap: 8px;
          }

          .navLinkChip {
            min-width: calc(50% - 6px);
          }

          .profileName {
            display: none;
          }
        }
      `}</style>
    </header>
  );
}
