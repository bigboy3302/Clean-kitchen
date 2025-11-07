"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import type { SavedWorkoutVisibility, WorkoutContent } from "@/lib/workouts/types";
import { auth } from "@/lib/firebas1e";
import { uploadWorkoutMedia } from "@/lib/uploads";
import { saveWorkout } from "@/lib/workouts/client";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

const VISIBILITY_OPTIONS: SavedWorkoutVisibility[] = ["private", "public"];

function parseList(text: string): string[] | undefined {
  const list = text
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length ? list.slice(0, 8) : undefined;
}

function toHtml(value: string) {
  const blocks = value
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (!blocks.length) return null;
  return blocks.map((block) => `<p>${block.replace(/\n+/g, "<br/>")}</p>`).join("");
}

function detectMediaType(urlOrMime: string | null): WorkoutContent["mediaType"] {
  if (!urlOrMime) return "gif";
  if (urlOrMime.includes("mp4") || /^video\//i.test(urlOrMime)) return "mp4";
  if (urlOrMime.includes("png") || urlOrMime.includes("jpg") || urlOrMime.includes("jpeg") || urlOrMime.includes("webp")) {
    return "image";
  }
  return "gif";
}

export default function NewWorkoutPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [target, setTarget] = useState("");
  const [equipment, setEquipment] = useState("");
  const [primaryMuscles, setPrimaryMuscles] = useState("");
  const [secondaryMuscles, setSecondaryMuscles] = useState("");
  const [equipmentList, setEquipmentList] = useState("");
  const [externalMedia, setExternalMedia] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaKind, setMediaKind] = useState<WorkoutContent["mediaType"]>("gif");
  const [mediaName, setMediaName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [visibility, setVisibility] = useState<SavedWorkoutVisibility>("private");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) {
      router.replace("/auth/login");
    }
  }, [router]);

  const combinedMediaUrl = mediaUrl || externalMedia.trim();

  const mediaPreviewType = useMemo(() => detectMediaType(mediaUrl ? mediaKind : externalMedia.toLowerCase()), [mediaKind, mediaUrl, externalMedia]);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!auth.currentUser) {
      setError("Sign in to upload media.");
      event.target.value = "";
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const uploadedUrl = await uploadWorkoutMedia(auth.currentUser.uid, file);
      setMediaUrl(uploadedUrl);
      setMediaKind(file.type.startsWith("video/") ? "mp4" : file.type.toLowerCase().includes("gif") ? "gif" : "image");
      setMediaName(file.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed. Try again.";
      setError(message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }, []);

  async function handleSubmit() {
    setError(null);
    const user = auth.currentUser;
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    if (!title.trim()) {
      setError("Please add a title.");
      return;
    }
    if (!description.trim()) {
      setError("Add a short description so others know what this workout is.");
      return;
    }

    const workout: WorkoutContent = {
      id: `custom-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
      title: title.trim(),
      description: description.trim(),
      mediaUrl: combinedMediaUrl || null,
      mediaType: mediaPreviewType,
      previewUrl: combinedMediaUrl || null,
      thumbnailUrl: combinedMediaUrl || null,
      instructionsHtml: toHtml(instructions.trim()),
      bodyPart: bodyPart.trim() || null,
      target: target.trim() || null,
      equipment: equipment.trim() || null,
      source: "user",
      primaryMuscles: parseList(primaryMuscles),
      secondaryMuscles: parseList(secondaryMuscles),
      equipmentList: parseList(equipmentList),
    };

    setBusy(true);
    try {
      await saveWorkout({ visibility, workout });
      router.push("/fitness");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save workout.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  const disableSubmit = busy || uploading;

  return (
    <main className="container">
      <h1 className="pageTitle">Create a workout</h1>
      <p className="subtitle">Share your custom movement with the community or keep it in your private library.</p>

      <section className="card">
        <div className="grid">
          <Input label="Title" value={title} onChange={(event) => setTitle(event.currentTarget.value)} placeholder="Mountain climber finisher" />
          <Input label="Body part" value={bodyPart} onChange={(event) => setBodyPart(event.currentTarget.value)} placeholder="Full body" />
          <Input label="Target muscle" value={target} onChange={(event) => setTarget(event.currentTarget.value)} placeholder="Core" />
          <Input label="Equipment" value={equipment} onChange={(event) => setEquipment(event.currentTarget.value)} placeholder="Bodyweight, dumbbells…" />
        </div>

        <div className="field">
          <label className="label">Short description</label>
          <textarea
            className="ta"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            placeholder="Describe what this movement focuses on or how to set it up."
          />
        </div>

        <div className="field">
          <label className="label">Detailed instructions</label>
          <textarea
            className="ta"
            rows={6}
            value={instructions}
            onChange={(event) => setInstructions(event.currentTarget.value)}
            placeholder="Step 1…"
          />
          <span className="hint">Use blank lines to separate paragraphs.</span>
        </div>

        <div className="grid">
          <Input
            label="Primary muscles (comma separated)"
            value={primaryMuscles}
            onChange={(event) => setPrimaryMuscles(event.currentTarget.value)}
            placeholder="Chest, triceps"
          />
          <Input
            label="Secondary muscles (comma separated)"
            value={secondaryMuscles}
            onChange={(event) => setSecondaryMuscles(event.currentTarget.value)}
            placeholder="Shoulders"
          />
          <Input
            label="Equipment list (comma separated)"
            value={equipmentList}
            onChange={(event) => setEquipmentList(event.currentTarget.value)}
            placeholder="Yoga mat, timer"
          />
          <Input
            label="External media URL"
            value={externalMedia}
            onChange={(event) => setExternalMedia(event.currentTarget.value)}
            placeholder="https://…"
            hint="Optional: paste a gif/video URL if you already host it"
          />
        </div>

        <div className="mediaUpload">
          <div>
            <label className="label">Upload media</label>
            <input type="file" accept="image/*,video/*" onChange={handleFileChange} disabled={uploading || busy} />
            <span className="hint">Images up to 20 MB, videos up to 120 MB.</span>
            {mediaName ? <p className="mediaName">Uploaded: {mediaName}</p> : null}
          </div>
          {combinedMediaUrl ? (
            <div className="preview">
              {mediaPreviewType === "mp4" ? (
                <video src={combinedMediaUrl} controls playsInline preload="metadata" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={combinedMediaUrl} alt={title || "Workout media"} />
              )}
              <button type="button" className="ghostBtn" onClick={() => { setMediaUrl(""); setExternalMedia(""); setMediaName(""); }}>
                Remove media
              </button>
            </div>
          ) : null}
        </div>

        <div className="visibility">
          <p className="label">Visibility</p>
          <div className="chips">
            {VISIBILITY_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={visibility === option ? "chip on" : "chip"}
                onClick={() => setVisibility(option)}
              >
                {option === "private" ? "Private (only me)" : "Public (share with community)"}
              </button>
            ))}
          </div>
        </div>

        {error ? <p className="error">{error}</p> : null}

        <div className="actions">
          <Button onClick={handleSubmit} disabled={disableSubmit}>
            {busy ? "Saving…" : "Save workout"}
          </Button>
          <Button variant="secondary" onClick={() => router.push("/fitness")} disabled={disableSubmit}>
            Cancel
          </Button>
        </div>
      </section>

      <style jsx>{`
        .container {
          max-width: 960px;
          margin: 0 auto;
          padding: 32px 20px 80px;
          display: grid;
          gap: 16px;
        }
        .pageTitle {
          font-size: clamp(2rem, 4vw, 2.6rem);
          margin: 0;
          font-weight: 800;
        }
        .subtitle {
          margin: 0;
          color: var(--muted);
          font-size: 1rem;
        }
        .card {
          border: 1px solid color-mix(in oklab, var(--border) 85%, transparent);
          border-radius: 20px;
          padding: 20px;
          background: color-mix(in oklab, var(--bg2) 96%, transparent);
          box-shadow: 0 18px 60px rgba(15, 23, 42, 0.08);
          display: grid;
          gap: 18px;
        }
        .grid {
          display: grid;
          gap: 14px 18px;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }
        .field {
          display: grid;
          gap: 8px;
        }
        .label {
          font-weight: 700;
          color: var(--text);
        }
        .hint {
          font-size: 0.85rem;
          color: var(--muted);
        }
        .ta {
          border-radius: 14px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          padding: 12px;
          background: var(--bg);
          color: var(--text);
          font-family: inherit;
          resize: vertical;
          min-height: 120px;
        }
        .mediaUpload {
          border: 1px dashed color-mix(in oklab, var(--border) 70%, transparent);
          border-radius: 16px;
          padding: 16px;
          display: grid;
          gap: 12px;
          background: color-mix(in oklab, var(--bg2) 94%, transparent);
        }
        .mediaUpload input[type="file"] {
          font-size: 0.95rem;
        }
        .mediaName {
          margin: 6px 0 0;
          font-size: 0.9rem;
          color: var(--muted);
        }
        .preview {
          display: grid;
          gap: 10px;
        }
        .preview img,
        .preview video {
          width: 100%;
          max-height: 320px;
          border-radius: 16px;
          object-fit: cover;
          border: 1px solid color-mix(in oklab, var(--border) 85%, transparent);
        }
        .ghostBtn {
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          padding: 6px 12px;
          background: transparent;
          font-weight: 600;
          cursor: pointer;
        }
        .visibility {
          display: grid;
          gap: 10px;
        }
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .chip {
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--border) 75%, transparent);
          padding: 10px 16px;
          background: transparent;
          cursor: pointer;
          font-weight: 600;
          color: var(--text);
        }
        .chip.on {
          background: var(--primary);
          color: var(--primary-contrast);
          border-color: var(--primary);
          box-shadow: 0 12px 24px color-mix(in oklab, var(--primary) 30%, transparent);
        }
        .actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          flex-wrap: wrap;
        }
        .error {
          margin: 0;
          border-radius: 12px;
          border: 1px solid color-mix(in oklab, #ef4444 60%, transparent);
          background: color-mix(in oklab, #fee2e2 70%, transparent);
          color: #7f1d1d;
          padding: 10px 12px;
          font-weight: 600;
        }
        @media (max-width: 720px) {
          .card {
            padding: 16px;
            border-radius: 16px;
          }
          .actions {
            justify-content: stretch;
          }
          .actions :global(button) {
            flex: 1;
          }
        }
      `}</style>
    </main>
  );
}
