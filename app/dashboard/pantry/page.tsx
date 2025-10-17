"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type PantryItem = {
  id: string;
  uid: string;
  name: string;
  qty: number;
  expiresAt?: string | null;
  photoURL?: string | null;
};

const TRASH_PLACEHOLDERS = [
  "Expired yogurt cups",
  "Mystery leftovers",
  "Soggy lettuce mix",
  "Empty condiment bottles",
];

const FRIDGE_DECOR = ["🍎", "🥛", "🍇", "🥐"];
const TRASH_DECOR = ["🧻", "🪴", "🫧"];

export default function PantryPage() {
  const router = useRouter();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [activeView, setActiveView] = useState<"fridge" | "trash" | null>(null);
  const [spinning, setSpinning] = useState<"fridge" | "trash" | null>(null);
  const [opening, setOpening] = useState<"fridge" | "trash" | null>(null);

  useEffect(() => {
    const current = auth.currentUser;
    if (!current) {
      router.replace("/auth/login");
      return;
    }

    const base = query(
      collection(db, "pantryItems"),
      where("uid", "==", current.uid),
      orderBy("expiresAt", "asc")
    );

    const unsub = onSnapshot(
      base,
      (snap) => {
        const docs = snap.docs.map((docSnap) => {
          const { id: _ignored, ...rest } = docSnap.data() as PantryItem;
          return { id: docSnap.id, ...rest } as PantryItem;
        });
        setItems(docs);
      },
      (error) => {
        console.error(error);
        setStatus("error");
        setMsg("We couldn't load your pantry items. Please check your access.");
      }
    );

    return () => unsub();
  }, [router]);

  const sortedItems = useMemo(() => {
    const toTime = (value?: string | null) => {
      if (!value) return Number.MAX_SAFE_INTEGER;
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
    };
    return [...items].sort((a, b) => {
      const diff = toTime(a.expiresAt) - toTime(b.expiresAt);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
  }, [items]);

  function enterView(next: "fridge" | "trash") {
    if (activeView || spinning || opening) return;
    setSpinning(next);
    setTimeout(() => setOpening(next), 140);
    setTimeout(() => {
      setActiveView(next);
      setSpinning(null);
      setOpening(null);
    }, 720);
  }

  function exitView() {
    setActiveView(null);
  }

  async function addItem() {
    setMsg(null);
    setStatus(null);
    const current = auth.currentUser;
    if (!current) {
      router.replace("/auth/login");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setStatus("error");
      setMsg("Name your pantry item before saving.");
      return;
    }
    try {
      await addDoc(collection(db, "pantryItems"), {
        uid: current.uid,
        name: trimmed,
        qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
        expiresAt: expiresAt || null,
        createdAt: serverTimestamp(),
      });
      setName("");
      setQty(1);
      setExpiresAt("");
      setStatus("success");
      setMsg("Item added to your fridge.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to add item.";
      setStatus("error");
      setMsg(message);
    }
  }

  const fridgeEmpty = sortedItems.length === 0;

  const fridgeTileClass = [
    "tile",
    "tile-fridge",
    spinning === "fridge" ? "is-spinning" : "",
    opening === "fridge" ? "is-opening" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const trashTileClass = [
    "tile",
    "tile-trash",
    spinning === "trash" ? "is-spinning" : "",
    opening === "trash" ? "is-opening" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="pantry">
      <div className="pantryContainer">
        <header className="pantryHeader">
          <div>
            <p className="eyebrow">Pantry control</p>
            <h1>Pantry hub</h1>
            <p className="intro">
              Manage what stays chilled and what gets tossed with a playful, 3D peek at your kitchen.
            </p>
          </div>
        </header>

        {msg && (
          <p
            className={`alert ${
              status === "error" ? "alert-error" : status === "success" ? "alert-success" : ""
            }`}
          >
            {msg}
          </p>
        )}

        <section className={`tiles ${activeView ? "tiles-hidden" : ""}`}>
          <button type="button" className={fridgeTileClass} onClick={() => enterView("fridge")}>
            <div className="tile-inner">
              <div className="fridge-shell">
                <div className="fridge-door" />
                <div className="fridge-handle" />
                <div className="fridge-light" />
                <div className="fridge-base" />
              </div>
            </div>
            <span className="tile-label">Fridge</span>
          </button>

          <button type="button" className={trashTileClass} onClick={() => enterView("trash")}>
            <div className="tile-inner">
              <div className="trash-shell">
                <div className="trash-body" />
                <div className="trash-lid" />
                <div className="trash-band" />
              </div>
            </div>
            <span className="tile-label">Trash</span>
          </button>
        </section>

        {activeView && (
          <section className={`immersive immersive-${activeView}`}>
            <div className="immersive-head">
              <div>
                <h2>{activeView === "fridge" ? "Inside the fridge" : "Trash queue"}</h2>
                <p>
                  {activeView === "fridge"
                    ? "Spin into an immersive shelf view with your freshest ingredients front and center."
                    : "When items turn questionable, queue them here before they leave the kitchen for good."}
                </p>
              </div>
              <button type="button" className="backButton" onClick={exitView}>
                Back to hub
              </button>
            </div>

            <div className="immersive-body">
              {activeView === "fridge" ? (
                <>
                  {fridgeEmpty ? (
                    <div className="empty">Your fridge is squeaky clean. Add something below.</div>
                  ) : (
                    <ul className="inventory">
                      {sortedItems.map((item) => (
                        <li key={item.id} className="inventory-item">
                          <div>
                            <span className="inventory-name">{item.name}</span>
                            <span className="inventory-meta">
                              {item.expiresAt ? `Expires ${item.expiresAt}` : "No expiry set"}
                            </span>
                          </div>
                          <span className="inventory-qty">×{item.qty}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="immersive-decor">
                    {FRIDGE_DECOR.map((emoji, index) => (
                      <span key={`fridge-${index}`} className={`decor decor-${index + 1}`}>
                        {emoji}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <ul className="inventory trash">
                    {TRASH_PLACEHOLDERS.map((item, index) => (
                      <li key={item} className="inventory-item">
                        <div>
                          <span className="inventory-name">{item}</span>
                          <span className="inventory-meta">Ready to toss</span>
                        </div>
                        <span className="inventory-qty">#{index + 1}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="immersive-decor">
                    {TRASH_DECOR.map((emoji, index) => (
                      <span key={`trash-${index}`} className={`decor decor-${index + 1}`}>
                        {emoji}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        <Card className="addCard">
          <div className="addCopy">
            <h2>Quick add</h2>
            <p>Log pantry items directly from the hub to keep your inventory fresh.</p>
          </div>
          <form
            className="addForm"
            onSubmit={(event) => {
              event.preventDefault();
              addItem();
            }}
          >
            <label className="field">
              <span>Item name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Greek yogurt"
                required
              />
            </label>
            <label className="field">
              <span>Quantity</span>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setQty(Number.isFinite(next) && next > 0 ? next : 1);
                }}
              />
            </label>
            <label className="field">
              <span>Expiry</span>
              <input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            </label>
            <Button type="submit" className="addButton">
              Add item
            </Button>
          </form>
        </Card>
      </div>

      <style jsx>{`
        .pantry {
          padding: 32px 0 120px;
        }
        .pantryContainer {
          width: min(1120px, 100%);
          margin: 0 auto;
          padding: 0 16px;
          display: grid;
          gap: 32px;
        }
        .pantryHeader {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }
        .eyebrow {
          margin: 0 0 6px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 11px;
          font-weight: 700;
          color: var(--muted);
        }
        h1 {
          margin: 0;
          font-size: clamp(28px, 4vw, 40px);
          font-weight: 800;
        }
        .intro {
          margin: 8px 0 0;
          max-width: 520px;
          color: var(--muted);
        }
        .tiles {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 24px;
          perspective: 1400px;
          transition: opacity 0.3s ease, transform 0.3s ease;
        }
        .tiles-hidden {
          opacity: 0;
          pointer-events: none;
          transform: scale(0.97);
        }
        .tile {
          position: relative;
          border: 0;
          padding: 0;
          background: none;
          cursor: pointer;
          display: grid;
          gap: 16px;
        }
        .tile-inner {
          border-radius: var(--radius-card);
          border: 1px solid color-mix(in oklab, var(--primary) 8%, var(--border));
          background: linear-gradient(
            135deg,
            color-mix(in oklab, var(--bg-raised) 90%, var(--primary) 10%),
            var(--bg)
          );
          padding: 24px;
          min-height: 280px;
          display: grid;
          place-items: center;
          transform-style: preserve-3d;
          transition: box-shadow 0.3s ease, border-color 0.3s ease, transform 0.3s ease;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.14);
        }
        .tile:hover .tile-inner {
          transform: translateY(-4px);
          box-shadow: 0 24px 48px rgba(15, 23, 42, 0.18);
          border-color: color-mix(in oklab, var(--primary) 25%, var(--border));
        }
        .tile:focus-visible .tile-inner {
          outline: none;
          box-shadow: 0 0 0 4px color-mix(in oklab, var(--primary) 28%, transparent);
        }
        .tile-label {
          font-weight: 700;
          font-size: 15px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--muted);
          text-align: center;
        }
        .tile-fridge .tile-inner {
          background: linear-gradient(
            135deg,
            color-mix(in oklab, #4f46e5 22%, var(--bg) 78%),
            color-mix(in oklab, #22d3ee 22%, var(--bg) 78%)
          );
        }
        .tile-trash .tile-inner {
          background: linear-gradient(
            145deg,
            color-mix(in oklab, #f97316 18%, var(--bg) 82%),
            color-mix(in oklab, #ec4899 18%, var(--bg) 82%)
          );
        }
        .fridge-shell {
          position: relative;
          width: 220px;
          max-width: 100%;
          aspect-ratio: 3 / 5;
          border-radius: var(--radius-card);
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.24), rgba(15, 23, 42, 0.18));
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
          transform: translateZ(10px);
          overflow: hidden;
        }
        .fridge-door {
          position: absolute;
          top: 10%;
          right: 6%;
          width: 58%;
          height: 80%;
          border-radius: var(--radius-card);
          background: linear-gradient(120deg, rgba(15, 23, 42, 0.82), rgba(30, 41, 59, 0.55));
          transform-origin: left center;
          transition: transform 0.6s ease;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08), 0 18px 30px rgba(15, 23, 42, 0.3);
        }
        .fridge-handle {
          position: absolute;
          top: 40%;
          right: 10%;
          width: 6px;
          height: 40%;
          border-radius: 999px;
          background: color-mix(in oklab, #eef2ff 70%, rgba(15, 23, 42, 0.6));
          box-shadow: inset -1px 0 4px rgba(15, 23, 42, 0.6);
        }
        .fridge-light {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.22), transparent 65%);
          mix-blend-mode: screen;
        }
        .fridge-base {
          position: absolute;
          bottom: 4%;
          left: 10%;
          width: 80%;
          height: 8px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.25);
        }
        .trash-shell {
          position: relative;
          width: 200px;
          max-width: 100%;
          aspect-ratio: 1 / 1.2;
          border-radius: calc(var(--radius-card) - 6px);
          background: linear-gradient(150deg, rgba(15, 23, 42, 0.14), rgba(255, 255, 255, 0.22));
          transform: translateZ(10px);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
          overflow: hidden;
        }
        .trash-body {
          position: absolute;
          inset: 14% 12% 6%;
          border-radius: calc(var(--radius-card) - 10px);
          background: linear-gradient(160deg, rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.4));
          box-shadow: inset 0 0 25px rgba(15, 23, 42, 0.6);
        }
        .trash-lid {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%) rotateX(0deg);
          transform-origin: center top;
          width: 110%;
          height: 22%;
          border-radius: 18px;
          background: linear-gradient(150deg, rgba(255, 255, 255, 0.65), rgba(15, 23, 42, 0.65));
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25), 0 12px 24px rgba(15, 23, 42, 0.25);
          transition: transform 0.55s ease;
        }
        .trash-band {
          position: absolute;
          top: 34%;
          left: 10%;
          width: 80%;
          height: 10%;
          border-radius: 12px;
          background: linear-gradient(90deg, rgba(255, 255, 255, 0.2), transparent);
        }
        .tile.is-spinning .tile-inner {
          animation: tile-spin 0.6s ease forwards;
        }
        .tile.is-opening.tile-fridge .fridge-door {
          transform: rotateY(-78deg);
        }
        .tile.is-opening.tile-trash .trash-lid {
          transform: translateX(-50%) rotateX(-96deg);
        }
        .alert {
          border-radius: var(--radius-card);
          padding: 12px 16px;
          font-size: 14px;
          border: 1px solid color-mix(in oklab, var(--primary) 18%, var(--border));
          background: color-mix(in oklab, var(--primary) 10%, transparent);
          color: var(--text);
        }
        .alert-success {
          border-color: color-mix(in oklab, #10b981 40%, var(--border));
          background: color-mix(in oklab, #10b981 16%, transparent);
          color: #065f46;
        }
        .alert-error {
          border-color: color-mix(in oklab, #ef4444 42%, var(--border));
          background: color-mix(in oklab, #ef4444 16%, transparent);
          color: #7f1d1d;
        }
        .immersive {
          position: relative;
          padding: clamp(24px, 4vw, 36px);
          border-radius: var(--radius-card);
          border: 1px solid color-mix(in oklab, var(--primary) 16%, var(--border));
          background: linear-gradient(
            135deg,
            color-mix(in oklab, var(--bg-raised) 90%, var(--primary) 10%),
            color-mix(in oklab, var(--bg) 80%, transparent)
          );
          box-shadow: 0 28px 60px rgba(15, 23, 42, 0.2);
          overflow: hidden;
          display: grid;
          gap: 24px;
        }
        .immersive-fridge {
          background: linear-gradient(
            135deg,
            color-mix(in oklab, #1d4ed8 28%, var(--bg) 72%),
            color-mix(in oklab, #22d3ee 24%, var(--bg) 76%)
          );
        }
        .immersive-trash {
          background: linear-gradient(
            135deg,
            color-mix(in oklab, #f97316 22%, var(--bg) 78%),
            color-mix(in oklab, #ef4444 22%, var(--bg) 78%)
          );
        }
        .immersive::before {
          content: "";
          position: absolute;
          inset: -20% -20% auto -20%;
          height: 60%;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.35), transparent 70%);
          opacity: 0.4;
          pointer-events: none;
        }
        .immersive-head {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .immersive-head h2 {
          margin: 0;
          font-size: clamp(22px, 3vw, 30px);
          font-weight: 800;
          color: #fff;
        }
        .immersive-head p {
          margin: 6px 0 0;
          color: rgba(255, 255, 255, 0.8);
          max-width: 460px;
        }
        .backButton {
          border: 0;
          background: rgba(15, 23, 42, 0.16);
          color: #fff;
          border-radius: var(--radius-button);
          padding: 10px 16px;
          font-weight: 600;
          cursor: pointer;
          backdrop-filter: blur(12px);
          transition: transform 0.12s ease, background 0.18s ease, box-shadow 0.18s ease;
        }
        .backButton:hover {
          background: rgba(15, 23, 42, 0.28);
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.28);
        }
        .backButton:active {
          transform: translateY(1px);
        }
        .immersive-body {
          position: relative;
          min-height: 220px;
          display: grid;
          align-content: start;
        }
        .inventory {
          position: relative;
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 12px;
          z-index: 1;
        }
        .inventory-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 18px;
          border-radius: var(--radius-button);
          border: 1px solid rgba(255, 255, 255, 0.22);
          background: rgba(15, 23, 42, 0.16);
          color: #fff;
          backdrop-filter: blur(12px);
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.2);
        }
        .inventory-name {
          font-weight: 700;
          display: block;
        }
        .inventory-meta {
          font-size: 12px;
          opacity: 0.8;
          display: block;
          margin-top: 4px;
        }
        .inventory-qty {
          font-weight: 700;
          font-size: 18px;
          letter-spacing: 0.06em;
        }
        .inventory.trash .inventory-item {
          background: rgba(255, 255, 255, 0.08);
          color: #1f2937;
          border-color: rgba(255, 255, 255, 0.6);
        }
        .immersive-decor {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .immersive-decor .decor {
          position: absolute;
          font-size: 34px;
          opacity: 0.5;
          filter: drop-shadow(0 10px 18px rgba(15, 23, 42, 0.3));
          animation: float 6s ease-in-out infinite;
        }
        .immersive-fridge .decor-1 {
          top: 10%;
          left: 8%;
          animation-delay: 0s;
        }
        .immersive-fridge .decor-2 {
          bottom: 12%;
          left: 12%;
          animation-delay: 0.8s;
        }
        .immersive-fridge .decor-3 {
          top: 18%;
          right: 14%;
          animation-delay: 1.4s;
        }
        .immersive-fridge .decor-4 {
          bottom: 20%;
          right: 8%;
          animation-delay: 2.2s;
        }
        .immersive-trash .decor-1 {
          top: 12%;
          right: 12%;
          animation-delay: 0.6s;
        }
        .immersive-trash .decor-2 {
          bottom: 18%;
          left: 14%;
          animation-delay: 1.6s;
        }
        .immersive-trash .decor-3 {
          top: 30%;
          left: 6%;
          animation-delay: 2.4s;
        }
        .empty {
          color: rgba(255, 255, 255, 0.85);
          font-weight: 600;
          padding: 32px 0;
          text-align: center;
        }
        .addCard {
          display: grid;
          gap: 20px;
          border-radius: var(--radius-card);
          border: 1px solid var(--border);
          background: var(--bg-raised);
          box-shadow: var(--shadow);
        }
        .addCopy h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
        }
        .addCopy p {
          margin: 6px 0 0;
          color: var(--muted);
        }
        .addForm {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          align-items: end;
        }
        .field {
          display: grid;
          gap: 8px;
          grid-column: span 2;
        }
        .field:nth-child(3) {
          grid-column: span 1;
        }
        .field span {
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
        }
        .field input {
          border: 1px solid var(--border);
          border-radius: var(--radius-button);
          padding: 10px 12px;
          background: var(--bg);
          color: var(--text);
          transition: border 0.18s ease, box-shadow 0.18s ease;
        }
        .field input:focus {
          outline: none;
          border-color: color-mix(in oklab, var(--primary) 42%, var(--border));
          box-shadow: 0 0 0 4px color-mix(in oklab, var(--primary) 16%, transparent);
        }
        .addButton {
          grid-column: span 1;
          justify-self: end;
        }
        @media (max-width: 1024px) {
          .tiles {
            grid-template-columns: 1fr;
          }
          .addForm {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .addButton {
            justify-self: stretch;
          }
        }
        @media (max-width: 768px) {
          .pantry {
            padding: 24px 0 96px;
          }
          .pantryContainer {
            gap: 24px;
          }
          .immersive-head {
            align-items: flex-start;
          }
          .addForm {
            grid-template-columns: 1fr;
          }
          .field {
            grid-column: span 1;
          }
          .addButton {
            width: 100%;
          }
        }
        @keyframes tile-spin {
          0% {
            transform: rotateY(0deg);
          }
          100% {
            transform: rotateY(360deg);
          }
        }
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-12px);
          }
        }
      `}</style>
    </div>
  );
}
