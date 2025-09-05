"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import PantryCard, { PantryCardItem } from "@/components/pantry/PantryCard";

type PantryItem = {
  id: string;
  uid: string;
  name: string;
  quantity: number;
  createdAt?: Timestamp | null;
  expiresAt?: Timestamp | null;
};

function todayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function PantryPage() {
  const router = useRouter();

  // form state
  const [name, setName] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [date, setDate] = useState<string>(""); // yyyy-mm-dd
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // data
  const [items, setItems] = useState<PantryItem[]>([]);
  const unsubRef = useRef<(() => void) | null>(null); // listener cleanup

  const minDate = todayStr();

  useEffect(() => {
    const stopAuth = onAuthStateChanged(auth, (u) => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }

      if (!u) {
        router.replace("/auth/login");
        setItems([]);
        return;
      }

      const qy = query(
        collection(db, "pantryItems"),
        where("uid", "==", u.uid),
        orderBy("createdAt", "desc")
      );

      const stopPantry = onSnapshot(
        qy,
        (snap) => {
          const rows = snap.docs.map((d) => {
            const data = d.data() as Omit<PantryItem, "id">;
            return { id: d.id, ...data } as PantryItem;
          });
          setItems(rows);
        },
        (e) => {
          console.error("Pantry listen error:", e);
          setErr(e?.message ?? "Could not load pantry.");
        }
      );

      unsubRef.current = stopPantry;
    });

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
      stopAuth();
    };
  }, [router]);

  function isPastDate(s: string) {
    if (!s) return false;
    return s < minDate;
  }

  async function addItem() {
    setErr(null);
    setBusy(true);
    try {
      const u = auth.currentUser;
      if (!u) { setErr("Please sign in to add items."); return; }
      if (!name.trim()) { setErr("Please enter product name."); return; }
      if (date && isPastDate(date)) { setErr("Expiry date cannot be in the past."); return; }

      const expiresAt =
        date && !Number.isNaN(Date.parse(date))
          ? Timestamp.fromDate(new Date(date + "T00:00:00"))
          : null;

      await addDoc(collection(db, "pantryItems"), {
        uid: u.uid,              // rules require ownership
        name: name.trim(),
        quantity: Number(qty) || 1,
        createdAt: serverTimestamp(),
        expiresAt,
      });

      setName("");
      setQty(1);
      setDate("");
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to add item.");
    } finally {
      setBusy(false);
    }
  }

  async function saveItem(id: string, patch: { name: string; quantity: number; expiresAt: any }) {
    setErr(null);
    try {
      const toWrite: any = {
        name: patch.name,
        quantity: patch.quantity,
        expiresAt: null as any,
      };

      if (patch.expiresAt) {
        // ja saņēmām TS-like {seconds,nanoseconds}
        if (typeof patch.expiresAt.seconds === "number") {
          toWrite.expiresAt = Timestamp.fromDate(
            new Date(patch.expiresAt.seconds * 1000)
          );
        }
        // ja saņēmām Timestamp
        if (typeof patch.expiresAt.toDate === "function") {
          toWrite.expiresAt = patch.expiresAt;
        }
        // ja drošības pēc nāk string
        if (typeof patch.expiresAt === "string" && !Number.isNaN(Date.parse(patch.expiresAt))) {
          toWrite.expiresAt = Timestamp.fromDate(new Date(patch.expiresAt + "T00:00:00"));
        }
      }

      await updateDoc(doc(db, "pantryItems", id), toWrite);
    } catch (e: any) {
      console.error("Update failed:", e);
      setErr(e?.message ?? "Failed to save changes.");
      throw e;
    }
  }

  async function removeItem(id: string) {
    setErr(null);
    try {
      await deleteDoc(doc(db, "pantryItems", id)); // works if doc.uid == auth.uid
    } catch (e: any) {
      console.error("Delete failed:", e);
      const msg = String(e?.code || e?.message || e) as string;
      if (msg.includes("permission-denied")) {
        setErr(
          "You can only delete items you own. If this is an older item without a 'uid' field, delete it once in Firebase Console."
        );
      } else {
        setErr(e?.message ?? "Failed to delete.");
      }
    }
  }

  return (
    <main className="container">
      <h1 className="pageTitle">Pantry</h1>

      <section className="card addCard">
        <h2 className="cardTitle">Add product</h2>
        <div className="grid2">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder="Milk"
          />
          <Input
            label="Quantity"
            type="number"
            min={1}
            value={String(qty)}
            onChange={(e) => setQty(Number((e.target as HTMLInputElement).value))}
          />
          <div>
            <label className="label">Expiry date (optional)</label>
            <input
              className="textInput"
              type="date"
              min={minDate}                   
              value={date}
              onChange={(e) => setDate((e.target as HTMLInputElement).value)}
            />
          </div>
        </div>

        {err && <p className="error">{err}</p>}

        <div className="actions">
          <Button onClick={addItem} disabled={busy}>
            {busy ? "Saving…" : "Add item"}
          </Button>
        </div>
      </section>

      <section className="list">
        {items.length === 0 ? (
          <div className="empty">Your pantry is empty. Add something!</div>
        ) : (
          <div className="gridCards">
            {items.map((it) => (
              <PantryCard
                key={it.id}
                item={it as unknown as PantryCardItem}
                onDelete={() => removeItem(it.id)}
                onSave={(patch) => saveItem(it.id, patch)}
              />
            ))}
          </div>
        )}
      </section>

      <style jsx>{`
        .container { max-width: 960px; margin: 0 auto; padding: 24px; }
        .pageTitle { font-size: 28px; font-weight: 700; margin-bottom: 16px; }

        .card { border: 1px solid #e5e7eb; background: #fff; border-radius: 16px; padding: 16px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.04); }
        .addCard { margin-bottom: 24px; }
        .cardTitle { font-size: 16px; font-weight: 600; margin-bottom: 12px; }

        .grid2 { display: grid; grid-template-columns: 1fr 160px 200px; gap: 12px 16px; align-items: end; }
        @media (max-width: 860px) { .grid2 { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 560px) { .grid2 { grid-template-columns: 1fr; } }

        .label { display: block; margin-bottom: 6px; font-size: .9rem; color: #111827; font-weight: 500; }
        .textInput { width: 100%; border: 1px solid #d1d5db; border-radius: 12px; padding: 10px 12px;
                     font-size: 14px; transition: box-shadow .15s, border-color .15s; }
        .textInput:focus { outline: none; border-color: #9ca3af; box-shadow: 0 0 0 4px rgba(17,24,39,.08); }

        .actions { margin-top: 10px; display: flex; gap: 12px; justify-content: flex-end; }
        .list { margin-top: 8px; }

        .gridCards { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; }
        @media (max-width: 900px) { .gridCards { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        @media (max-width: 600px) { .gridCards { grid-template-columns: 1fr; } }

        .empty { color: #6b7280; font-size: 14px; padding: 16px; text-align: center;
                 border: 1px dashed #e5e7eb; border-radius: 12px; background: #fafafa; }

        .error { margin-top: 8px; background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;
                 border-radius: 8px; padding: 8px 10px; font-size: 13px; }
      `}</style>
    </main>
  );
}
