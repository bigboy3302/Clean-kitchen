import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

async function backfillPantry(ownerUid: string) {
  const snap = await getDocs(collection(db, "pantryItems"));
  const jobs: Promise<any>[] = [];
  snap.forEach((d) => {
    const data = d.data() as any;
    if (!data.uid) {
      jobs.push(updateDoc(doc(db, "pantryItems", d.id), { uid: ownerUid }));
    }
  });
  await Promise.all(jobs);
  console.log("Backfill done");
}

backfillPantry("DTNYzS78uGBzYHa9tRDH");
