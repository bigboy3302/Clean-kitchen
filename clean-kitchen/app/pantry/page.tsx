"use client";

import { useEffect, useRef, useState } from "react";
import { FirebaseError } from "firebase/app";
import { useRouter } from "next/navigation";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query,
  serverTimestamp, Timestamp, updateDoc, where
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import PantryCard, { PantryCardItem } from "@/components/pantry/PantryCard";

type Item = {
  id: string;
  uid: string;
  name: string;
  quantity: number;
  createdAt?: Timestamp | null;
  expiresAt?: Timestamp | null;
};

function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
}

export default function PantryPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [date, setDate] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const stopRef = useRef<null | (() => void)>(null);
  const minDate = todayStr();

  useEffect(() => {
    const stopAuth = onAuthStateChanged(auth, (u) => {
      // clean any previous listener
      if (stopRef.current) { stopRef.current(); stopRef.current = null; }

      if (!u) {
        // hard redirect before any UI flashes
        router.replace("/auth/login");
        setItems([]);
        return;
      }

      const qy = query(
        collection(db, "pantryItems"),
        where("uid", "==", u.uid),
        orderBy("createdAt", "desc")
      );
      const stop = onSnapshot(
        qy,
        (snap) => {
          const rows = snap.docs.map((d) => {
            const data = d.data() as Omit<Item, "id">;
            return { id: d.id, ...data } as Item;
          });
          setItems(rows);
          setErr(null);
        },
        (e) => setErr(e?.message ?? "Could not load pantry.")
      );
      stopRef.current = stop;
    });

    return () => {
      if (stopRef.current) stopRef.current();
      stopAuth();
    };
  }, [router]);

  function isPast(s: string) { return !!s && s < minDate; }

  async function addItem() {
    setErr(null);
    const u = auth.currentUser;
    if (!u) { router.replace("/auth/login"); return; }
    if (!name.trim()) { setErr("Please enter product name."); return; }
    if (date && isPast(date)) { setErr("Expiry date cannot be in the past."); return; }

    setBusy(true);
    try {
      const expiresAt =
        date && !Number.isNaN(Date.parse(date))
          ? Timestamp.fromDate(new Date(`${date}T00:00:00`))
          : null;

      await addDoc(collection(db, "pantryItems"), {
        uid: u.uid,
        name: name.trim(),
        quantity: Number(qty) || 1,
        createdAt: serverTimestamp(),
        expiresAt, // null is allowed; avoid undefined
      });

      setName(""); setQty(1); setDate("");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to add item.");
    } finally {
      setBusy(false);
    }
  }

  async function saveItem(id: string, patch: { name: string; quantity: number; expiresAt: any }) {
    setErr(null);
    try {
      const toWrite: any = {
        name: patch.name ?? "",
        quantity: Number(patch.quantity) || 1,
        expiresAt: null,
      };
      if (patch.expiresAt) {
        // Accept TS-like or Timestamp or string
        if (typeof patch.expiresAt?.toDate === "function") {
          toWrite.expiresAt = patch.expiresAt;
        } else if (typeof patch.expiresAt?.seconds === "number") {
          toWrite.expiresAt = Timestamp.fromDate(new Date(patch.expiresAt.seconds * 1000));
        } else if (typeof patch.expiresAt === "string" && !Number.isNaN(Date.parse(patch.expiresAt))) {
          toWrite.expiresAt = Timestamp.fromDate(new Date(`${patch.expiresAt}T00:00:00`));
        }
      }
      await updateDoc(doc(db, "pantryItems", id), toWrite);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save changes.");
      throw e;
    }
  }

  async function removeItem(id: string) {
    setErr(null);
    try {
      await deleteDoc(doc(db, "pantryItems", id));
    } catch (e) {
      console.error("Delete failed:", e);
      const code = (e as FirebaseError).code || "";
      if (code === "permission-denied") {
        setErr(
          "You can only delete items you own. Old items created without a 'uid' need a one-time cleanup."
        );
      } else {
        setErr((e as any)?.message ?? "Failed to delete.");
      }
      throw e; // surface to the caller if you `await onDelete()`
    }
  }
  return (
    <main className="container">
      <h1 className="pageTitle">Pantry</h1>

      <section className="card addCard">
        <h2 className="cardTitle">Add product</h2>
        <div className="grid2">
          <Input label="Name" value={name} onChange={(e:any)=>setName(e.target.value)} placeholder="Milk" />
          <Input label="Quantity" type="number" min={1} value={String(qty)} onChange={(e:any)=>setQty(Number(e.target.value))} />
          <div>
            <label className="label">Expiry date (optional)</label>
            <input className="textInput" type="date" min={minDate} value={date} onChange={(e)=>setDate(e.currentTarget.value)} />
          </div>
        </div>
        {err && <p className="error">{err}</p>}
        <div className="actions">
          <Button onClick={addItem} disabled={busy}>{busy ? "Saving…" : "Add item"}</Button>
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
        .card { border:1px solid #e5e7eb; background:#fff; border-radius:16px; padding:16px; box-shadow:0 10px 30px rgba(0,0,0,.04); }
        .addCard { margin-bottom: 24px; }
        .cardTitle { font-size: 16px; font-weight: 600; margin-bottom: 12px; }
        .grid2 { display:grid; grid-template-columns:1fr 160px 200px; gap:12px 16px; align-items:end; }
        @media (max-width: 860px){ .grid2{ grid-template-columns:1fr 1fr; } }
        @media (max-width: 560px){ .grid2{ grid-template-columns:1fr; } }
        .label { display:block; margin-bottom:6px; font-size:.9rem; color:#111827; font-weight:500; }
        .textInput { width:100%; border:1px solid #d1d5db; border-radius:12px; padding:10px 12px; font-size:14px; }
        .actions { margin-top:10px; display:flex; gap:12px; justify-content:flex-end; }
        .list { margin-top:8px; }
        .gridCards { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:16px; }
        @media (max-width: 900px){ .gridCards{ grid-template-columns:repeat(2, minmax(0,1fr)); } }
        @media (max-width: 600px){ .gridCards{ grid-template-columns:1fr; } }
        .empty { color:#6b7280; font-size:14px; padding:16px; text-align:center; border:1px dashed #e5e7eb; border-radius:12px; background:#fafafa; }
        .error { margin-top:8px; background:#fef2f2; color:#991b1b; border:1px solid #fecaca; border-radius:8px; padding:8px 10px; font-size:13px; }
      `}</style>
    </main>
  );
}
