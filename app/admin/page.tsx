"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebas1e";
import { isAdminUid } from "@/lib/admin";
import {
  banUser,
  clearModeration,
  deleteComment,
  deletePostAdmin,
  deleteRecipeAdmin,
  deleteReply,
  timeoutUser,
} from "@/lib/adminModeration";

type PostItem = {
  id: string;
  uid?: string | null;
  text?: string | null;
  title?: string | null;
  author?: { username?: string | null; displayName?: string | null } | null;
};

type RecipeItem = {
  id: string;
  uid?: string | null;
  title?: string | null;
  author?: { uid?: string | null; name?: string | null } | null;
};

type CommentItem = {
  id: string;
  uid?: string | null;
  text?: string | null;
};

export default function AdminPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [userUid, setUserUid] = useState("");
  const [reason, setReason] = useState("");
  const [timeoutDays, setTimeoutDays] = useState("7");
  const [busy, setBusy] = useState<string | null>(null);

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [comments, setComments] = useState<CommentItem[]>([]);

  useEffect(() => {
    const stop = onAuthStateChanged(auth, (user) => {
      const ok = isAdminUid(user?.uid);
      setIsAdmin(ok);
      setReady(true);
      if (!ok) router.replace("/dashboard");
    });
    return () => stop();
  }, [router]);

  useEffect(() => {
    if (!isAdmin) return;

    const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(25));
    const recipesQuery = query(collection(db, "recipes"), orderBy("createdAt", "desc"), limit(25));

    const stopPosts = onSnapshot(postsQuery, (snapshot) => {
      setPosts(snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...(docSnapshot.data() as Omit<PostItem, "id">) })));
    });

    const stopRecipes = onSnapshot(recipesQuery, (snapshot) => {
      setRecipes(snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...(docSnapshot.data() as Omit<RecipeItem, "id">) })));
    });

    return () => {
      stopPosts();
      stopRecipes();
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedPostId || !isAdmin) {
      setComments([]);
      return;
    }

    const commentsQuery = query(
      collection(db, "posts", selectedPostId, "comments"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const stop = onSnapshot(commentsQuery, (snapshot) => {
      setComments(snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...(docSnapshot.data() as Omit<CommentItem, "id">) })));
    });

    return () => stop();
  }, [selectedPostId, isAdmin]);

  const canSubmitModeration = useMemo(() => userUid.trim().length > 10, [userUid]);

  async function runAction(key: string, fn: () => Promise<void>) {
    try {
      setBusy(key);
      await fn();
      window.alert("Done.");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleBan() {
    if (!canSubmitModeration) return;
    await runAction("ban", async () => {
      await banUser(userUid.trim(), reason.trim());
    });
  }

  async function handleTimeout() {
    if (!canSubmitModeration) return;
    const days = Math.max(1, Number(timeoutDays) || 1);
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await runAction("timeout", async () => {
      await timeoutUser(userUid.trim(), until, reason.trim());
    });
  }

  async function handleClear() {
    if (!canSubmitModeration) return;
    await runAction("clear", async () => {
      await clearModeration(userUid.trim());
    });
  }

  async function handleDeleteReply(commentId: string, replyId: string) {
    await runAction(`reply-${replyId}`, async () => {
      await deleteReply(selectedPostId, commentId, replyId);
    });
  }

  async function loadReplies(commentId: string) {
    const snapshot = await getDocs(collection(db, "posts", selectedPostId, "comments", commentId, "replies"));
    const ids = snapshot.docs.map((docSnapshot) => docSnapshot.id);
    if (!ids.length) {
      window.alert("No replies found.");
      return;
    }
    const chosen = window
      .prompt(`Replies on comment ${commentId}:\n\n${ids.join("\n")}\n\nPaste one reply ID to delete:`)
      ?.trim();
    if (!chosen) return;
    await handleDeleteReply(commentId, chosen);
  }

  if (!ready || !isAdmin) return null;

  return (
    <main className="adminWrap">
      <h1>Admin Panel</h1>

      <section className="card">
        <h2>User moderation</h2>
        <div className="grid">
          <input value={userUid} onChange={(e) => setUserUid(e.target.value)} placeholder="User UID" className="input" />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className="input" />
          <input
            value={timeoutDays}
            onChange={(e) => setTimeoutDays(e.target.value)}
            placeholder="Timeout days"
            className="input"
          />
        </div>

        <div className="actions">
          <button onClick={handleBan} disabled={!canSubmitModeration || busy !== null}>Ban user</button>
          <button onClick={handleTimeout} disabled={!canSubmitModeration || busy !== null}>Timeout user</button>
          <button onClick={handleClear} disabled={!canSubmitModeration || busy !== null}>Clear moderation</button>
        </div>
      </section>

      <section className="card">
        <h2>Posts</h2>
        <div className="list">
          {posts.map((post) => (
            <div key={post.id} className="row">
              <div className="meta">
                <strong>{post.author?.username || post.author?.displayName || post.uid || "Unknown user"}</strong>
                <span>{post.title || post.text || "Untitled post"}</span>
                <small>ID: {post.id}</small>
              </div>

              <div className="rowActions">
                <button onClick={() => setSelectedPostId(post.id)}>View comments</button>
                <button
                  onClick={() =>
                    runAction(`post-${post.id}`, async () => {
                      await deletePostAdmin(post.id);
                    })
                  }
                >
                  Delete post
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Comments for selected post</h2>
        <p className="muted">{selectedPostId ? `Post ID: ${selectedPostId}` : "Choose a post first."}</p>

        <div className="list">
          {comments.map((comment) => (
            <div key={comment.id} className="row">
              <div className="meta">
                <strong>{comment.uid || "Unknown user"}</strong>
                <span>{comment.text || "(empty comment)"}</span>
                <small>ID: {comment.id}</small>
              </div>

              <div className="rowActions">
                <button onClick={() => loadReplies(comment.id)}>Delete reply by ID</button>
                <button
                  onClick={() =>
                    runAction(`comment-${comment.id}`, async () => {
                      await deleteComment(selectedPostId, comment.id);
                    })
                  }
                >
                  Delete comment
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Recipes</h2>
        <div className="list">
          {recipes.map((recipe) => (
            <div key={recipe.id} className="row">
              <div className="meta">
                <strong>{recipe.title || "Untitled recipe"}</strong>
                <span>{recipe.author?.name || recipe.author?.uid || recipe.uid || "Unknown owner"}</span>
                <small>ID: {recipe.id}</small>
              </div>

              <div className="rowActions">
                <button
                  onClick={() =>
                    runAction(`recipe-${recipe.id}`, async () => {
                      await deleteRecipeAdmin(recipe.id);
                    })
                  }
                >
                  Delete recipe
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <style jsx>{`
        .adminWrap {
          max-width: 1120px;
          margin: 0 auto;
          padding: 24px;
          display: grid;
          gap: 20px;
        }
        .card {
          padding: 20px;
          border: 1px solid var(--border);
          border-radius: 20px;
          background: var(--bg-raised);
          box-shadow: var(--shadow);
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .input {
          height: 44px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--bg);
          color: var(--text);
          padding: 0 12px;
        }
        .actions,
        .rowActions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 12px;
        }
        button {
          height: 40px;
          padding: 0 14px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--bg);
          color: var(--text);
          cursor: pointer;
          font-weight: 700;
        }
        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .list {
          display: grid;
          gap: 12px;
          margin-top: 12px;
        }
        .row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 14px;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: color-mix(in oklab, var(--bg) 88%, transparent);
        }
        .meta {
          display: grid;
          gap: 4px;
          min-width: 0;
        }
        .meta span,
        .meta small,
        .muted {
          color: var(--muted);
        }
        @media (max-width: 768px) {
          .adminWrap {
            padding: 16px;
          }
          .grid {
            grid-template-columns: 1fr;
          }
          .row {
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}
