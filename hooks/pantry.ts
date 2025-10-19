// hooks/pantry.ts
import { auth, db } from "@/lib/firebas1e";
import { collection, query, where, onSnapshot, addDoc } from "firebase/firestore";

export function watchMyPantry(cb: (rows: any[]) => void) {
  const u = auth.currentUser;
  if (!u) return () => {};
  const qRef = query(collection(db, "pantryItems"), where("uid", "==", u.uid));
  return onSnapshot(qRef, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function addPantryItem(data: any) {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");
  return await addDoc(collection(db, "pantryItems"), { ...data, uid: u.uid });
}
