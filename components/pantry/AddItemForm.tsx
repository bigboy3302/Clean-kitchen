
"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

function toTitleCase(s: string) {
  return s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1));
}

export default function AddItemForm() {
  const [name, setName] = useState("");
  const [qty, setQty] = useState<number | "">("");
  const [dateStr, setDateStr] = useState<string>(""); 
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const user = auth.currentUser;
    if (!user) {
      setErr("Please sign in.");
      return;
    }
    const cleanName = toTitleCase(name.trim());
    if (!cleanName) {
      setErr("Name is required.");
      return;
    }

    let expiresAt: Timestamp | null = null;
    if (dateStr) {
  
      const d = new Date(dateStr + "T00:00:00");
      expiresAt = Timestamp.fromDate(d);
    }

    setBusy(true);
    try {
      await addDoc(collection(db, "pantryItems"), {
        uid: user.uid,
        name: cleanName,
        quantity: typeof qty === "number" ? qty : null,
        expiresAt,                
        createdAt: serverTimestamp(),
      });
      setName("");
      setQty("");
      setDateStr("");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to add item.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ display: "grid", gap: 10 }}>
      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
        <input
          placeholder="Item name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setName((v) => toTitleCase(v))}
        />
        <input
          type="number"
          min={0}
          placeholder="Qty"
          value={qty}
          onChange={(e) => setQty(e.target.value === "" ? "" : Number(e.target.value))}
        />
        <input
          type="date"
          value={dateStr}
          onChange={(e) => setDateStr(e.target.value)}
        />
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn-base btn--md btn--primary" disabled={busy}>
          {busy ? "Adding…" : "Add item"}
        </button>
      </div>

      {err && <p className="alert-error">{err}</p>}
    </form>
  );
}
