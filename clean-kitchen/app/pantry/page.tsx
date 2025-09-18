// app/pantry/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FirebaseError } from "firebase/app";
import { useRouter } from "next/navigation";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query,
  serverTimestamp, Timestamp, updateDoc, where, getDocs, limit, increment
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import PantryCard, { PantryCardItem } from "@/components/pantry/PantryCard";
import BarcodeScanner from "@/components/pantry/BarcodeScanner";
import PantryHelpButton from "@/components/pantry/PantryHelpButton";
import { fetchNutritionByBarcode, NutritionInfo } from "@/lib/nutrition";

/* ------------ helpers ------------- */
const looksLikeBarcode = (s: string) => /^\d{6,}$/.test(s);
function capFirst(s: string) { return s.replace(/^\p{L}/u, (m) => m.toUpperCase()); }
function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
}
function startOfToday(): Date { const d = new Date(); d.setHours(0,0,0,0); return d; }
function toDate(ts?: Timestamp | {seconds:number;nanoseconds:number} | null) {
  if (!ts) return null;
  const anyTs = ts as any;
  if (typeof anyTs?.toDate === "function") return anyTs.toDate();
  if (typeof anyTs?.seconds === "number") return new Date(anyTs.seconds * 1000);
  return null;
}

/** Reduce noisy product titles to a clean generic English name. */
function normalizeProductName(raw: string): string {
  const original = raw || "";
  let s = original.toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!s) return "";

  if (s.includes("nutella")) return "Nutella";

  const cat = (out: string, ...keys: string[]) =>
    keys.some(k => s.includes(k)) ? out : null;

  return (
    cat("Pasta", "pasta", "spaghetti", "penne", "fusilli", "rigatoni", "macaroni", "farfalle", "tagliatelle") ||
    cat("Rice", "rice", "basmati", "jasmine", "arborio", "risotto") ||
    cat("Milk", "milk") ||
    cat("Yogurt", "yoghurt", "yogurt") ||
    cat("Bread", "bread", "baguette", "loaf") ||
    cat("Oats", "oat", "oats", "oatmeal", "porridge") ||
    cat("Beans", "beans", "bean", "kidney beans", "black beans", "pinto") ||
    cat("Lentils", "lentil", "lentils") ||
    cat("Chickpeas", "chickpea", "chickpeas", "garbanzo") ||
    cat("Sugar", "sugar") ||
    cat("Salt", "salt", "sea salt") ||
    cat("Butter", "butter") ||
    cat("Cheese", "cheese") ||
    cat("Eggs", "eggs", "egg") ||
    capFirst(s.split(" ").find(Boolean) || original)
  );
}

/* ------------ types ------------- */
type Item = {
  id: string;
  uid: string;
  name: string;
  nameKey?: string;            // lowercase name for merging
  quantity: number;
  createdAt?: Timestamp | null;
  expiresAt?: Timestamp | null;
  barcode?: string | null;
  nutrition?: NutritionInfo | null;
};

/* ============ component ============ */
export default function PantryPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [date, setDate] = useState<string>("");
  const [barcode, setBarcode] = useState<string>("");

  const [nutrition, setNutrition] = useState<NutritionInfo | null>(null);
  const [nutriBusy, setNutriBusy] = useState(false);
  const [nutriErr, setNutriErr] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const stopRef = useRef<null | (() => void)>(null);

  const minDate = todayStr();
  const today0 = useMemo(startOfToday, []);

  /* auth + live items */
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
        (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Item[]),
        (e) => setErr(e?.message ?? "Could not load pantry.")
      );
      stopRef.current = stop;
    });

    return () => { if (stopRef.current) stopRef.current(); stopAuth(); };
  }, [router]);

  /* nutrition lookup (react to barcode changes) */
  useEffect(() => {
    const id = setTimeout(async () => {
      if (!barcode) { setNutrition(null); setNutriErr(null); return; }
      if (!looksLikeBarcode(barcode)) return;

      setNutriBusy(true); setNutriErr(null);
      try {
        const info = await fetchNutritionByBarcode(barcode);
        setNutrition(info || null);
        if (info?.name) setName(normalizeProductName(info.name));
      } catch (e: any) {
        setNutriErr(e?.message || "Could not fetch nutrition for that barcode.");
      } finally {
        setNutriBusy(false);
      }
    }, 300);

    return () => clearTimeout(id);
  }, [barcode]);

  // camera detection → updates barcode (triggers lookup effect)
  function handleDetected(code: string) {
    setBarcode(code);
  }

  /* CRUD */
  function isPast(s: string) { return !!s && s < minDate; }

  // ADD or MERGE with existing item (by barcode first, else by nameKey)
  async function addOrMergeItem() {
    setErr(null);
    const u = auth.currentUser;
    if (!u) { router.replace("/auth/login"); return; }

    const cleanedName = capFirst(normalizeProductName(name.trim()));
    if (!cleanedName) { setErr("Please enter product name."); return; }
    if (date && isPast(date)) { setErr("Expiry date cannot be in the past."); return; }

    setBusy(true);
    try {
      const expiresAt =
        date && !Number.isNaN(Date.parse(date))
          ? Timestamp.fromDate(new Date(`${date}T00:00:00`))
          : null;

      const nameKey = cleanedName.toLowerCase();

      // 1) find existing by barcode
      let existingId: string | null = null;
      if (barcode) {
        const q1 = query(
          collection(db, "pantryItems"),
          where("uid", "==", u.uid),
          where("barcode", "==", barcode),
          limit(1)
        );
        const s1 = await getDocs(q1);
        if (!s1.empty) existingId = s1.docs[0].id;
      }

      // 2) if no barcode match, find by nameKey
      if (!existingId) {
        const q2 = query(
          collection(db, "pantryItems"),
          where("uid", "==", u.uid),
          where("nameKey", "==", nameKey),
          limit(1)
        );
        const s2 = await getDocs(q2);
        if (!s2.empty) existingId = s2.docs[0].id;
      }

      // 3) merge or create
      if (existingId) {
        const ref = doc(db, "pantryItems", existingId);
        await updateDoc(ref, {
          quantity: increment(Number(qty) || 1),
          ...(expiresAt ? { expiresAt } : {}),
          ...(barcode ? { barcode } : {}),
          ...(nutrition ? { nutrition } : {}),
          name: cleanedName,
          nameKey,
        });
      } else {
        await addDoc(collection(db, "pantryItems"), {
          uid: u.uid,
          name: cleanedName,
          nameKey,
          quantity: Number(qty) || 1,
          createdAt: serverTimestamp(),
          expiresAt,
          barcode: barcode || null,
          nutrition: nutrition || null,
        });
      }

      // Reset inputs
      setName("");
      setQty(1);
      setDate("");
      setBarcode("");
      setNutrition(null);
      setNutriErr(null);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to add item.");
    } finally {
      setBusy(false);
    }
  }

  async function saveItem(id: string, patch: { name: string; quantity: number; expiresAt: any }) {
    setErr(null);
    try {
      const cleaned = capFirst(normalizeProductName(patch.name || "")); // name cleaned on save too
      const toWrite: any = {
        name: cleaned,
        nameKey: cleaned.toLowerCase(),
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
      setErr(e?.message ?? "Failed to save changes."); throw e;
    }
  }

  async function removeItem(id: string) {
    setErr(null);
    try { await deleteDoc(doc(db, "pantryItems", id)); }
    catch (e) {
      const code = (e as FirebaseError).code || "";
      setErr(code === "permission-denied" ? "You can only delete items you own." : (e as any)?.message ?? "Failed to delete.");
      throw e;
    }
  }

  /* split active/expired */
  const active: Item[] = [];
  const expired: Item[] = [];
  items.forEach((it) => {
    const d = toDate(it.expiresAt);
    if (d && d < today0) expired.push(it);
    else active.push(it);
  });

  return (
    <main className="container">
      <div className="titleRow">
        <h1 className="pageTitle">Pantry</h1>
        <PantryHelpButton />
      </div>

      <section className="card addCard">
        <h2 className="cardTitle">Add product</h2>

        <div className="grid2">
          <Input label="Name" value={name} onChange={(e:any)=>setName(e.target.value)} placeholder="Pasta" />
          <Input label="Quantity" type="number" min={1} value={String(qty)} onChange={(e:any)=>setQty(Number(e.target.value))} />
          <div>
            <label className="label">Expiry date (optional)</label>
            <input className="textInput" type="date" min={minDate} value={date} onChange={(e)=>setDate(e.currentTarget.value)} />
          </div>

          <div className="barcodeRow">
            <Input
              label="Barcode"
              value={barcode}
              onChange={(e:any)=>setBarcode(String(e.target.value).trim())}
              placeholder="Scan or type digits"
            />
            <button
              type="button"
              className="btn"
              onClick={() => { setBarcode(""); setNutrition(null); setNutriErr(null); }}
              aria-label="Clear barcode"
            >
              Clear
            </button>
          </div>

          <div className="scannerCol">
            <label className="label">Scan with camera</label>
            {/* Keep your existing BarcodeScanner component */}
            <BarcodeScanner onDetected={handleDetected} />
            {nutriErr && <p className="error small">{nutriErr}</p>}
            {nutriBusy && <p className="muted small">Looking up nutrition…</p>}
          </div>
        </div>

        {(nutrition?.name || nutrition?.kcalPer100g || nutrition?.kcalPerServing) && (
          <div className="nutri cardLite">
            <div className="nutTitle">Nutrition (from barcode)</div>
            <div className="nutGrid">
              <div><span className="muted">Name:</span> <strong>{normalizeProductName(nutrition?.name || "")}</strong></div>
              <div><span className="muted">kcal / 100g:</span> <strong>{nutrition?.kcalPer100g ?? "—"}</strong></div>
              <div><span className="muted">kcal / serving:</span> <strong>{nutrition?.kcalPerServing ?? "—"}</strong></div>
              <div><span className="muted">Serving size:</span> <strong>{nutrition?.servingSize ?? "—"}</strong></div>
            </div>
          </div>
        )}

        {err && <p className="error">{err}</p>}
        <div className="actions">
          <Button onClick={addOrMergeItem} disabled={busy}>
            {busy ? "Saving…" : "Add / Merge"}
          </Button>
        </div>
      </section>

      <section className="list">
        <h2 className="secTitle">Active</h2>
        {active.length === 0 ? (
          <div className="empty">No active items.</div>
        ) : (
          <div className="gridCards">
            {active.map((it) => (
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

      <section className="list" style={{ marginTop: 16 }}>
        <h2 className="secTitle">Expired</h2>
        {expired.length === 0 ? (
          <div className="empty">Nothing expired 🎉</div>
        ) : (
          <div className="gridCards">
            {expired.map((it) => (
              <PantryCard
                key={it.id}
                item={{ ...it, name: it.name } as unknown as PantryCardItem}
                onDelete={() => removeItem(it.id)}
                onSave={(patch) => saveItem(it.id, patch)}
              />
            ))}
          </div>
        )}
      </section>

      <style jsx>{`
        .container { max-width: 960px; margin: 0 auto; padding: 24px; }
        .titleRow { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }
        .pageTitle { font-size: 28px; font-weight: 700; }
        .card { border:1px solid #e5e7eb; background:#fff; border-radius:16px; padding:16px; box-shadow:0 10px 30px rgba(0,0,0,.04); }
        .cardLite { border:1px solid #eef2f7; background:#fafbff; border-radius:12px; padding:10px 12px; }
        .addCard { margin-bottom: 24px; }
        .cardTitle { font-size: 16px; font-weight: 600; margin-bottom: 12px; }
        .grid2 { display:grid; grid-template-columns:1fr 160px 200px 1fr 1fr; gap:12px 16px; align-items:start; }
        @media (max-width: 1100px){ .grid2{ grid-template-columns:1fr 140px 180px 1fr; } }
        @media (max-width: 900px){ .grid2{ grid-template-columns:1fr 1fr; } }
        @media (max-width: 560px){ .grid2{ grid-template-columns:1fr; } }
        .label { display:block; margin-bottom:6px; font-size:.9rem; color:#111827; font-weight:500; }
        .textInput { width:100%; border:1px solid #d1d5db; border-radius:12px; padding:10px 12px; font-size:14px; }
        .barcodeRow { display:grid; grid-template-columns: 1fr auto; gap:8px; align-items:end; }
        .btn { border:1px solid #e5e7eb; background:#fff; padding:8px 12px; border-radius:10px; cursor:pointer; }
        .scannerCol { display:grid; gap:8px; }
        .muted { color:#64748b; }
        .small { font-size:12px; }
        .nutri { margin-top: 10px; }
        .nutTitle { font-weight:600; margin-bottom:6px; }
        .nutGrid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px 12px; }
        @media (max-width:560px){ .nutGrid{ grid-template-columns:1fr; } }
        .actions { margin-top:10px; display:flex; gap:12px; justify-content:flex-end; }
        .list { margin-top: 18px; }
        .secTitle { font-size:16px; font-weight:700; margin: 6px 0 10px; }
        .gridCards { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:16px; }
        @media (max-width: 900px){ .gridCards{ grid-template-columns:repeat(2, minmax(0,1fr)); } }
        @media (max-width: 600px){ .gridCards{ grid-template-columns:1fr; } }
        .empty { color:#6b7280; font-size:14px; padding:16px; text-align:center; border:1px dashed #e5e7eb; border-radius:12px; background:#fafafa; }
        .error { margin-top:8px; background:#fef2f2; color:#991b1b; border:1px solid #fecaca; border-radius:8px; padding:8px 10px; font-size:13px; }
      `}</style>
    </main>
  );
}
