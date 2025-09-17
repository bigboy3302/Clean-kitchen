"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import BarcodeScanner from "@/components/scanner/BarcodeScanner";
import { getNutrition, Nutrition } from "@/lib/nutrition";

// ---------- utils ----------
function startOfToday(): Date { const d=new Date(); d.setHours(0,0,0,0); return d; }
function toDate(ts?: Timestamp | null) {
  if (!ts) return null;
  if (typeof (ts as any)?.toDate === "function") return (ts as any).toDate() as Date;
  if (typeof (ts as any)?.seconds === "number") return new Date((ts as any).seconds * 1000);
  return null;
}
function isExpired(expiresAt?: Timestamp | null) { const d = toDate(expiresAt); return d ? d < startOfToday() : false; }
function titleCase(s: string) {
  return s.trim().replace(/\s+/g," ").toLowerCase().replace(/\b\w/g,(c)=>c.toUpperCase());
}
function todayStr(){ const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`; }

// ---------- types ----------
type Item = {
  id: string;
  uid: string;
  name: string;
  quantity: number;
  createdAt?: Timestamp | null;
  expiresAt?: Timestamp | null;
  nutrition?: Nutrition;
};

export default function PantryPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [date, setDate] = useState<string>("");

  const [nutrition, setNutrition] = useState<Nutrition | null>(null);   // <—
  const [showScanner, setShowScanner] = useState(false);                // <—

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const stopRef = useRef<null | (() => void)>(null);
  const minDate = todayStr();

  // auth + live list
  useEffect(() => {
    const stopAuth = onAuthStateChanged(auth, (u) => {
      if (stopRef.current) { stopRef.current(); stopRef.current = null; }

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
      const stop = onSnapshot(
        qy,
        (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Item, "id">) })) as Item[];
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

  const active = useMemo(() => items.filter((it) => !isExpired(it.expiresAt)), [items]);
  const expired = useMemo(() => {
    const list = items.filter((it) => isExpired(it.expiresAt));
    return list.sort((a,b) => (toDate(a.expiresAt)?.getTime() ?? 0) - (toDate(b.expiresAt)?.getTime() ?? 0));
  }, [items]);

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
        name: titleCase(name),
        quantity: Number(qty) || 1,
        createdAt: serverTimestamp(),
        expiresAt,
        nutrition: nutrition || null,     // <— store if we have it
      });

      setName(""); setQty(1); setDate(""); setNutrition(null);
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
        name: titleCase(patch.name ?? ""),
        quantity: Number(patch.quantity) || 1,
        expiresAt: null,
      };
      if (patch.expiresAt) {
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
        setErr("You can only delete items you own. Old items created without a 'uid' need a one-time cleanup.");
      } else {
        setErr((e as any)?.message ?? "Failed to delete.");
      }
      throw e;
    }
  }

  // ---- barcode flow ----
  async function handleDetected(code: string) {
    setShowScanner(false);
    setErr(null);
    const info = await getNutrition(code);
    if (!info) {
      setNutrition(null);
      setErr("No nutrition found for this barcode.");
      return;
    }
    setNutrition(info);
    if (info.productName) setName(info.productName);
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
            onChange={(e:any)=>setName(titleCase(e.target.value))}
            placeholder="Milk"
          />
          <Input
            label="Quantity"
            type="number"
            min={1}
            value={String(qty)}
            onChange={(e:any)=>setQty(Number(e.target.value))}
          />
          <div>
            <label className="label">Expiry date (optional)</label>
            <input
              className="textInput"
              type="date"
              min={minDate}
              value={date}
              onChange={(e)=>setDate(e.currentTarget.value)}
            />
          </div>
        </div>

        <div className="row" style={{marginTop:10, alignItems:"center", gap:8}}>
          <Button variant="secondary" onClick={()=>setShowScanner(true)}>📷 Scan barcode</Button>
          {nutrition ? (
            <div className="nutriPreview">
              {nutrition.image ? <img src={nutrition.image} alt="" /> : null}
              <div className="npText">
                <div className="npName">{nutrition.productName || "Product"}</div>
                <div className="npLine">
                  <span>{nutrition.calories ?? "–"} kcal</span>
                  <span>P {nutrition.protein ?? "–"}g</span>
                  <span>C {nutrition.carbs ?? "–"}g</span>
                  <span>S {nutrition.sugars ?? "–"}g</span>
                  <span>F {nutrition.fat ?? "–"}g</span>
                </div>
              </div>
              <button className="link" onClick={()=>setNutrition(null)}>Clear</button>
            </div>
          ) : <span className="muted">No scan yet</span>}
        </div>

        {err && <p className="error">{err}</p>}
        <div className="actions">
          <Button onClick={addItem} disabled={busy}>{busy ? "Saving…" : "Add item"}</Button>
        </div>
      </section>

      <section className="list">
        <h2 className="cardTitle">Active</h2>
        {active.length === 0 ? (
          <div className="empty">No active items.</div>
        ) : (
          <div className="gridCards">
            {active.map((it) => (
              <PantryCard
                key={it.id}
                item={it as unknown as PantryCardItem}
                expired={false}
                onDelete={() => removeItem(it.id)}
                onSave={(patch) => saveItem(it.id, patch)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="list" style={{ marginTop: 18 }}>
        <h2 className="cardTitle">Expired</h2>
        {expired.length === 0 ? (
          <div className="empty">No expired items 🎉</div>
        ) : (
          <div className="gridCards">
            {expired.map((it) => (
              <PantryCard
                key={it.id}
                item={it as unknown as PantryCardItem}
                expired={true}
                onDelete={() => removeItem(it.id)}
                onSave={() => Promise.resolve()}
              />
            ))}
          </div>
        )}
      </section>

      {showScanner && (
        <BarcodeScanner onDetected={handleDetected} onClose={()=>setShowScanner(false)} />
      )}

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
        .row { display:flex; gap:8px; }
        .muted { color:#6b7280; font-size:13px; }
        .nutriPreview { display:flex; gap:10px; align-items:center; padding:8px; border:1px solid #e5e7eb; border-radius:12px; }
        .nutriPreview img { width:42px; height:42px; border-radius:8px; object-fit:cover; border:1px solid #e5e7eb; }
        .npText { display:flex; flex-direction:column; gap:2px; }
        .npName { font-weight:600; color:#0f172a; }
        .npLine { display:flex; gap:8px; color:#475569; font-size:13px; }
        .link { border:none; background:none; color:#2563eb; cursor:pointer; text-decoration:underline; }
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
