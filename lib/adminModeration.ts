"use client";

import { auth, db, storage } from "@/lib/firebas1e";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { deleteObject, listAll, ref as storageRef } from "firebase/storage";
import { isAdminUid } from "@/lib/admin";

function requireAdmin() {
  const uid = auth.currentUser?.uid;
  if (!isAdminUid(uid)) {
    throw new Error("Admin access required.");
  }
  return uid;
}

async function deleteStorageTree(path: string) {
  try {
    const root = storageRef(storage, path);
    const listed = await listAll(root);
    await Promise.all(listed.items.map((item) => deleteObject(item).catch(() => {})));
    await Promise.all(listed.prefixes.map((folder) => deleteStorageTree(folder.fullPath)));
  } catch {
    // ignore missing folders or inaccessible paths
  }
}

export async function banUser(uid: string, reason: string) {
  requireAdmin();

  await setDoc(
    doc(db, "userModeration", uid),
    {
      active: true,
      type: "ban",
      reason: reason.trim() || "Banned by admin",
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.uid ?? null,
    },
    { merge: true }
  );
}

export async function timeoutUser(uid: string, until: Date, reason: string) {
  requireAdmin();

  await setDoc(
    doc(db, "userModeration", uid),
    {
      active: true,
      type: "timeout",
      until,
      reason: reason.trim() || "Timed out by admin",
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.uid ?? null,
    },
    { merge: true }
  );
}

export async function clearModeration(uid: string) {
  requireAdmin();

  await setDoc(
    doc(db, "userModeration", uid),
    {
      active: false,
      clearedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.uid ?? null,
    },
    { merge: true }
  );
}

export async function deleteReply(postId: string, commentId: string, replyId: string) {
  requireAdmin();

  await deleteDoc(doc(db, "posts", postId, "comments", commentId, "replies", replyId));
}

export async function deleteComment(postId: string, commentId: string) {
  requireAdmin();

  const repliesSnap = await getDocs(collection(db, "posts", postId, "comments", commentId, "replies"));
  await Promise.all(repliesSnap.docs.map((snapshot) => deleteDoc(snapshot.ref).catch(() => {})));

  const repostsSnap = await getDocs(collection(db, "posts", postId, "comments", commentId, "reposts"));
  await Promise.all(repostsSnap.docs.map((snapshot) => deleteDoc(snapshot.ref).catch(() => {})));

  await deleteStorageTree(`posts/${postId}/comments/${commentId}`);
  await deleteDoc(doc(db, "posts", postId, "comments", commentId));
}

export async function deletePostAdmin(postId: string) {
  requireAdmin();

  const postRef = doc(db, "posts", postId);
  const postSnap = await getDoc(postRef);
  if (!postSnap.exists()) return;

  const postData = postSnap.data() as {
    uid?: string | null;
    media?: Array<{ storagePath?: string }>;
  };
  const ownerUid = postData?.uid ?? null;

  const likesSnap = await getDocs(collection(db, "posts", postId, "likes"));
  await Promise.all(likesSnap.docs.map((snapshot) => deleteDoc(snapshot.ref).catch(() => {})));

  const repostsSnap = await getDocs(collection(db, "posts", postId, "reposts"));
  await Promise.all(repostsSnap.docs.map((snapshot) => deleteDoc(snapshot.ref).catch(() => {})));

  const reportsSnap = await getDocs(collection(db, "posts", postId, "reports"));
  await Promise.all(reportsSnap.docs.map((snapshot) => deleteDoc(snapshot.ref).catch(() => {})));

  const commentsSnap = await getDocs(collection(db, "posts", postId, "comments"));
  for (const commentDoc of commentsSnap.docs) {
    const repliesSnap = await getDocs(collection(db, "posts", postId, "comments", commentDoc.id, "replies"));
    await Promise.all(repliesSnap.docs.map((snapshot) => deleteDoc(snapshot.ref).catch(() => {})));

    const commentRepostsSnap = await getDocs(collection(db, "posts", postId, "comments", commentDoc.id, "reposts"));
    await Promise.all(commentRepostsSnap.docs.map((snapshot) => deleteDoc(snapshot.ref).catch(() => {})));

    await deleteStorageTree(`posts/${postId}/comments/${commentDoc.id}`);
    await deleteDoc(commentDoc.ref).catch(() => {});
  }

  if (Array.isArray(postData?.media)) {
    await Promise.all(
      postData.media
        .filter((item) => !!item?.storagePath)
        .map((item) => deleteObject(storageRef(storage, item.storagePath!)).catch(() => {}))
    );
  }

  if (ownerUid) {
    await deleteStorageTree(`posts/${ownerUid}/${postId}`);
    await deleteStorageTree(`users/${ownerUid}/posts/${postId}`);
  }

  await deleteDoc(postRef);
}

export async function deleteRecipeAdmin(recipeId: string) {
  requireAdmin();

  const recipeRef = doc(db, "recipes", recipeId);
  const recipeSnap = await getDoc(recipeRef);
  if (!recipeSnap.exists()) return;

  const recipeData = recipeSnap.data() as {
    uid?: string | null;
    author?: { uid?: string | null } | null;
  };

  const ownerUid = recipeData?.uid ?? recipeData?.author?.uid ?? null;

  const photosSnap = await getDocs(collection(db, "recipes", recipeId, "photos"));
  await Promise.all(photosSnap.docs.map((snapshot) => deleteDoc(snapshot.ref).catch(() => {})));

  if (ownerUid) {
    await deleteStorageTree(`recipeImages/${ownerUid}/${recipeId}`);
    await deleteStorageTree(`recipeImages/${ownerUid}/${recipeId}/gallery`);
  }

  await deleteDoc(recipeRef);
}

export async function removePostText(postId: string, replacement = "[Removed by admin]") {
  requireAdmin();

  await updateDoc(doc(db, "posts", postId), {
    text: replacement,
    description: replacement,
    moderatedAt: serverTimestamp(),
    moderatedBy: auth.currentUser?.uid ?? null,
  });
}
