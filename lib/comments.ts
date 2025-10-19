import { db } from "@/lib/firebas1e";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";

export async function addComment(opts: { postId: string; uid: string; text: string }) {
  const { postId, uid, text } = opts;

  const trimmed = text.trim().slice(0, 25000);
  if (!trimmed) return;

  let author:
    | { displayName?: string | null; username?: string | null; avatarURL?: string | null }
    | null = null;

  try {
    const uref = doc(db, "users", uid);
    const usnap = await getDoc(uref);
    if (usnap.exists()) {
      type UserDoc = {
        firstName?: string | null;
        lastName?: string | null;
        displayName?: string | null;
        username?: string | null;
        photoURL?: string | null;
      };
      const u = usnap.data() as UserDoc;
      author = {
        displayName: u?.firstName
          ? `${u.firstName}${u.lastName ? " " + u.lastName : ""}`
          : u?.displayName || null,
        username: u?.username || null,
        avatarURL: u?.photoURL || null,
      };
    }
  } catch {}

  await addDoc(collection(db, "posts", postId, "comments"), {
    uid,
    text: trimmed,
    author,
    createdAt: serverTimestamp(),
  });
}
