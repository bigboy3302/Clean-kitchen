// lib/comments.ts
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export async function addComment(opts: {
  postId: string;
  uid: string;
  text: string;
}) {
  const { postId, uid, text } = opts;

  // Client-side guard (helps UX; server rules still enforce)
  const MAX = 25000;
  const trimmed = (text ?? "").slice(0, MAX);

  if (!trimmed) throw new Error("Comment cannot be empty.");

  await addDoc(collection(db, "posts", postId, "comments"), {
    uid,
    text: trimmed,
    createdAt: serverTimestamp(),
  });
}
