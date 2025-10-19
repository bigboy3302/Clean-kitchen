// lib/fsafe.ts
import {
  collection, collectionGroup, doc, onSnapshot, query,
  where, getDoc, getDocs, QueryConstraint, Firestore, Unsubscribe
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebas1e";

/** Read exactly the caller's user doc. */
export async function getMyUserDoc(me: User) {
  const ref = doc(db, "users", me.uid);
  return await getDoc(ref);
}

/** Listen to a top-level "owned" collection that stores { uid } on each doc (ex: pantryItems, consumptionLogs). */
export function listenOwnedCollection(
  collName: string,
  me: User,
  onOk: (docs: any[]) => void,
  onErr?: (e: any) => void,
  extra?: QueryConstraint[]
): Unsubscribe {
  const base = collection(db, collName);
  const q = query(base, where("uid", "==", me.uid), ...(extra || []));
  return onSnapshot(
    q,
    (snap) => onOk(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    (err) => onErr?.(err)
  );
}

/** Listen to a subcollection under the signed-in user's path: users/{uid}/{subcol}. */
export function listenMySubcol(
  subcol: string,               // e.g. "favoriteRecipes"
  me: User,
  onOk: (docs: any[]) => void,
  onErr?: (e: any) => void,
  extra?: QueryConstraint[]
): Unsubscribe {
  const c = collection(db, "users", me.uid, subcol);
  const q = query(c, ...(extra || []));
  return onSnapshot(
    q,
    (snap) => onOk(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    (err) => onErr?.(err)
  );
}

/**
 * If you *must* use a collectionGroup on a user-owned subcollection:
 * - Ensure each doc also stores { uid } inside it,
 * - Filter with where("uid", "==", me.uid).
 */
export function listenOwnedCollectionGroup(
  groupName: string,            // dangerous if you don't filter!
  me: User,
  onOk: (docs: any[]) => void,
  onErr?: (e: any) => void,
  extra?: QueryConstraint[]
): Unsubscribe {
  const g = collectionGroup(db, groupName);
  const q = query(g, where("uid", "==", me.uid), ...(extra || []));
  return onSnapshot(
    q,
    (snap) => onOk(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    (err) => onErr?.(err)
  );
}
