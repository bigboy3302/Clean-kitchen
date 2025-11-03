/* components/fitness/CreateWorkoutForm.tsx */
"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { auth, storage } from "@/lib/firebas1e";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import type { WorkoutInput } from "@/lib/validation/workout";

const BODY_PART_OPTIONS = [
  "back",
  "cardio",
  "chest",
  "lower legs",
  "shoulders",
  "upper arms",
  "upper legs",
  "waist",
  "glutes",
  "neck",
] as const;

const EQUIPMENT_OPTIONS = [
  "body weight",
  "dumbbell",
  "barbell",
  "kettlebell",
  "machine",
  "cable",
  "band",
  "medicine ball",
  "other",
] as const;

type Visibility = "public" | "private";

type FormState = {
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl: string;
  visibility: Visibility;
  instructions: string[];
};

const defaultState: FormState = {
  name: "",
  bodyPart: "chest",
  target: "",
  equipment: "body weight",
  gifUrl: "",
  visibility: "public",
  instructions: [""],
};

export default function CreateWorkoutForm() {
  const [form, setForm] = useState<FormState>(defaultState);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  const onChange = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const canSubmit = useMemo(() => {
    return (
      form.name.trim().length >= 2 &&
      form.bodyPart.trim().length >= 2 &&
      form.target.trim().length >= 2 &&
      form.equipment.trim().length >= 2 &&
      !busy
    );
  }, [form, busy]);

  const cleanInstructions = useMemo(
    () => form.instructions.map((step) => step.trim()).filter(Boolean),
    [form.instructions]
  );

  async function handleUpload(userUid: string): Promise<string | undefined> {
    if (!file) return form.gifUrl.trim() || undefined;
    const safeName = file.name.replace(/\s+/g, "-").toLowerCase();
    const path = `workouts/${userUid}/${Date.now()}-${safeName}`;
    const ref = storageRef(storage, path);
    const task = uploadBytesResumable(ref, file, {
      contentType: file.type || "image/gif",
      cacheControl: "public,max-age=86400",
    });
    await new Promise<void>((resolve, reject) => {
      task.on(
        "state_changed",
        undefined,
        (err) => reject(err),
        () => resolve()
      );
    });
    return await getDownloadURL(task.snapshot.ref);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSuccess(null);

    const user = auth.currentUser;
    if (!user) {
      setError("Please sign in to create workouts.");
      router.replace("/auth/login");
      return;
    }

    setBusy(true);
    try {
      const payload: WorkoutInput = {
        name: form.name.trim(),
        bodyPart: form.bodyPart.trim(),
        target: form.target.trim(),
        equipment: form.equipment.trim(),
        gifUrl: undefined,
        instructions: cleanInstructions.length ? cleanInstructions : undefined,
        visibility: form.visibility,
      };

      const finalGif = await handleUpload(user.uid);
      if (finalGif) payload.gifUrl = finalGif;
      else if (form.gifUrl.trim()) payload.gifUrl = form.gifUrl.trim();

      const token = await user.getIdToken();
      const res = await fetch("/api/workouts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message =
          (body && typeof body.error === "string" && body.error) ||
          "Failed to create workout.";
        throw new Error(message);
      }

      setSuccess("Workout created! Redirecting…");
      setForm(defaultState);
      setFile(null);
      setTimeout(() => {
        router.push("/fitness");
      }, 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create workout.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="formHead">
        <h1>Create Workout</h1>
        <p className="muted">
          Share your best movements with the community. Add cues, equipment, and a GIF so everyone can follow along.
        </p>
      </div>

      <div className="grid">
        <Input
          label="Workout name"
          placeholder="Flat dumbbell press"
          value={form.name}
          onChange={(e) => onChange("name", e.currentTarget.value)}
          required
        />

        <Select
          label="Body part"
          value={form.bodyPart}
          onChange={(e) => onChange("bodyPart", e.currentTarget.value)}
        >
          {BODY_PART_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {capitalize(option)}
            </option>
          ))}
        </Select>

        <Input
          label="Target muscle"
          placeholder="pectorals"
          value={form.target}
          onChange={(e) => onChange("target", e.currentTarget.value)}
          required
        />

        <Select
          label="Equipment"
          value={form.equipment}
          onChange={(e) => onChange("equipment", e.currentTarget.value)}
        >
          {EQUIPMENT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {capitalize(option)}
            </option>
          ))}
        </Select>

        <Input
          label="GIF URL (optional)"
          placeholder="https://…"
          value={form.gifUrl}
          onChange={(e) => onChange("gifUrl", e.currentTarget.value)}
        />

        <label className="fileInput">
          <span className="lab">Upload GIF / MP4 (optional)</span>
          <input
            type="file"
            accept="image/gif,image/webp,video/mp4,video/webm"
            onChange={(event) => {
              const next = event.currentTarget.files?.[0] ?? null;
              setFile(next);
            }}
          />
          <span className="hint">
            {file ? `Selected: ${file.name}` : "Upload a clip if you don’t have a hosted URL."}
          </span>
        </label>
      </div>

      <div className="instructions">
        <div className="instructionsHead">
          <h2>Instructions</h2>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onChange("instructions", [...form.instructions, ""])}
          >
            + Add step
          </Button>
        </div>

        {form.instructions.length === 0 ? (
          <p className="muted">No steps yet. Add cues to help others follow along.</p>
        ) : (
          <ol className="steps">
            {form.instructions.map((step, index) => (
              <li key={`step-${index}`} className="step">
                <textarea
                  value={step}
                  rows={3}
                  placeholder={`Step ${index + 1}`}
                  onChange={(e) => {
                    const next = [...form.instructions];
                    next[index] = e.currentTarget.value;
                    onChange("instructions", next);
                  }}
                />
                <button
                  type="button"
                  className="remove"
                  onClick={() => {
                    const next = [...form.instructions];
                    next.splice(index, 1);
                    onChange("instructions", next.length ? next : [""]);
                  }}
                  aria-label="Remove step"
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <Select
        label="Visibility"
        value={form.visibility}
        onChange={(e) => onChange("visibility", e.currentTarget.value as Visibility)}
      >
        <option value="public">Public – visible to everyone</option>
        <option value="private">Private – only you can see it</option>
      </Select>

      {error ? <p className="alert error">{error}</p> : null}
      {success ? <p className="alert success">{success}</p> : null}

      <div className="actions">
        <Button type="submit" disabled={!canSubmit}>
          {busy ? "Saving…" : "Create workout"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setForm(defaultState);
            setFile(null);
            setError(null);
            setSuccess(null);
          }}
          disabled={busy}
        >
          Reset
        </Button>
      </div>

      <style jsx>{`
        .form {
          display: grid;
          gap: 20px;
        }
        .formHead h1 {
          margin: 0;
          font-size: clamp(1.6rem, 2.6vw, 2rem);
          font-weight: 800;
        }
        .formHead p {
          margin: 6px 0 0;
          max-width: 60ch;
        }
        .muted {
          color: var(--muted);
        }
        .grid {
          display: grid;
          gap: 16px 18px;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        }
        .fileInput {
          display: flex;
          flex-direction: column;
          gap: 6px;
          border: 1px dashed var(--border);
          border-radius: 12px;
          padding: 12px;
          background: color-mix(in oklab, var(--bg2) 92%, transparent);
        }
        .fileInput .lab {
          font-size: 0.9rem;
          font-weight: 600;
        }
        .fileInput input {
          background: transparent;
          color: var(--text);
        }
        .fileInput .hint {
          font-size: 0.75rem;
          color: var(--muted);
        }
        .instructions {
          display: grid;
          gap: 12px;
        }
        .instructionsHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .instructionsHead h2 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 700;
        }
        .steps {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 12px;
        }
        .step {
          display: grid;
          gap: 8px;
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px;
          background: color-mix(in oklab, var(--bg2) 94%, transparent);
        }
        .step textarea {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 10px 12px;
          background: var(--bg);
          color: var(--text);
          resize: vertical;
          min-height: 72px;
        }
        .remove {
          justify-self: flex-end;
          border: none;
          background: none;
          color: var(--muted);
          font-weight: 600;
          cursor: pointer;
        }
        .remove:hover {
          color: var(--primary);
        }
        .alert {
          border-radius: 12px;
          padding: 12px 14px;
          font-weight: 600;
        }
        .alert.error {
          background: color-mix(in oklab, #ef4444 12%, var(--card-bg));
          border: 1px solid color-mix(in oklab, #ef4444 38%, var(--border));
          color: color-mix(in oklab, #991b1b 85%, var(--text));
        }
        .alert.success {
          background: color-mix(in oklab, #16a34a 12%, var(--card-bg));
          border: 1px solid color-mix(in oklab, #16a34a 38%, var(--border));
          color: color-mix(in oklab, #166534 88%, var(--text));
        }
        .actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
      `}</style>
    </form>
  );
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}
