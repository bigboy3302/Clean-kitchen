/**
 * Firebase Functions v2
 */

import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest, onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldPath, getFirestore, Query, QueryDocumentSnapshot } from "firebase-admin/firestore";

// Limit concurrent containers (cost control)
setGlobalOptions({ maxInstances: 10 });

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const USERNAME_RE = /^[a-z0-9._-]{3,20}$/;
const MAX_QUERY_PAGE = 300;
const MAX_TRANSACTION_RETRIES = 3;

// Simple HTTPS function to verify everything works
export const helloWorld = onRequest((req, res) => {
  logger.info("Hello logs!", { structuredData: true });
  res.send("Hello from Firebase v2!");
});

type RenameInput = {
  newUsername?: unknown;
  oldUsername?: unknown;
};

type RenameResponse =
  | {
      ok: true;
      username: string;
      updatedCounts: { posts: number; comments: number; replies: number };
    }
  | {
      ok: false;
      code: "not-signed-in" | "invalid" | "same" | "taken" | "conflict" | "internal";
      message: string;
    };

export const renameUsername = onCall<RenameResponse>(async (request) => {
  const auth = request.auth;
  if (!auth?.uid) {
    return { ok: false, code: "not-signed-in", message: "You must be signed in to rename." };
  }

  const uid = auth.uid;
  const data = (request.data || {}) as RenameInput;
  const rawNew = typeof data.newUsername === "string" ? data.newUsername : "";
  const newUsername = rawNew.trim();
  const oldUsername = typeof data.oldUsername === "string" ? data.oldUsername.trim() : null;

  if (!USERNAME_RE.test(newUsername)) {
    return {
      ok: false,
      code: "invalid",
      message: "Usernames must be 3-20 chars using a-z, 0-9, dot, underscore, or hyphen.",
    };
  }

  if (oldUsername && newUsername === oldUsername) {
    return { ok: false, code: "same", message: "That is already your username." };
  }

  const usernamesRef = db.collection("usernames");
  const usersRef = db.collection("users");
  const usersPublicRef = db.collection("usersPublic");

  let reserved = false;
  for (let attempt = 0; attempt < MAX_TRANSACTION_RETRIES && !reserved; attempt += 1) {
    try {
      await db.runTransaction(async (tx) => {
        const newDocRef = usernamesRef.doc(newUsername);
        const newDocSnap = await tx.get(newDocRef);
        if (newDocSnap.exists) {
          const existingUid = newDocSnap.get("uid");
          if (existingUid !== uid) {
            throw new UsernameTakenError(newUsername);
          }
        }

        tx.set(newDocRef, { uid });
        tx.set(usersRef.doc(uid), { username: newUsername }, { merge: true });
        tx.set(usersPublicRef.doc(uid), { username: newUsername }, { merge: true });
      });
      reserved = true;
    } catch (err: any) {
      if (err instanceof UsernameTakenError) {
        return { ok: false, code: "taken", message: "That username is already taken." };
      }

      const code = typeof err?.code === "string" ? err.code : "";
      const retryable = code === "ABORTED" || code === "FAILED_PRECONDITION";
      if (!retryable || attempt === MAX_TRANSACTION_RETRIES - 1) {
        logger.error("Failed to reserve username", { err, uid, newUsername });
        return { ok: false, code: "conflict", message: "Could not reserve username." };
      }
      await sleep(50 + attempt * 150);
    }
  }

  if (!reserved) {
    return { ok: false, code: "conflict", message: "Could not reserve username." };
  }

  try {
    const postsUpdated = await updatePosts(uid, newUsername);
    const commentsUpdated = await updateCollectionGroups(
      "comments",
      uid,
      newUsername,
      ["uid", "author.uid"]
    );
    const repliesUpdated = await updateCollectionGroups(
      "replies",
      uid,
      newUsername,
      ["uid", "author.uid"]
    );

    if (oldUsername) {
      await releaseOldUsername(oldUsername, uid);
    }

    return {
      ok: true,
      username: newUsername,
      updatedCounts: {
        posts: postsUpdated,
        comments: commentsUpdated,
        replies: repliesUpdated,
      },
    };
  } catch (err: any) {
    logger.error("Failed to propagate username rename", { err, uid, newUsername });
    return {
      ok: false,
      code: "internal",
      message: "Failed to rename username. Please try again.",
    };
  }
});

class UsernameTakenError extends Error {
  constructor(username: string) {
    super(`Username '${username}' is taken`);
  }
}

async function updatePosts(uid: string, newUsername: string): Promise<number> {
  const postsCollection = db.collection("posts");
  const seen = new Set<string>();
  const updateFn = (doc: QueryDocumentSnapshot): Record<string, unknown> | null => {
    const data = doc.data() || {};
    let changed = false;
    const updates: Record<string, unknown> = {};
    if (data.uid === uid && data.username !== newUsername) {
      updates.username = newUsername;
      changed = true;
    }
    const author = data.author as { uid?: string; username?: string } | undefined;
    if (author?.uid === uid && author.username !== newUsername) {
      updates["author.username"] = newUsername;
      changed = true;
    }
    return changed ? updates : null;
  };

  const byUid = await updateByQuery(postsCollection.where("uid", "==", uid), updateFn, seen);
  const byAuthor = await updateByQuery(
    postsCollection.where("author.uid", "==", uid),
    updateFn,
    seen
  );

  return byUid + byAuthor;
}

async function updateCollectionGroups(
  collectionId: string,
  uid: string,
  newUsername: string,
  filters: ("uid" | "author.uid")[]
): Promise<number> {
  const seen = new Set<string>();
  let total = 0;
  const updater = (doc: QueryDocumentSnapshot): Record<string, unknown> | null => {
    const data = doc.data() || {};
    let changed = false;
    const updates: Record<string, unknown> = {};
    if (data.uid === uid && data.username !== newUsername) {
      updates.username = newUsername;
      changed = true;
    }
    const author = data.author as { uid?: string; username?: string } | undefined;
    if (author?.uid === uid && author.username !== newUsername) {
      updates["author.username"] = newUsername;
      changed = true;
    }
    return changed ? updates : null;
  };

  for (const filter of filters) {
    const query = db.collectionGroup(collectionId).where(filter, "==", uid);
    total += await updateByQuery(query, updater, seen);
  }

  return total;
}

async function updateByQuery(
  query: Query,
  computeUpdates: (doc: QueryDocumentSnapshot) => Record<string, unknown> | null,
  seenPaths?: Set<string>
): Promise<number> {
  let updated = 0;
  let cursor: QueryDocumentSnapshot | undefined;

  while (true) {
    let paged = query.orderBy(FieldPath.documentId()).limit(MAX_QUERY_PAGE);
    if (cursor) {
      paged = paged.startAfter(cursor);
    }
    const snap = await paged.get();
    if (snap.empty) {
      break;
    }

    const batch = db.batch();
    let writes = 0;

    for (const doc of snap.docs) {
      cursor = doc;
      const path = doc.ref.path;
      if (seenPaths && seenPaths.has(path)) {
        continue;
      }
      seenPaths?.add(path);
      const updates = computeUpdates(doc);
      if (updates && Object.keys(updates).length > 0) {
        batch.update(doc.ref, updates);
        writes += 1;
        updated += 1;
      }
    }

    if (writes > 0) {
      await batch.commit();
    }

    if (snap.size < MAX_QUERY_PAGE) {
      break;
    }
  }

  return updated;
}

async function releaseOldUsername(oldUsername: string, uid: string): Promise<void> {
  const oldDocRef = db.collection("usernames").doc(oldUsername);
  const snap = await oldDocRef.get();
  if (snap.exists && snap.get("uid") === uid) {
    await oldDocRef.delete();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
