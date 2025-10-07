"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  addDoc, collection, onSnapshot, orderBy, query, where, serverTimestamp
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/button";

type PantryItem = {
  id: string;
  uid: string;
  name: string;
  qty: number;
  expiresAt?: string; // ISO date
  photoURL?: string;
};

export default function PantryPage() {
  const router = useRouter();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) { router.replace("/auth/login"); return; }

    const qy = query(
      collection(db, "pantryItems"),
      where("uid", "==", u.uid),
      orderBy("expiresAt", "asc")
    );

    const unsub = onSnapshot(qy,
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as PantryItem[];
        setItems(data);
      },
      (err) => {
        console.error(err);
        setMsg("You don't have permission to load pantry items. Are you logged in?");
      }
    );
    return () => unsub();
  }, [router]);

  async function addItem() {
    setMsg(null);
    const u = auth.currentUser;
    if (!u) { router.replace("/auth/login"); return; }
    try {
      await addDoc(collection(db, "pantryItems"), {
        uid: u.uid,
        name: name.trim(),
        qty: Number(qty) || 1,
        expiresAt: expiresAt || null,
        createdAt: serverTimestamp(),
      });
      setName(""); setQty(1); setExpiresAt("");
    } catch (e: any) {
      setMsg(e.message ?? "Failed to add item.");
    }
  }

  return (
    <div className="container" style={{ padding: "24px 0" }}>
      <h1>My Pantry</h1>
      {msg && <p className="alert-error" style={{ marginTop: 12 }}>{msg}</p>}

      <Card className="grid grid-2" >
        <Input label="Product"  value={name} onChange={(e) => setName((e.target as HTMLInputElement).value)} />
        <Input label="Quantity" type="number" min={1} value={qty} onChange={(e) => setQty(Number((e.target as HTMLInputElement).value))} />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-800">Expires at</label>
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt((e.target as HTMLInputElement).value)} />
        </div>
        <div style={{ alignSelf: "end" }}>
          <Button onClick={addItem}>Add item</Button>
        </div>
      </Card>

      <div className="grid" style={{ marginTop: 16 }}>
        {items.map(it => (
          <Card key={it.id}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{it.name}</div>
                <div className="badge" style={{ marginTop: 6 }}>Qty: {it.qty}</div>
                {it.expiresAt && <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>Expires: {it.expiresAt}</div>}
              </div>
              
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
