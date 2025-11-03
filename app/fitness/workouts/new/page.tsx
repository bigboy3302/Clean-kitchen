"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebas1e";
import CreateWorkoutForm from "@/components/fitness/CreateWorkoutForm";

export default function NewWorkoutPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (current) => {
      if (current) {
        setUser(current);
        setAuthChecked(true);
      } else {
        setUser(null);
        setAuthChecked(true);
        router.replace("/auth/login?next=/fitness/workouts/new");
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (!authChecked) {
    return (
      <main className="page">
        <div className="shell">
          <p className="muted">Preparing your workout studio…</p>
        </div>
        <style jsx>{`
          .page {
            padding: 32px 16px 64px;
          }
          .shell {
            max-width: 840px;
            margin: 0 auto;
            display: grid;
            place-items: center;
            gap: 16px;
            min-height: 320px;
            background: var(--card-bg);
            border-radius: 22px;
            border: 1px solid var(--border);
            padding: clamp(20px, 5vw, 32px);
            box-shadow: var(--shadow);
          }
          .muted {
            color: var(--muted);
          }
          @media (max-width: 640px) {
            .page {
              padding: 24px 12px 48px;
            }
            .shell {
              border-radius: 18px;
              padding: 20px;
            }
          }
        `}</style>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="page">
      <div className="shell">
        <CreateWorkoutForm />
      </div>
      <style jsx>{`
        .page {
          padding: 32px 16px 64px;
        }
        .shell {
          max-width: 840px;
          margin: 0 auto;
          display: grid;
          gap: 24px;
          background: var(--card-bg);
          border-radius: 22px;
          border: 1px solid var(--border);
          padding: clamp(20px, 5vw, 32px);
          box-shadow: var(--shadow);
        }
        @media (max-width: 640px) {
          .page {
            padding: 24px 12px 48px;
          }
          .shell {
            border-radius: 18px;
            padding: 20px;
          }
        }
      `}</style>
    </main>
  );
}
