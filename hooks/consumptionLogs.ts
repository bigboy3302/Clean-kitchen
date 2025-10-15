// hooks/consumptionLogs.ts
import { auth, db } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, onSnapshot, getDocs } from "firebase/firestore";

export function watchMyConsumptionLogs(cb: (rows: any[]) => void) {
  const u = auth.currentUser;
  if (!u) return () => {};
  const qRef = query(
    collection(db, "consumptionLogs"),
    where("uid", "==", u.uid),          // required by your rules
    orderBy("createdAt", "desc"),
    limit(50)
  );
  return onSnapshot(qRef, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function getMyConsumptionLogsOnce() {
  const u = auth.currentUser;
  if (!u) return [];
  const qRef = query(collection(db, "consumptionLogs"), where("uid", "==", u.uid));
  const snap = await getDocs(qRef);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
