
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
import PantryHelpButton from "@/components/pantry/PantryHelpButton";
import { fetchNutritionByBarcode, NutritionInfo } from "@/lib/nutrition";
import Fridge from "@/components/pantry/Fridge";
import TrashCan from "@/components/pantry/TrashCan";
import CameraModal from "@/components/pantry/CameraModal";

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
  const todayZero = useMemo(startOfToday, []);
  const [fridgeOpen, setFridgeOpen] = useState(false);

  const [trashOpen, setTrashOpen] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);

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

  function onDetectedFromCam(code: string) {
    setBarcode(code);
    setCamOpen(false);
  }

  
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

      
      setName(""); setQty(1); setDate(""); setBarcode(""); setNutrition(null); setNutriErr(null);
      setFridgeOpen(true); setTimeout(()=>setFridgeOpen(false), 1000);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to add item.");
    } finally { setBusy(false); }
  }

  async function saveItem(id: string, patch: { name: string; quantity: number; expiresAt: any }) {
    setErr(null);
    try {
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
        else if (typeof patch.expiresAt === "string" && !Number.isNaN(Date.parse(patch.expiresAt))) toWrite.expiresAt = Timestamp.fromDate(new Date(`${patch.expiresAt}T00:00:00`));
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
      setErr(code === "permission-denied" ? "You can only delete items you own." : (e as any)?.message ?? "Failed to delete."); throw e;
    }
  }


  async function editFromWidget(it: any) {
    const newName = prompt("Edit name", it.name ?? "") ?? it.name ?? "";
    const newQty = Number(prompt("Edit quantity", String(it.quantity ?? 1)) ?? (it.quantity ?? 1));
    await saveItem(it.id, { name: newName, quantity: newQty, expiresAt: it.expiresAt ?? null });
  }
  function deleteFromWidget(it: any) { return removeItem(it.id); }

 
  const active: Item[] = [];
  const expired: Item[] = [];
  items.forEach((it) => {
    const d = toDate(it.expiresAt);
    if (d && d < todayZero) expired.push(it);
    else active.push(it);
  });

  return (
    <main className="wrap">
      <header className="hero">
        <div className="left">
          <h1 className="title tracking-in-contract-bck-top">Pantry</h1>
          <p className="sub">Store groceries in your <strong>Fridge</strong>, keep an eye on <strong>Expired</strong> items.</p>
        </div>
        <div className="right"><PantryHelpButton /></div>
      </header>

      <section className="card addCard">
        <div className="bgOrbs" aria-hidden />
        <div className="addHead">
          <div>
            <h2 className="cardTitle">Add product</h2>
            <p className="muted small">Scan groceries, merge duplicates, and keep track of what’s fresh.</p>
          </div>

          
          <button
            type="button"
            className="camIcon"
            title="Scan with camera"
            onClick={() => { setScannerKey((k) => k + 1); setCamOpen(true); }}
            aria-label="Open camera"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h2l1.2-2.4A2 2 0 0 1 9 3h6a2 2 0 0 1 1.8 1.1L18 6h2a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3Z" stroke="currentColor" strokeWidth="1.6"/>
              <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.6"/>
            </svg>
          </button>
        </div>

        <div className="grid2">
          <Input label="Name" value={name} onChange={(e:any)=>setName(e.target.value)} placeholder="Pasta" />
          <Input label="Quantity" type="number" min={1} value={String(qty)} onChange={(e:any)=>setQty(Number(e.target.value))} />
          <div>
            <label className="label">Expiry date (optional)</label>
            <input className="textInput" type="date" min={minDate} value={date} onChange={(e)=>setDate(e.currentTarget.value)} />
          </div>
          <div className="barcodeRow">
            <Input label="Barcode" value={barcode} onChange={(e:any)=>setBarcode(String(e.target.value).trim())} placeholder="Type or scan digits" />
            <button type="button" className="btn" onClick={() => { setBarcode(""); setNutrition(null); setNutriErr(null); }}>Clear</button>
          </div>
        </div>

        {(nutrition?.name || nutrition?.kcalPer100g || nutrition?.kcalPerServing) && (
          <div className="nutri">
            <div className="nutTitle">Nutrition (from barcode)</div>
            <div className="nutGrid">
              <div><span className="muted">Name:</span> <strong>{normalizeProductName(nutrition?.name || "")}</strong></div>
              <div><span className="muted">kcal / 100g:</span> <strong>{nutrition?.kcalPer100g ?? "—"}</strong></div>
              <div><span className="muted">kcal / serving:</span> <strong>{nutrition?.kcalPerServing ?? "—"}</strong></div>
              <div><span className="muted">Serving size:</span> <strong>{nutrition?.servingSize ?? "—"}</strong></div>
            </div>
            {nutriBusy && <p className="muted small">Looking up nutrition…</p>}
            {nutriErr && <p className="error small">{nutriErr}</p>}
          </div>
        )}

        {err && <p className="error">{err}</p>}
        <div className="actions">
          <Button onClick={addOrMergeItem} disabled={busy} type="button">
            {busy ? "Saving…" : "Add / Merge"}
          </Button>
        </div>
      </section>

  
      <section className="list">
        <div className="secHead">
          <h2 className="secTitle">Active</h2>
          <span className="secBadge">{active.length}</span>
        </div>

        <div className={`widgetRow ${active.length === 0 ? "widgetRow--empty" : ""}`}>
          <Fridge
            items={active}               
            isOpen={fridgeOpen}
            onToggleOpen={setFridgeOpen}
            onEdit={editFromWidget}
            onDelete={deleteFromWidget}
          />
          {active.length === 0 && <div className="empty hint">Add something to your fridge to see it here.</div>}
        </div>
      </section>

 
      <section className="list">
        <div className="secHead">
          <h2 className="secTitle">Expired</h2>
          <br />
          <br />
          <br />
          <span className="secBadge warn">{expired.length}</span>
        </div>

        <div className={`widgetRow ${expired.length === 0 ? "widgetRow--empty" : ""}`}>
          <TrashCan
            items={expired}                
            isOpen={trashOpen}
            onToggleOpen={setTrashOpen}
            onEdit={editFromWidget}
            onDelete={deleteFromWidget}
          />
          {expired.length === 0 && <div className="empty hint">No expired items. 🎉</div>}
        </div>
      </section>

      {camOpen && (
        <CameraModal
          key={`cam-${scannerKey}`}
          open={camOpen}
          onClose={() => setCamOpen(false)}
          onDetected={(code) => onDetectedFromCam(code)}
        />
      )}

      <style jsx>{`
        .wrap { max-width: 1100px; margin: 0 auto; padding: 20px 16px 80px; }

        .hero {
          display:grid; grid-template-columns: 1fr auto; align-items:center;
          margin: 4px 0 18px;
        }
        .title { font-size: 34px; font-weight: 900; letter-spacing: -0.02em; margin: 0; color: var(--text); }
        .sub { color: var(--muted); margin: 6px 0 0; }
        .right { display:flex; align-items:center; gap:8px; }

        .card {
          position: relative;
          border:1px solid var(--border);
          background: var(--card-bg);
          border-radius:18px; padding:18px;
          box-shadow: 0 2px 12px rgba(16,24,40,.06), 0 16px 36px rgba(16,24,40,.08);
        }
        .addCard {
          overflow: hidden;
          isolation: isolate;
        }
        .bgOrbs {
          position:absolute; inset:-1px;
          background:
            radial-gradient(800px 280px at -10% -10%, color-mix(in oklab, var(--primary) 10%, transparent), transparent 60%),
            radial-gradient(600px 260px at 110% 10%, color-mix(in oklab, #60a5fa 12%, transparent), transparent 60%);
          filter: blur(6px);
          opacity: .7;
          pointer-events: none;
          z-index: 0;
        }
        .addHead { position:relative; z-index:1; display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        .cardTitle { font-size: 18px; font-weight: 800; color: var(--text); }

        .camIcon {
          width: 40px; height: 40px; border-radius: 999px;
          display:grid; place-items:center;
          background: var(--primary); color: var(--primary-contrast);
          border: 1px solid color-mix(in oklab, var(--primary) 30%, var(--border));
          box-shadow: 0 8px 24px rgba(0,0,0,.18);
          cursor: pointer; transition: transform .15s ease, filter .15s ease;
        }
        .camIcon:hover { filter: brightness(1.05); transform: translateY(-1px); }

        .grid2 { position:relative; z-index:1; display:grid; grid-template-columns:1fr 140px 200px 1fr; gap:12px 16px; align-items:start; }
        @media (max-width: 980px){ .grid2{ grid-template-columns:1fr 1fr; } }
        @media (max-width: 560px){ .grid2{ grid-template-columns:1fr; } }

        .label { display:block; margin-bottom:6px; font-size:.9rem; color:var(--text); font-weight:600; }
        .textInput {
          width:100%; border:1px solid var(--border); border-radius:14px; padding:11px 12px; font-size:14px;
          background: color-mix(in oklab, var(--bg2) 85%, white 15%); color: var(--text);
          backdrop-filter: blur(6px);
        }
        .textInput:focus { outline:none; border-color: var(--primary); box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 25%, transparent); }

        .barcodeRow { display:grid; grid-template-columns: 1fr auto; gap:8px; align-items:end; }
        .btn {
          border:1px solid var(--border); background:var(--bg2);
          padding:10px 14px; border-radius:12px; cursor:pointer; color: var(--text); font-weight:600;
          transition: background .12s ease, transform .05s ease;
        }
        .btn:hover{ background: color-mix(in oklab, var(--bg2) 85%, var(--primary) 15%); }
        .btn:active{ transform: translateY(1px); }

        .nutri {
          position:relative; z-index:1;
          margin-top: 12px; padding: 12px;
          border:1px solid color-mix(in oklab, var(--border) 70%, transparent);
          border-radius: 14px;
          background: color-mix(in oklab, var(--bg) 92%, var(--primary) 8%);
        }
        .nutTitle { font-weight:800; margin-bottom:6px; color: var(--text); }
        .nutGrid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px 12px; }
        @media (max-width:560px){ .nutGrid{ grid-template-columns:1fr; } }

        .actions { margin-top:14px; display:flex; gap:12px; justify-content:flex-end; }

        .list { margin-top: 24px; }
        .secHead { display:flex; align-items:center; gap:10px; }
        .secTitle { font-size:16px; font-weight:800; margin: 0; color: var(--text); }
        .secBadge { display:inline-grid; place-items:center; min-width:26px; height:22px; padding:0 8px; border-radius:999px; font-size:12px; font-weight:700; color:#0f172a; background:#e5f0ff; border:1px solid #cfe1ff; }
        .secBadge.warn { background:#ffe5e5; border-color:#ffcfcf; }

        .widgetRow { display:flex; align-items:flex-start; gap:16px; }
        .widgetRow--empty { gap: 24px; align-items: center; }

        .empty { color: var(--muted); font-size:14px; padding:16px; text-align:center; border:1px dashed var(--border); border-radius:12px; background: var(--bg); }
        .empty.hint { background: transparent; }

        .muted { color: var(--muted); }
        .small { font-size:12px; }
        .error { margin-top:8px; background: color-mix(in oklab, #ef4444 15%, var(--card-bg)); color:#7f1d1d; border:1px solid color-mix(in oklab, #ef4444 35%, var(--border)); border-radius:8px; padding:8px 10px; font-size:13px; }

        /* headline animation */
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
