// components/auth/AuthGate.tsx
"use client";
import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebas1e";

export default function AuthGate({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [banned, setBanned] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const snap = await getDoc(doc(db, "userModeration", user.uid));
          if (snap.exists()) {
            const data = snap.data() as { active?: boolean; type?: string };
            if (data.active && data.type === "ban") {
              await signOut(auth);
              setBanned(true);
              setReady(true);
              return;
            }
          }
        } catch {
          // if we can't read moderation, let them through — don't lock out on errors
        }
      }
      setBanned(false);
      setReady(true);
    });
  }, []);

  if (banned) {
    return (
      <div style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100vh",
        padding: "24px",
        fontFamily: "sans-serif",
      }}>
        <div style={{
          maxWidth: 420,
          textAlign: "center",
          border: "1px solid #fecaca",
          borderRadius: 16,
          padding: "32px 24px",
          background: "#fef2f2",
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚫</div>
          <h2 style={{ margin: "0 0 8px", color: "#7f1d1d", fontSize: 20, fontWeight: 800 }}>
            Account banned
          </h2>
          <p style={{ margin: 0, color: "#991b1b", fontSize: 14 }}>
            Your account has been banned. If you think this is a mistake, contact support.
          </p>
        </div>
      </div>
    );
  }

  const isPublic =
    pathname.startsWith("/recipes/ext") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth/");
  if (isPublic) return <>{children}</>;
  return ready ? <>{children}</> : <>{fallback}</>;
}
