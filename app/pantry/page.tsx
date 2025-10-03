/* app/pantry/page.tsx */
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

import Button from "@/components/ui/Button";
import PantryCard, { PantryCardItem } from "@/components/pantry/PantryCard";
import BarcodeScanner from "@/components/pantry/BarcodeScanner";
import PantryHelpButton from "@/components/pantry/PantryHelpButton";
import { fetchNutritionByBarcode, NutritionInfo } from "@/lib/nutrition";
import Fridge from "@/components/pantry/Fridge";
import TrashCan from "@/components/pantry/TrashCan";
import HealthCoach from "@/components/pantry/HealthCoach";

/* ---------- TS helpers ---------- */
type TSLike = Timestamp | { seconds: number; nanoseconds: number } | Date | null | undefined;

/* ---------- utilities ---------- */
const looksLikeBarcode = (s: string) => /^\d{6,}$/.test(s);
const capFirst = (s: string) => s.replace(/^\p{L}/u, (m) => m.toUpperCase());
const todayStr = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`; };
const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };

function toDate(ts?: TSLike | null) {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  const anyTs: any = ts;
  if (typeof anyTs?.toDate === "function") return anyTs.toDate();
  if (typeof anyTs?.seconds === "number") return new Date(anyTs.seconds * 1000);
  if (typeof ts === "string" && !Number.isNaN(Date.parse(ts))) return new Date(ts);
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

/* ---------- page-level item type ---------- */
type PantryItemPage = {
  id: string;
  uid?: string;
  name: string;
  nameKey?: string;
  quantity: number;
  createdAt?: TSLike | null;
  expiresAt?: TSLike | null;
  barcode?: string | null;
  nutrition?: NutritionInfo | null;
};

/* ---------- consumption log type ---------- */
type ConsumptionLog = {
  id: string;
  uid: string;
  itemId: string;
  name: string;
  grams: number;
  sugars_g: number;
  satFat_g: number;
  sodium_g: number;
  kcal: number;
  createdAt: TSLike | null;
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

  // nutrition (for add form)
  const [nutrition, setNutrition] = useState<NutritionInfo | null>(null);
  const [nutriBusy, setNutriBusy] = useState(false);
  const [nutriErr, setNutriErr] = useState<string | null>(null);

  // state
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<PantryItemPage[]>([]);
  const stopRef = useRef<null | (() => void)>(null);

  // consumption logs
  const [logs, setLogs] = useState<ConsumptionLog[]>([]);

  const minDate = todayStr();
  const todayStart = useMemo(startOfToday, []);

  const [fridgeOpen, setFridgeOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);

  /* auth + live items + live logs */
  useEffect(() => {
    const stopAuth = onAuthStateChanged(auth, (u) => {
      if (stopRef.current) { stopRef.current(); stopRef.current = null; }
      if (!u) { router.replace("/auth/login"); setItems([]); setLogs([]); return; }

      // pantry items
      const qy = query(
        collection(db, "pantryItems"),
        where("uid", "==", u.uid),
        orderBy("createdAt", "desc")
      );
      const stopItems = onSnapshot(
        qy,
        (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PantryItemPage[]),
        (e) => setErr(e?.message ?? "Could not load pantry.")
      );

      const qLogs = query(
        collection(db, "consumptionLogs"),
        where("uid", "==", u.uid)
      );
      const stopLogs = onSnapshot(
        qLogs,
        (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ConsumptionLog[]),
        (e) => console.error("consumptionLogs listener failed:", (e as FirebaseError)?.code || "", (e as FirebaseError)?.message)
      );

      stopRef.current = () => { stopItems(); stopLogs(); };
    });
    return () => { if (stopRef.current) stopRef.current(); stopAuth(); };
  }, [router]);

  /* nutrition lookup (barcode) for add form */
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
    }, 280);
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
      const p: any = patch.expiresAt;
      if (typeof p?.toDate === "function") toWrite.expiresAt = p;
      else if (p instanceof Date) toWrite.expiresAt = Timestamp.fromDate(p);
      else if (typeof p?.seconds === "number") toWrite.expiresAt = Timestamp.fromDate(new Date(p.seconds * 1000));
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
  const active: PantryItemPage[] = [];
  const expired: PantryItemPage[] = [];
  items.forEach((it) => {
    const d = toDate(it.expiresAt);
    if (d && d < todayStart) expired.push(it);
    else active.push(it);
  });

  /* for Fridge/TrashCan */
  const fridgeItems = active.map((it) => ({
    id: it.id, uid: it.uid, name: it.name, quantity: it.quantity,
    expiresAt: it.expiresAt ?? null, barcode: it.barcode ?? null, nutrition: it.nutrition ?? null,
  }));
  const trashItems = expired.map((it) => ({
    id: it.id, uid: it.uid, name: it.name, quantity: it.quantity,
    expiresAt: it.expiresAt ?? null, barcode: it.barcode ?? null, nutrition: it.nutrition ?? null,
  }));

  /* ---------- CONSUMPTION: write + totals ---------- */
  async function logConsumptionForItem(it: PantryItemPage, payload: { grams: number; nutrients: { sugars_g: number; satFat_g: number; sodium_g: number; kcal: number }}) {
    const u = auth.currentUser;
    if (!u) { router.replace("/auth/login"); return; }
    try {
      await addDoc(collection(db, "consumptionLogs"), {
        uid: u.uid,
        itemId: it.id,
        name: it.name,
        grams: payload.grams,
        sugars_g: payload.nutrients.sugars_g,
        satFat_g: payload.nutrients.satFat_g,
        sodium_g: payload.nutrients.sodium_g,
        kcal: payload.nutrients.kcal,
        createdAt: serverTimestamp(),
      });
    } catch (e: any) {
      console.error("Failed to log consumption", e);
    }
  }

  // Aggregate logs -> week/month
  const totalsWeek = useMemo(() => {
    const out = { sugars_g: 0, satFat_g: 0, sodium_g: 0, kcal: 0 };
    const since = new Date(); since.setDate(since.getDate() - 7);
    logs.forEach(l => {
      const d = toDate(l.createdAt); if (!d || d < since) return;
      out.sugars_g += l.sugars_g || 0;
      out.satFat_g += l.satFat_g || 0;
      out.sodium_g += l.sodium_g || 0;
      out.kcal += l.kcal || 0;
    });
    return out;
  }, [logs]);

  const totalsMonth = useMemo(() => {
    const out = { sugars_g: 0, satFat_g: 0, sodium_g: 0, kcal: 0 };
    const since = new Date(); since.setDate(since.getDate() - 30);
    logs.forEach(l => {
      const d = toDate(l.createdAt); if (!d || d < since) return;
      out.sugars_g += l.sugars_g || 0;
      out.satFat_g += l.satFat_g || 0;
      out.sodium_g += l.sodium_g || 0;
      out.kcal += l.kcal || 0;
    });
    return out;
  }, [logs]);

  return (
    <main className="wrap">
      {/* HERO */}
      <section className="hero">
        <div className="heroInner">
          <div className="heroLeft">
            <h1 className="title">Pantry</h1>
            <p className="sub">Log groceries, track freshness, and keep your <span className="hl">Fridge</span> stocked.</p>
          </div>
          <div className="heroRight"><PantryHelpButton /></div>
        </div>
      </section>

      {/* QUICK STATS */}
      <section className="stats">
        <div className="stat"><div className="sTop"><span className="dot dot-ok" /> Active</div><div className="sNum">{active.length}</div></div>
        <div className="stat"><div className="sTop"><span className="dot dot-warn" /> Expired</div><div className="sNum">{expired.length}</div></div>
        <div className="stat"><div className="sTop"><span className="dot" /> Total</div><div className="sNum">{items.length}</div></div>
      </section>

      {/* HEALTH COACH */}
      <HealthCoach
        week={{ title: "This week", totals: totalsWeek }}
        month={{ title: "This month", totals: totalsMonth }}
      />

      {/* ADD PRODUCT */}
      <section className="card addCard">
        <div className="addHead">
          <div className="addIcon" aria-hidden>➕</div>
          <div>
            <div className="addTitle">Add product</div>
            <div className="addSub">Scan a barcode or type manually. We’ll merge duplicates automatically.</div>
          </div>
        </div>

        <div className="addGrid">
          <div className="field">
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Pasta" aria-label="Product name" />
          </div>
          <div className="field">
            <label className="label">Quantity</label>
            <input className="input" type="number" min={1} value={String(qty)} onChange={(e)=>setQty(Math.max(1, Number(e.target.value)||1))} aria-label="Quantity" />
          </div>
          <div className="field">
            <label className="label">Expiry</label>
            <input className="input" type="date" min={minDate} value={date} onChange={(e)=>setDate(e.currentTarget.value)} aria-label="Expiry date" />
          </div>
          <div className="barcodeRow">
            <div className="field">
              <label className="label">Barcode</label>
              <input className="input" value={barcode} onChange={(e)=>setBarcode(String(e.target.value).trim())} placeholder="Scan or type digits" aria-label="Barcode" />
            </div>
            <button type="button" className="btn ghost" onClick={() => { setBarcode(""); setNutrition(null); setNutriErr(null); }}>Clear</button>
          </div>

          <div className="scannerCol">
            <label className="label">Scan with camera</label>
            <div className="scanner"><BarcodeScanner key={scannerKey} autoStart={scannerAutoStart} onDetected={handleDetected} /></div>
            <div className="rowHint">
              {nutriBusy ? <span className="muted small">Looking up nutrition…</span> : <span className="muted small">Tip: hold steady 20–30cm away</span>}
              {nutriErr ? <span className="error small">{nutriErr}</span> : null}
            </div>
          </div>
        </div>

        {(nutrition?.name || nutrition?.kcalPer100g || nutrition?.kcalPerServing) && (
          <div className="nutri">
            <div className="nutTitle">Nutrition (from barcode)</div>
            <div className="nutGrid">
              <div><span className="muted">Name</span> <strong>{normalizeProductName(nutrition?.name || "")}</strong></div>
              <div><span className="muted">kcal / 100g</span> <strong>{nutrition?.kcalPer100g ?? "—"}</strong></div>
              <div><span className="muted">kcal / serving</span> <strong>{nutrition?.kcalPerServing ?? "—"}</strong></div>
              <div><span className="muted">Serving size</span> <strong>{nutrition?.servingSize ?? "—"}</strong></div>
            </div>
          </div>
        )}

        {err && <p className="error">{err}</p>}
        <div className="actions"><Button onClick={addOrMergeItem} disabled={busy} type="button">{busy ? "Saving…" : "Add / Merge"}</Button></div>
      </section>

      {/* ACTIVE + FRIDGE */}
      <section className="list">
        <div className={`twoCol ${fridgeOpen ? "focus" : ""}`}>
          <aside className="leftCol">
            <Fridge
              items={fridgeItems}
              isOpen={fridgeOpen}
              onToggleOpen={(v) => { setFridgeOpen(v); if (v) setTrashOpen(false); }}
              minimal
            />
          </aside>
          <div className="rightCol">
            <div className="sectionHead"><h2 className="secTitle">Active</h2></div>
            {active.length === 0 ? (
              <div className="empty"><div className="emoji">🧺</div><p className="emptyTitle">Your pantry is squeaky clean</p><p className="muted">Add a few items to get started.</p></div>
            ) : (
              <div className="gridCards">
                {active.map((it) => (
                  <PantryCard
                    key={it.id}
                    item={it as unknown as PantryCardItem}
                    onDelete={() => removeItem(it.id)}
                    onSave={(patch) => saveItem(it.id, patch)}
                    onConsume={(payload) => logConsumptionForItem(it, payload)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* EXPIRED + TRASHCAN */}
      <section className="list" style={{ marginTop: 20 }}>
        <div className={`twoCol ${trashOpen ? "focus" : ""}`}>
          <aside className="leftCol">
            <TrashCan
              items={trashItems as any}
              isOpen={trashOpen}
              onToggleOpen={(v) => { setTrashOpen(v); if (v) setFridgeOpen(false); }}
              minimal
            />
          </aside>
          <div className="rightCol">
            <div className="sectionHead"><h2 className="secTitle">Expired</h2></div>
            {expired.length === 0 ? (
              <div className="empty ok"><div className="emoji">🎉</div><p className="emptyTitle">Nothing expired</p><p className="muted">Keep it fresh!</p></div>
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
          </div>
        </div>
      </section>

      <style jsx>{`
        .wrap { max-width: 1120px; margin: 0 auto; padding: 20px 16px 96px; }

        /* ---------- HERO ---------- */
        .hero { position: relative; margin: 6px 0 18px; }
        .heroInner { position: relative; border: 1px solid var(--border); background: color-mix(in oklab, var(--bg) 92%, transparent); backdrop-filter: blur(6px); border-radius: 22px; padding: 18px; display: grid; grid-template-columns: 1fr auto; align-items: center; box-shadow: 0 12px 38px rgba(2,6,23,.08); }
        .heroLeft { display: grid; gap: 6px; }
        .title { font-size: clamp(26px, 4vw, 36px); font-weight: 900; letter-spacing: -0.02em; margin: 0; color: var(--text); }
        .sub { color: var(--muted); margin: 0; font-size: 15px; }
        .hl { color: var(--text); font-weight: 800; background: linear-gradient(90deg, color-mix(in oklab, var(--primary) 16%, transparent), transparent); padding: 0 6px; border-radius: 8px; }

        /* ---------- LAYOUT ---------- */
        .twoCol{ display:grid; grid-template-columns: 240px 1fr; gap:16px; align-items:start; }
        .leftCol{ position: relative; }
        @media (min-width: 900px){ .leftCol{ position: sticky; top: 8px; height: fit-content; } }
        .rightCol{ min-width:0; }

        /* Focus mode */
        .twoCol.focus { grid-template-columns: 1fr; position: relative; }
        .twoCol.focus .leftCol { position: relative; top: auto; margin: 0 auto; width: min(560px, 92vw); transform: translateY(0); z-index: 3; transition: transform .18s ease, width .18s ease, box-shadow .18s ease; }
        .twoCol.focus .rightCol { display: none; }
        .twoCol.focus .leftCol > * { box-shadow: 0 24px 64px rgba(2,6,23,.20), 0 4px 12px rgba(2,6,23,.10); transform: scale(1.02); }
        .twoCol.focus::after { content: ""; position: absolute; inset: -8px; background: radial-gradient(60% 60% at 50% 20%, rgba(2,6,23,.22), transparent 70%); pointer-events: none; border-radius: 20px; }

        /* ---------- STATS ---------- */
        .stats { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; margin: 10px 0 18px; }
        .stat { border: 1px solid var(--border); background: var(--card-bg); border-radius: 16px; padding: 12px 14px; box-shadow: 0 8px 30px rgba(2,6,23,.06); }
        .sTop { display: flex; align-items: center; gap: 8px; color: var(--muted); font-weight: 700; font-size: 12px; }
        .dot { width: 8px; height: 8px; border-radius: 999px; background: var(--muted); display: inline-block; }
        .dot-ok { background: #10b981; }
        .dot-warn { background: #f59e0b; }
        .sNum { font-weight: 900; font-size: 24px; line-height: 1; margin-top: 6px; }

        /* ---------- CARD BASE ---------- */
        .card { border: 1px solid var(--border); background: linear-gradient(180deg, color-mix(in oklab, var(--card-bg) 92%, transparent), var(--card-bg)); border-radius: 20px; padding: 16px; box-shadow: 0 14px 40px rgba(2,6,23,.06), 0 2px 10px rgba(2,6,23,.04); }

        /* ---------- ADD CARD ---------- */
        .addCard { margin-bottom: 24px; }
        .addHead { display:flex; align-items:center; gap:12px; margin-bottom: 14px; }
        .addIcon { width:36px; height:36px; border-radius:12px; display:grid; place-items:center; background: color-mix(in oklab, var(--primary) 18%, var(--bg2)); border:1px solid var(--border); font-weight:800; box-shadow: 0 6px 16px rgba(2,6,23,.08); }
        .addTitle { font-weight:900; letter-spacing:-.01em; }
        .addSub { color: var(--muted); font-size: 13px; margin-top: 2px; }

        .addGrid { display:grid; grid-template-columns: 1.2fr .5fr .8fr 1fr; gap: 12px 16px; align-items:end; }
        @media (max-width: 1000px){ .addGrid{ grid-template-columns:1fr 1fr; } }
        @media (max-width: 560px){ .addGrid{ grid-template-columns:1fr; } }

        .field { display:grid; gap:6px; }
        .label { font-size:.84rem; color:var(--muted); font-weight:700; }
        .input { width:100%; border:1px solid var(--border); border-radius:12px; padding:10px 12px; background: var(--bg2); color: var(--text); outline: none; transition: border-color .15s ease, box-shadow .15s ease, background .2s ease, transform .04s ease; }
        .input:focus { border-color: color-mix(in oklab, var(--primary) 60%, var(--border)); box-shadow: 0 0 0 4px color-mix(in oklab, var(--primary) 22%, transparent); background: var(--bg); }
        .input:active { transform: translateY(1px); }

        .barcodeRow { display:grid; grid-template-columns: 1fr auto; gap:10px; align-items:end; }
        .btn { border:1px solid var(--border); background:var(--bg2); padding:10px 14px; border-radius:12px; cursor:pointer; color: var(--text); font-weight:800; transition: background .2s ease, transform .04s ease; }
        .btn:active{ transform: translateY(1px); }
        .btn.ghost:hover{ background: color-mix(in oklab, var(--bg2) 85%, var(--primary) 15%); }

        .scannerCol { display:grid; gap:8px; }
        .scanner { border:1px dashed var(--border); background: var(--bg); border-radius: 14px; padding: 8px; }
        .rowHint { display:flex; gap:12px; align-items:center; }
        .muted { color: var(--muted); }
        .small { font-size:12px; }

        .nutri { margin-top: 12px; border:1px dashed var(--border); background: color-mix(in oklab, var(--bg) 92%, var(--primary) 8%); border-radius:14px; padding:10px 12px; }
        .nutTitle { font-weight:900; margin-bottom:6px; color: var(--text); }
        .nutGrid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px 12px; }
        @media (max-width:560px){ .nutGrid{ grid-template-columns:1fr; } }

        .actions { margin-top:14px; display:flex; gap:12px; justify-content:flex-end; }
        .error { background: color-mix(in oklab, #ef4444 15%, var(--card-bg)); color:#7f1d1d; border:1px solid color-mix(in oklab, #ef4444 35%, var(--border)); border-radius:10px; padding:8px 10px; font-size:13px; }

        /* ---------- LISTS ---------- */
        .list { margin-top: 18px; }
        .sectionHead { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom: 10px; }
        .secTitle { font-size:16px; font-weight:900; margin: 0; color: var(--text); letter-spacing: -0.01em; }

        .gridCards { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:16px; animation: fadeIn .24s ease-out both; }
        @media (max-width: 900px){ .gridCards{ grid-template-columns:repeat(2, minmax(0,1fr)); } }
        @media (max-width: 600px){ .gridCards{ grid-template-columns:1fr; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }

        .empty { text-align:center; border:1px dashed var(--border); border-radius:16px; padding: 24px 14px; background: var(--bg); }
        .empty.ok { background: color-mix(in oklab, #10b981 10%, var(--bg)); border-color: color-mix(in oklab, #10b981 35%, var(--border)); }
        .emoji { font-size: 28px; }
        .emptyTitle { margin: 6px 0 2px; font-weight: 900; color: var(--text); }
      `}</style>
    </main>
  );
}
