"use client";

import NextImage from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { auth, db } from "@/lib/firebas1e";
import { addDoc, collection, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { addMediaToPost } from "@/lib/postMedia";
import { useAuthModal } from "@/context/AuthModalContext";
import Avatar from "@/components/ui/Avatar";

type MediaPreview = { url: string; type: "image" | "video" };
type Author = { username: string | null; displayName: string | null; avatarURL: string | null };
type UserDoc = {
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
};

const MAX_IMAGE_DIMENSION = 1600;

async function optimiseImage(file: File, maxDim = MAX_IMAGE_DIMENSION): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const shouldSkip = file.size <= 350 * 1024; // keep small images untouched
  if (shouldSkip) return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = (err) => reject(err);
      image.src = objectUrl;
    });

    let { width, height } = img;
    if (width <= maxDim && height <= maxDim) return file;

    if (width > height) {
      height = Math.round((height / width) * maxDim);
      width = maxDim;
    } else {
      width = Math.round((width / height) * maxDim);
      height = maxDim;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, outputType, outputType === "image/jpeg" ? 0.82 : undefined)
    );
    if (!blob) return file;

    const base = file.name.replace(/\.\w+$/, "") || "image";
    const extension = outputType === "image/png" ? ".png" : ".jpg";
    const optimisedName = `${base}-optimised${extension}`;
    return new File([blob], optimisedName, { type: outputType, lastModified: Date.now() });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function PostComposer() {
  const { openLogin } = useAuthModal();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<MediaPreview[]>([]);
  const [pct, setPct] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [userMeta, setUserMeta] = useState<Author>({ username: null, displayName: null, avatarURL: null });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUserMeta() {
      const user = auth.currentUser;
      if (!user) {
        if (!cancelled) {
          setUserMeta({ username: null, displayName: null, avatarURL: null });
        }
        return;
      }

      let nextMeta: Author = {
        username: null,
        displayName: user.displayName ?? null,
        avatarURL: user.photoURL ?? null,
      };

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const u = snap.data() as UserDoc | undefined;
          nextMeta = {
            username: u?.username ?? null,
            displayName: u?.firstName
              ? `${u.firstName}${u.lastName ? ` ${u.lastName}` : ""}`
              : u?.displayName ?? user.displayName ?? null,
            avatarURL: u?.photoURL ?? user.photoURL ?? null,
          };
        }
      } catch {}

      if (!cancelled) {
        setUserMeta(nextMeta);
      }
    }

    void loadUserMeta();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  function showToast(message: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 3200);
  }

  function clearSelectedMedia() {
    setFiles([]);
    setPreviews((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return [];
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []).slice(0, 4);
    if (!list.length) {
      setFiles([]);
      setPreviews((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.url));
        return [];
      });
      return;
    }

    const processed = await Promise.all(
      list.map(async (file) => (file.type.startsWith("image/") ? optimiseImage(file) : file))
    );

    const nextPreviews: MediaPreview[] = processed.map((f) => ({
      url: URL.createObjectURL(f),
      type: f.type.startsWith("video") ? "video" : "image", // stays within the union
    }));

    setFiles(processed);
    setPreviews((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return nextPreviews;
    });
  }

  async function createPost() {
    setErr(null);
    const user = auth.currentUser;
    if (!user) {
      setErr("Please sign in.");
      openLogin("/posts");
      return;
    }
    if (!text.trim() && files.length === 0) { setErr("Nothing to publish."); return; }

    const nextText = text.trim();
    const nextFiles = [...files];
    setBusy(true);
    try {
      let author: Author = { username: null, displayName: null, avatarURL: null };
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const u = snap.data() as UserDoc | undefined;
          author = {
            username: u?.username ?? null,
            displayName: u?.firstName
              ? `${u.firstName}${u.lastName ? ` ${u.lastName}` : ""}`
              : u?.displayName ?? null,
            avatarURL: u?.photoURL ?? null,
          };
        }
      } catch {}

      const refDoc = await addDoc(collection(db, "posts"), {
        uid: user.uid,
        text: nextText || null,
        media: [],
        createdAt: serverTimestamp(),
        isRepost: false,
        author,
      });

      setText("");
      clearSelectedMedia();
      setPct(0);

      if (nextFiles.length) {
        setUploading(true);
        showToast("Post published. Uploading media...");
        void addMediaToPost({
          uid: user.uid,
          postId: refDoc.id,
          files: nextFiles,
          limit: 4,
          onProgress: (p) => setPct(Math.round(p * 100)),
        })
          .then(() => {
            setUploading(false);
            setPct(100);
            showToast("Post uploaded successfully.");
            setTimeout(() => setPct(0), 700);
          })
          .catch((error: unknown) => {
            setUploading(false);
            setPct(0);
            const message = error instanceof Error ? error.message : "Media upload failed.";
            setErr(`Post published, but media upload failed: ${message}`);
          });
      } else {
        showToast("Post uploaded successfully.");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create post.";
      setErr(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="composer">
      <div className="composerHead">
        <div className="identity">
          <Avatar
            src={userMeta.avatarURL || auth.currentUser?.photoURL || undefined}
            name={userMeta.displayName || userMeta.username || auth.currentUser?.displayName || "You"}
            size={44}
          />
          <div className="identityCopy">
            <span className="eyebrow">Share with the community</span>
            <strong>{userMeta.displayName || userMeta.username || "Your post"}</strong>
            <span className="subcopy">Tips, meals, progress, wins, or anything worth sharing.</span>
          </div>
        </div>

        <button
          type="button"
          className="attachBtn"
          onClick={() => fileRef.current?.click()}
          disabled={busy || uploading}
        >
          Add media
        </button>
      </div>

      <div className="editor">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="What are you cooking, learning, or proud of today?"
        />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={onPick}
        className="hiddenInput"
      />

      {previews.length > 0 && (
        <div className="mediaShell">
          <div className="mediaTop">
            <span className="mediaLabel">{previews.length} attachment{previews.length === 1 ? "" : "s"}</span>
            <button
              type="button"
              className="clearMedia"
              onClick={clearSelectedMedia}
              disabled={busy || uploading}
            >
              Remove all
            </button>
          </div>
          <div className={`grid mcount-${previews.length}`}>
            {previews.map((m, i) => (
            <div key={i} className="cell">
              {m.type === "video" ? (
                <video src={m.url} controls/>
              ) : (
                <NextImage
                  src={m.url}
                  alt="Selected media preview"
                  fill
                  sizes="(max-width: 768px) 50vw, 320px"
                  unoptimized
                  className="previewImg"
                />
              )}
            </div>
            ))}
          </div>
        </div>
      )}

      {uploading ? <div className="hint">Uploading media… {pct}%</div> : null}
      {err ? <div className="err">{err}</div> : null}

      <div className="composerFoot">
        <div className="footHint">
          <span className="hintDot" aria-hidden="true" />
          {uploading ? `Upload in progress ${pct}%` : "Up to 4 photos or videos"}
        </div>
        <button className="postBtn" disabled={busy || uploading} onClick={createPost}>
          {busy ? "Posting…" : uploading ? "Uploading…" : "Publish Post"}
        </button>
      </div>

      {toast ? <div className={`toast ${uploading ? "isUploading" : ""}`}>{toast}</div> : null}

      <style jsx>{`
        .composer {
          display: grid;
          gap: 14px;
          padding: 18px;
          border-radius: 24px;
          border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
          background:
            radial-gradient(circle at top right, color-mix(in oklab, var(--primary) 10%, transparent), transparent 30%),
            linear-gradient(180deg, color-mix(in oklab, var(--bg2) 96%, transparent), color-mix(in oklab, var(--bg) 92%, var(--bg2) 8%));
          box-shadow: 0 20px 46px rgba(15, 23, 42, 0.08);
        }
        .composerHead {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .identity {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          min-width: 0;
        }
        .identityCopy {
          display: grid;
          gap: 2px;
          min-width: 0;
        }
        .eyebrow {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .identityCopy strong {
          color: var(--text);
          font-size: 1rem;
          letter-spacing: -0.02em;
        }
        .subcopy {
          color: var(--muted);
          font-size: 13px;
          line-height: 1.45;
        }
        .attachBtn,
        .postBtn {
          min-height: 42px;
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.14s ease, background 0.14s ease, border-color 0.14s ease;
        }
        .attachBtn {
          padding: 0 14px;
          background: color-mix(in oklab, var(--bg) 86%, transparent);
          color: var(--text);
          white-space: nowrap;
        }
        .editor {
          border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
          border-radius: 20px;
          background: color-mix(in oklab, var(--bg) 82%, transparent);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }
        textarea {
          width: 100%;
          min-height: 140px;
          border: 0;
          outline: none;
          resize: vertical;
          background: transparent;
          color: var(--text);
          padding: 16px 18px;
          font: inherit;
          font-size: 15px;
          line-height: 1.6;
        }
        textarea::placeholder {
          color: var(--muted);
        }
        .hiddenInput {
          display: none;
        }
        .mediaShell {
          display: grid;
          gap: 10px;
          padding: 12px;
          border-radius: 20px;
          border: 1px solid color-mix(in oklab, var(--border) 86%, transparent);
          background: color-mix(in oklab, var(--bg2) 92%, transparent);
        }
        .mediaTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .mediaLabel {
          color: var(--text);
          font-size: 13px;
          font-weight: 700;
        }
        .clearMedia {
          border: 0;
          background: transparent;
          color: var(--muted);
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .clearMedia[disabled] {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .grid { display:grid; gap:8px }
        .grid.mcount-1{ grid-template-columns:1fr; grid-auto-rows:180px }
        .grid.mcount-2{ grid-template-columns:1fr 1fr; grid-auto-rows:150px }
        .grid.mcount-3{ grid-template-columns:2fr 1fr; grid-auto-rows:120px }
        .grid.mcount-3 .cell:first-child{ grid-row:1 / span 2; height:248px }
        .grid.mcount-4{ grid-template-columns:1fr 1fr; grid-auto-rows:120px }
        .cell { position:relative; }
        .cell :global(.previewImg), .cell video {
          width:100%;
          height:100%;
          object-fit:cover;
          display:block;
          border:1px solid color-mix(in oklab, var(--border) 84%, transparent);
          border-radius:16px;
          background:#000;
        }
        .hint {
          font-size: 12px;
          color: var(--muted);
        }
        .err {
          color:#991b1b;
          background:#fef2f2;
          border:1px solid #fecaca;
          padding:10px 12px;
          border-radius:14px;
          font-size:13px;
        }
        .composerFoot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .footHint {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--muted);
          font-size: 13px;
        }
        .hintDot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: color-mix(in oklab, var(--primary) 76%, white 24%);
          flex-shrink: 0;
        }
        .postBtn {
          padding: 0 18px;
          background: linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--primary) 76%, white 24%));
          border-color: transparent;
          color: var(--primary-contrast);
          box-shadow: 0 12px 24px color-mix(in oklab, var(--primary) 20%, transparent);
        }
        .attachBtn:hover,
        .postBtn:hover {
          transform: translateY(-1px);
        }
        .attachBtn[disabled],
        .postBtn[disabled] {
          opacity:.55;
          cursor:not-allowed;
          transform:none;
          box-shadow:none;
        }
        .toast {
          position: fixed;
          left: 50%;
          bottom: 24px;
          transform: translateX(-50%);
          z-index: 1200;
          min-width: min(420px, calc(100vw - 32px));
          max-width: calc(100vw - 32px);
          padding: 14px 16px;
          border-radius: 18px;
          border: 1px solid color-mix(in oklab, var(--primary) 28%, var(--border));
          background:
            linear-gradient(135deg, color-mix(in oklab, var(--bg2) 94%, transparent), color-mix(in oklab, var(--bg) 88%, var(--bg2) 12%));
          color: var(--text);
          box-shadow: 0 20px 44px rgba(15, 23, 42, 0.22);
          text-align: center;
          font-size: 14px;
          font-weight: 700;
          backdrop-filter: blur(12px);
        }
        .toast.isUploading {
          border-color: color-mix(in oklab, var(--primary) 34%, var(--border));
        }
        @media (max-width: 640px) {
          .composer {
            padding: 14px;
            border-radius: 20px;
          }
          .composerHead {
            grid-template-columns: 1fr;
            display: grid;
          }
          .attachBtn,
          .postBtn {
            width: 100%;
          }
          .grid.mcount-2,
          .grid.mcount-3,
          .grid.mcount-4 {
            grid-template-columns: 1fr 1fr;
          }
          .grid.mcount-3 .cell:first-child {
            height: 208px;
          }
          .composerFoot {
            align-items: stretch;
          }
          .footHint {
            width: 100%;
          }
          .toast {
            bottom: 16px;
            border-radius: 16px;
            font-size: 13px;
          }
        }
      `}</style>
    </div>
  );
}
