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
import Fridge from "@/components/pantry/Fridge";
import TrashCan from "@/components/pantry/TrashCan";

/* ------------ helpers ------------- */
const looksLikeBarcode = (s: string) => /^\d{6,}$/.test(s);
const capFirst = (s: string) => s.replace(/^\p{L}/u, (m) => m.toUpperCase());
const todayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
};
const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
function toDate(ts?: Timestamp | {seconds:number} | null) {
  if (!ts) return null;
  const t: any = ts;
  if (typeof t?.toDate === "function") return t.toDate();
  if (typeof t?.seconds === "number") return new Date(t.seconds * 1000);
  return null;
}
function normalizeProductName(raw: string): string {
  const original = raw || "";
  let s = original.toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  if (s.includes("nutella")) return "Nutella";
  const cat = (out: string, ...keys: string[]) => keys.some(k => s.includes(k)) ? out : null;
  return (
    cat("Pasta", "pasta","spaghetti","penne","fusilli","rigatoni","macaroni","farfalle","tagliatelle") ||
    cat("Rice", "rice","basmati","jasmine","arborio","risotto") ||
    cat("Milk","milk") || cat("Yogurt","yoghurt","yogurt") || cat("Bread","bread","baguette","loaf") ||
    cat("Oats","oat","oats","oatmeal","porridge") || cat("Beans","beans","kidney","black","pinto") ||
    cat("Lentils","lentil","lentils") || cat("Chickpeas","chickpea","garbanzo") ||
    cat("Sugar","sugar") || cat("Salt","salt","sea salt") || cat("Butter","butter") ||
    cat("Cheese","cheese") || cat("Eggs","eggs","egg") ||
    capFirst(s.split(" ").find(Boolean) || original)
  );
}

/* ------------ types ------------- */
type Item = {
  id: string;
  uid: string;
  name: string;
  nameKey?: string;
  quantity: number;
  createdAt?: Timestamp | null;
  expiresAt?: Timestamp | null;
  barcode?: string | null;
  nutrition?: NutritionInfo | null;
};

export default function PantryPage() {
  const router = useRouter();

  // add-form
  const [name, setName] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [date, setDate] = useState<string>("");
  const [barcode, setBarcode] = useState<string>("");

  // scanner
  const [scannerKey, setScannerKey] = useState(0);
  const [scannerAutoStart, setScannerAutoStart] = useState(false);

  // nutrition
  const [nutrition, setNutrition] = useState<NutritionInfo | null>(null);
  const [nutriBusy, setNutriBusy] = useState(false);
  const [nutriErr, setNutriErr] = useState<string | null>(null);

  // state
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const stopRef = useRef<null | (() => void)>(null);

  const minDate = todayStr();
  const todayStart = useMemo(startOfToday, []); // ✅ single

  const [fridgeOpen, setFridgeOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState<number>(1);
  const [editDate, setEditDate] = useState("");

  /* auth + live items */
  useEffect(() => {
    const stopAuth = onAuthStateChanged(auth, (u) => {
      if (stopRef.current) { stopRef.current(); stopRef.current = null; }
      if (!u) { router.replace("/auth/login"); setItems([]); return; }

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

  /* nutrition lookup */
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
        setNutriErr(e?.message || "Could not fetch nutrition.");
      } finally {
        setNutriBusy(false);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [barcode]);

  function handleDetected(code: string) {
    setBarcode(code);
    setScannerAutoStart(false);
  }

  /* add / merge */
  const isPast = (s: string) => !!s && s < minDate;

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

      // match by barcode first
      let existingId: string | null = null;
      if (barcode) {
        const s1 = await getDocs(query(
          collection(db, "pantryItems"),
          where("uid", "==", u.uid),
          where("barcode", "==", barcode),
          limit(1)
        ));
        if (!s1.empty) existingId = s1.docs[0].id;
      }
      // else by nameKey
      if (!existingId) {
        const s2 = await getDocs(query(
          collection(db, "pantryItems"),
          where("uid", "==", u.uid),
          where("nameKey", "==", nameKey),
          limit(1)
        ));
        if (!s2.empty) existingId = s2.docs[0].id;
      }

      if (existingId) {
        await updateDoc(doc(db, "pantryItems", existingId), {
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

      // reset + quick fridge pop
      setName(""); setQty(1); setDate(""); setBarcode(""); setNutrition(null); setNutriErr(null);
      setScannerAutoStart(false); setScannerKey((k) => k + 1);
      setFridgeOpen(true); setTimeout(()=>setFridgeOpen(false), 1200);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to add item.");
    } finally { setBusy(false); }
  }

  async function saveItem(id: string, patch: { name: string; quantity: number; expiresAt: any }) {
    const cleaned = capFirst(normalizeProductName(patch.name || ""));
    const toWrite: any = {
      name: cleaned,
      nameKey: cleaned.toLowerCase(),
      quantity: Number(patch.quantity) || 1,
      expiresAt: null,
    };
    if (patch.expiresAt) {
      if (typeof patch.expiresAt?.toDate === "function") toWrite.expiresAt = patch.expiresAt;
      else if (typeof patch.expiresAt?.seconds === "number") toWrite.expiresAt = Timestamp.fromDate(new Date(patch.expiresAt.seconds * 1000));
      else if (typeof patch.expiresAt === "string" && !Number.isNaN(Date.parse(patch.expiresAt)))
        toWrite.expiresAt = Timestamp.fromDate(new Date(`${patch.expiresAt}T00:00:00`));
    }
    await updateDoc(doc(db, "pantryItems", id), toWrite);
  }

  async function removeItem(id: string) {
    try { await deleteDoc(doc(db, "pantryItems", id)); }
    catch (e) {
      const code = (e as FirebaseError).code || "";
      throw new Error(code === "permission-denied" ? "You can only delete items you own." : (e as any)?.message ?? "Failed to delete.");
    }
  }

  /* split */
  const active: Item[] = [];
  const expired: Item[] = [];
  items.forEach((it) => {
    const d = toDate(it.expiresAt);
    if (d && d < todayStart) expired.push(it);
    else active.push(it);
  });

  /* open edit modal (from Fridge or cards) */
  function openEdit(it: Item) {
    setEditItem(it);
    setEditName(it.name);
    setEditQty(it.quantity || 1);
    const d = toDate(it.expiresAt);
    setEditDate(d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` : "");
    setEditOpen(true);
  }
  async function confirmEdit() {
    if (!editItem) return;
    await saveItem(editItem.id, {
      name: editName.trim(),
      quantity: editQty,
      expiresAt: editDate || null,
    });
    setEditOpen(false);
    setEditItem(null);
  }

  return (
    <main className="wrap">
      {/* HEADER */}
      <header className="hero">
        <div className="left">
          <h1 className="title tracking-in-contract-bck-top">Pantry</h1>
          <p className="sub">
            Store groceries in your <strong>Fridge</strong>, keep an eye on <strong>Expired</strong> items.
          </p>
        </div>
        <div className="right"><PantryHelpButton /></div>
      </header>

      {/* ADD PRODUCT */}
      <section className="addCard">
        <div className="addHead">
          <div className="addIcon">➕</div>
          <div>
            <div className="addTitle">Add product</div>
            <div className="addSub">Scan barcodes, merge duplicates automatically.</div>
          </div>
        </div>

        <div className="addGrid">
          <Input label="Name" value={name} onChange={(e:any)=>setName(e.target.value)} placeholder="Pasta" />
          <Input label="Quantity" type="number" min={1} value={String(qty)} onChange={(e:any)=>setQty(Number(e.target.value))} />
          <div>
            <label className="label">Expiry date (optional)</label>
            <input className="textInput" type="date" min={minDate} value={date} onChange={(e)=>setDate(e.currentTarget.value)} />
          </div>
          <div className="barcodeRow">
            <Input label="Barcode" value={barcode} onChange={(e:any)=>setBarcode(String(e.target.value).trim())} placeholder="Scan or type digits" />
            <button type="button" className="btn ghost" onClick={() => { setBarcode(""); setNutrition(null); setNutriErr(null); }}>
              Clear
            </button>
          </div>
          <div className="scannerCol">
            <label className="label">Scan with camera</label>
            <BarcodeScanner key={scannerKey} autoStart={scannerAutoStart} onDetected={handleDetected} />
            <div className="rowHint">
              {nutriBusy ? <span className="muted small">Looking up nutrition…</span> : null}
              {nutriErr ? <span className="error small">{nutriErr}</span> : null}
            </div>
          </div>
        </div>

        {(nutrition?.name || nutrition?.kcalPer100g || nutrition?.kcalPerServing) && (
          <div className="nutri">
            <div className="nutTitle">Nutrition (auto from barcode)</div>
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
          <Button onClick={addOrMergeItem} disabled={busy} type="button">
            {busy ? "Saving…" : "Add / Merge"}
          </Button>
        </div>
      </section>

      {/* ACTIVE + FRIDGE */}
      <section className="list">
        <div className="sectionHead">
          <h2 className="secTitle">Active</h2>
          <Fridge
            items={active}
            isOpen={fridgeOpen}
            onToggleOpen={setFridgeOpen}
            onEdit={(it) => openEdit(it)}
            onDelete={(it) => removeItem(it.id)}
          />
        </div>

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

      {/* EXPIRED + TRASHCAN */}
      <section className="list" style={{ marginTop: 20 }}>
        <div className="sectionHead">
          <h2 className="secTitle">Expired</h2>
        <TrashCan
            items={expired.map(a => ({ id: a.id, name: a.name }))}
            isOpen={trashOpen}
            onToggleOpen={setTrashOpen}
          />
        </div>

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

      {/* EDIT MODAL */}
      {editOpen && editItem && (
        <div className="overlay" onClick={()=>setEditOpen(false)} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e)=>e.stopPropagation()}>
            <div className="mhead">
              <div className="mtitle">Edit “{editItem.name}”</div>
              <button className="x" onClick={()=>setEditOpen(false)}>×</button>
            </div>
            <div className="mbody">
              <div className="gridM">
                <label className="lbl">Name
                  <input className="txt" value={editName} onChange={(e)=>setEditName(e.target.value)} />
                </label>
                <label className="lbl">Quantity
                  <input className="txt" type="number" min={1} value={String(editQty)} onChange={(e)=>setEditQty(Number(e.target.value)||1)} />
                </label>
                <label className="lbl">Expiry date
                  <input className="txt" type="date" value={editDate} onChange={(e)=>setEditDate(e.target.value)} />
                </label>
              </div>
            </div>
            <div className="mfoot">
              <Button variant="secondary" onClick={()=>setEditOpen(false)}>Cancel</Button>
              <Button onClick={confirmEdit}>Save</Button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .wrap { max-width: 1100px; margin: 0 auto; padding: 20px 16px 80px; }

        .hero { display:grid; grid-template-columns: 1fr auto; align-items:center; margin: 4px 0 18px; }
        .title { font-size: 34px; font-weight: 900; letter-spacing: -0.02em; margin: 0; color: var(--text); }
        .sub { color: var(--muted); margin: 6px 0 0; }
        .right { display:flex; gap:8px; align-items:center; }

        /* ADD CARD — modern */
        .addCard {
          border:1px solid var(--border);
          background:
            radial-gradient(1200px 300px at 0% -30%, color-mix(in oklab, var(--primary) 8%, transparent) , transparent),
            var(--card-bg);
          border-radius: 20px;
          padding: 16px;
          box-shadow: 0 16px 40px rgba(0,0,0,.06);
          margin-bottom: 22px;
        }
        .addHead { display:flex; align-items:center; gap:12px; margin-bottom: 14px; }
        .addIcon { width:34px; height:34px; border-radius:10px; display:grid; place-items:center;
                   background: color-mix(in oklab, var(--primary) 14%, var(--bg2));
                   border:1px solid var(--border); font-weight:800; }
        .addTitle { font-weight:800; }
        .addSub { color: var(--muted); font-size: 13px; margin-top: 2px; }

        .addGrid { display:grid; grid-template-columns:1fr 140px 200px 1fr 1fr; gap:12px 16px; align-items:start; }
        @media (max-width: 1100px){ .addGrid{ grid-template-columns:1fr 120px 180px 1fr; } }
        @media (max-width: 900px){ .addGrid{ grid-template-columns:1fr 1fr; } }
        @media (max-width: 560px){ .addGrid{ grid-template-columns:1fr; } }

        .label { display:block; margin-bottom:6px; font-size:.9rem; color:var(--text); font-weight:600; }
        .textInput { width:100%; border:1px solid var(--border); border-radius:12px; padding:10px 12px; font-size:14px; background: var(--bg2); color: var(--text); }
        .textInput:focus { outline:none; border-color: var(--primary); box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 25%, transparent); }

        .barcodeRow { display:grid; grid-template-columns: 1fr auto; gap:8px; align-items:end; }
        .btn { border:1px solid var(--border); background:var(--bg2); padding:8px 12px; border-radius:10px; cursor:pointer; color: var(--text); }
        .btn.ghost:hover{ background: color-mix(in oklab, var(--bg2) 85%, var(--primary) 15%); }

        .scannerCol { display:grid; gap:8px; }
        .rowHint { display:flex; gap:12px; align-items:center; }
        .muted { color: var(--muted); }
        .small { font-size:12px; }

        .nutri {
          margin-top: 12px;
          border:1px dashed var(--border);
          background: color-mix(in oklab, var(--bg) 92%, var(--primary) 8%);
          border-radius:14px;
          padding:10px 12px;
        }
        .nutTitle { font-weight:800; margin-bottom:6px; color: var(--text); }
        .nutGrid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px 12px; }
        @media (max-width:560px){ .nutGrid{ grid-template-columns:1fr; } }

        .actions { margin-top:12px; display:flex; gap:12px; justify-content:flex-end; }

        /* SECTION */
        .list { margin-top: 18px; }
        .sectionHead { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom: 8px; }
        .secTitle { font-size:16px; font-weight:800; margin: 0; color: var(--text); }

        .gridCards { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:16px; }
        @media (max-width: 900px){ .gridCards{ grid-template-columns:repeat(2, minmax(0,1fr)); } }
        @media (max-width: 600px){ .gridCards{ grid-template-columns:1fr; } }
        .empty { color: var(--muted); font-size:14px; padding:16px; text-align:center; border:1px dashed var(--border); border-radius:12px; background: var(--bg); }

        .error { background: color-mix(in oklab, #ef4444 15%, var(--card-bg)); color:#7f1d1d; border:1px solid color-mix(in oklab, #ef4444 35%, var(--border)); border-radius:8px; padding:8px 10px; font-size:13px; }

        /* EDIT MODAL */
        .overlay { position:fixed; inset:0; background:rgba(2,6,23,.55); display:grid; place-items:center; padding:16px; z-index:1200;}
        .modal { width:100%; max-width:520px; background: var(--card-bg); border-radius:16px; overflow:hidden; box-shadow:0 24px 60px rgba(0,0,0,.35); border:1px solid var(--border); }
        .mhead { display:grid; grid-template-columns:1fr auto; align-items:center; gap:8px; padding:12px 14px; border-bottom:1px solid var(--border); background: var(--bg2); }
        .mtitle { font-weight:800; color: var(--text); }
        .x { border:none; background:transparent; font-size:22px; color: var(--muted); cursor:pointer; }
        .mbody { padding:14px; }
        .gridM { display:grid; grid-template-columns:1fr 120px 1fr; gap:12px 16px; }
        @media (max-width:640px){ .gridM{ grid-template-columns:1fr; } }
        .lbl { display:grid; gap:6px; font-size:.9rem; color:var(--text); font-weight:600; }
        .txt { width:100%; border:1px solid var(--border); border-radius:12px; padding:10px 12px; background: var(--bg2); color: var(--text); }
        .mfoot { padding:12px 14px; border-top:1px solid var(--border); display:flex; gap:10px; justify-content:flex-end; }

        /* headline entrance animation */
        .tracking-in-contract-bck-top {
          -webkit-animation: tracking-in-contract-bck-top 1s cubic-bezier(0.215,0.610,0.355,1.000) both;
                  animation: tracking-in-contract-bck-top 1s cubic-bezier(0.215,0.610,0.355,1.000) both;
        }
        @-webkit-keyframes tracking-in-contract-bck-top {
          0%{ letter-spacing:1em; -webkit-transform: translateZ(400px) translateY(-300px); transform: translateZ(400px) translateY(-300px); opacity:0; }
          40%{ opacity:.6; }
          100%{ -webkit-transform: translateZ(0) translateY(0); transform: translateZ(0) translateY(0); opacity:1; }
        }
        @keyframes tracking-in-contract-bck-top {
          0%{ letter-spacing:1em; -webkit-transform: translateZ(400px) translateY(-300px); transform: translateZ(400px) translateY(-300px); opacity:0; }
          40%{ opacity:.6; }
          100%{ -webkit-transform: translateZ(0) translateY(0); transform: translateZ(0) translateY(0); opacity:1; }
        }
      `}</style>
    </main>
  );
}
