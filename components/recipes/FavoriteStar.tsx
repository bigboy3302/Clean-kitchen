
"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebas1e";
import { doc, onSnapshot, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";

type Props = {
  rid: string;               
  payload?: Record<string, unknown>; 
  meUid?: string | null;      
  size?: "sm" | "md";
};

export default function FavoriteStar({ rid, payload = {}, meUid, size = "md" }: Props) {
  const [starred, setStarred] = useState(false);
  const uid = meUid ?? auth.currentUser?.uid ?? null;

  useEffect(() => {
    if (!uid) { setStarred(false); return; }
    const ref = doc(db, "users", uid, "favoriteRecipes", rid);
    const stop = onSnapshot(ref, (snap) => setStarred(snap.exists()));
    return () => stop();
  }, [uid, rid]);

  async function toggle() {
    if (!uid) return;
    const ref = doc(db, "users", uid, "favoriteRecipes", rid);
    if (starred) await deleteDoc(ref);
    else await setDoc(ref, { ...payload, createdAt: serverTimestamp() });
  }

  return (
    <button
      type="button"
      className={`star ${starred ? "on" : ""} ${size}`}
      aria-pressed={starred}
      title={starred ? "Remove from favorites" : "Add to favorites"}
      onClick={(e) => { e.stopPropagation(); toggle(); }}
    >
      {starred ? "★" : "☆"}
      <style jsx>{`
        .star {
          border: 1px solid #e5e7eb;
          background: #fff;
          border-radius: 999px;
          cursor: pointer;
        }
        .sm { font-size: 14px; padding: 2px 6px; }
        .md { font-size: 16px; padding: 4px 8px; }
        .on { background: #0f172a; color: #fff; border-color: #0f172a; }
      `}</style>
    </button>
  );
}
