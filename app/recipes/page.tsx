"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties as ReactCSSProperties,
} from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getDownloadURL, ref as sref, uploadBytes } from "firebase/storage";

// NOTE: if your file is actually "firebas1e", switch it back.
import { auth, db, storage } from "@/lib/firebas1e";

import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import type { CommonRecipe, Ingredient } from "@/components/recipes/types";
import RecipeModal from "@/components/recipes/RecipeModal";
import RecipeCard, { type IngredientObj, getRecipePlaceholder } from "@/components/recipes/RecipeCard";
import {
  getRandomMeals,
  searchMealsByIngredient,
  searchMealsByName,
  lookupMealById,
  searchMealsByIngredientsAND,
} from "@/lib/recipesApi";

/* -------------------------- helpers & type guards -------------------------- */

const capFirst = (s: string) => s.replace(/^\p{L}/u, (m) => m.toUpperCase());
const ridFor = (r: CommonRecipe) => (r.source === "api" ? `api-${r.id}` : `user-${r.id}`);

type TimestampLike =
  | { seconds?: number; toDate?: () => Date }
  | Date
  | number
  | string
  | null
  | undefined;

const toMillis = (ts: TimestampLike): number => {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === "string") {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof ts === "object") {
    if (typeof ts.toDate === "function") {
      try {
        return ts.toDate().getTime();
      } catch {
        return 0;
      }
    }
    if (typeof ts.seconds === "number") return ts.seconds * 1000;
  }
  return 0;
};

const safeString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const safeNullableString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const safeNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
};

const extractFromRecord = (record: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
};

const getRecipeImage = (recipe: CommonRecipe): string | null => {
  if (recipe.image) return recipe.image;
  const record = recipe as Record<string, unknown>;
  return (
    extractFromRecord(record, ["imageURL", "imageUrl", "cover", "coverUrl", "coverURL"]) ?? null
  );
};

const getRecipeMinutes = (recipe: CommonRecipe): number | null => {
  const record = recipe as Record<string, unknown>;
  return safeNumber(record.minutes);
};

const getRecipeServings = (recipe: CommonRecipe): number | null => {
  const record = recipe as Record<string, unknown>;
  return safeNumber(record.servings);
};

/** Ingredient list used by RecipeCard (name/measure strings). */
const normalizeIngredientList = (ingredients: unknown): IngredientObj[] => {
  if (!Array.isArray(ingredients)) return [];
  return ingredients.map((entry) => {
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      return {
        name: safeString(record.name),
        measure: safeString(record.measure, ""),
      };
    }
    return { name: "", measure: "" };
  });
};

/** Ingredient[] used by your domain types. */
const normalizeIngredients = (value: unknown): Ingredient[] => {
  if (!Array.isArray(value)) return [];
  const result: Ingredient[] = [];
  for (const entry of value) {
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const name = safeNullableString(record.name);
      if (name) {
        const measureValue = safeNullableString(record.measure);
        result.push({ name, measure: measureValue ?? "" });
      }
    }
  }
  return result;
};

type RecipeListItem = CommonRecipe & {
  createdAtMillis: number;
  minutes?: number | null;
  servings?: number | null;
};

const withRecipeMeta = (recipe: CommonRecipe): RecipeListItem => {
  const record = recipe as Record<string, unknown>;
  return {
    ...recipe,
    ingredients: normalizeIngredients((recipe as CommonRecipe).ingredients),
    instructions: safeNullableString((recipe as CommonRecipe).instructions) ?? recipe.instructions ?? null,
    createdAtMillis: toMillis(record.createdAt as TimestampLike),
    minutes: safeNumber(record.minutes),
    servings: safeNumber(record.servings),
  };
};

/** CSS variable-friendly type for inline styles. */
type WaveCharStyle = ReactCSSProperties & { ["--index"]?: number };
const waveCharStyle = (index: number): WaveCharStyle => ({ ["--index"]: index });

const mapUserRecipeDoc = (
  snapshot: QueryDocumentSnapshot<DocumentData>,
  ownerUid: string
): RecipeListItem => {
  const data = snapshot.data() as Record<string, unknown>;
  const authorRecord =
    data.author && typeof data.author === "object"
      ? (data.author as Record<string, unknown>)
      : undefined;

  const author = {
    uid: safeNullableString(authorRecord?.uid) ?? safeNullableString(data.uid) ?? ownerUid ?? null,
    name: safeNullableString(authorRecord?.name),
  };

  const createdAtMillis = toMillis(data.createdAt as TimestampLike);
  const image =
    safeNullableString(data.image) ??
    extractFromRecord(data, ["imageURL", "imageUrl", "cover", "coverUrl", "coverURL"]);

  return {
    id: snapshot.id,
    source: "user",
    title: safeString(data.title, "Untitled"),
    image: image ?? null,
    category: safeNullableString(data.category),
    area: safeNullableString(data.area),
    ingredients: normalizeIngredients(data.ingredients),
    instructions: safeNullableString(data.instructions),
    author,
    createdAtMillis,
    minutes: safeNumber(data.minutes),
    servings: safeNumber(data.servings),
  } as RecipeListItem;
};

/* -------------------------------- components -------------------------------- */

function SignInPrompt({
  open,
  onClose,
  onSigninHref = "/login",
}: {
  open: boolean;
  onClose: () => void;
  onSigninHref?: string;
}) {
  if (!open) return null;
  return (
    <div className="ov" role="dialog" aria-modal aria-labelledby="si-title" onClick={onClose}>
      <div className="card" onClick={(e) => e.stopPropagation()}>
        <div className="hdr">
          <div id="si-title" className="t">
            Please sign in
          </div>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="body">
          <p className="p">
            You need an account to favorite recipes. Sign in to save and view your favorites across
            devices.
          </p>
        </div>
        <div className="actions">
          <Link className="btn primary" href={onSigninHref}>
            Sign in
          </Link>
          <button className="btn" onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
      <style jsx>{`
        .ov {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.55);
          display: grid;
          place-items: center;
          padding: 16px;
          z-index: 1600;
          animation: fade 0.15s ease-out;
        }
        @keyframes fade {
          from {
            opacity: 0.5;
          }
          to {
            opacity: 1;
          }
        }
        .card {
          width: 100%;
          max-width: 460px;
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          box-shadow: 0 20px 50px rgba(2, 6, 23, 0.2);
          transform: translateY(8px);
          animation: pop 0.18s ease-out forwards;
        }
        @keyframes pop {
          to {
            transform: translateY(0);
          }
        }
        .hdr {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-bottom: 1px solid var(--border);
          background: color-mix(in oklab, var(--card-bg) 92%, #fff);
        }
        .t {
          font-weight: 800;
          color: var(--text);
        }
        .x {
          border: none;
          background: var(--bg2);
          color: var(--text);
          border-radius: 10px;
          padding: 4px 10px;
          cursor: pointer;
        }
        .body {
          padding: 14px;
        }
        .p {
          margin: 0;
          color: var(--text);
        }
        .actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          padding: 12px 14px;
          border-top: 1px solid var(--border);
          background: color-mix(in oklab, var(--card-bg) 96%, #fff);
        }
        .btn {
          border: 1px solid var(--border);
          background: var(--bg2);
          border-radius: 12px;
          padding: 8px 12px;
          cursor: pointer;
          text-decoration: none;
          color: inherit;
        }
        .btn.primary {
          background: var(--primary);
          border-color: var(--primary);
          color: var(--primary-contrast);
        }
        .btn:hover {
          filter: brightness(0.98);
        }
      `}</style>
    </div>
  );
}

function PantryPicker({
  open,
  onClose,
  allItems,
  onSearch,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  allItems: string[];
  onSearch: (terms: string[]) => void;
  busy?: boolean;
}) {
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => {
    if (open) setSel([]);
  }, [open]);
  function toggle(n: string) {
    setSel((xs) => (xs.includes(n) ? xs.filter((v) => v !== n) : [...xs, n]));
  }
  if (!open) return null;
  return (
    <div className="ov" onClick={onClose} role="dialog" aria-modal>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <div className="bh">
          <div className="bt">Find recipes with my pantry</div>
          <button className="x" onClick={onClose}>
            ×
          </button>
        </div>
        {allItems.length === 0 ? (
          <p className="muted small" style={{ padding: 12 }}>
            Your pantry is empty.
          </p>
        ) : (
          <>
            <div className="chips">
              {allItems.map((n) => (
                <label key={n} className={`chip ${sel.includes(n) ? "on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={sel.includes(n)}
                    onChange={() => toggle(n)}
                  />
                  <span>{n}</span>
                </label>
              ))}
            </div>
            <div className="row">
              <Button onClick={() => onSearch(sel)} disabled={!sel.length || !!busy}>
                {busy ? "Searching…" : `Search (${sel.length})`}
              </Button>
              <Button variant="secondary" onClick={onClose} disabled={!!busy}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
      <style jsx>{`
        .ov {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.55);
          display: grid;
          place-items: center;
          padding: 16px;
          z-index: 1400;
        }
        .box {
          width: 100%;
          max-width: 760px;
          max-height: 90vh;
          overflow: auto;
          background: var(--card-bg);
          border-radius: 16px;
          border: 1px solid var(--border);
        }
        .bh {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border);
          padding: 10px 12px;
        }
        .bt {
          font-weight: 800;
          color: var(--text);
        }
        .x {
          border: none;
          background: var(--text);
          color: var(--primary-contrast);
          border-radius: 10px;
          padding: 4px 10px;
          cursor: pointer;
        }
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          padding: 12px;
        }
        .chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 6px 10px;
          background: var(--bg2);
          cursor: pointer;
          user-select: none;
        }
        .chip input {
          display: none;
        }
        .chip.on {
          background: #e0f2fe;
          border-color: #7dd3fc;
        }
        .row {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          padding: 0 12px 12px;
        }
      `}</style>
    </div>
  );
}

type Row = {
  name: string;
  qty: string;
  unit: "g" | "kg" | "ml" | "l" | "pcs" | "tbsp" | "tsp" | "cup";
};

type WizardStep = 0 | 1 | 2 | 3;

function CreateRecipeWizard({
  open,
  onClose,
  onSaved,
  meUid,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  meUid: string | null;
}) {
  const [step, setStep] = useState<WizardStep>(0);
  const [title, setTitle] = useState("");
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgPrev, setImgPrev] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([{ name: "", qty: "", unit: "g" }]);
  const [steps, setSteps] = useState<string[]>(["", "", ""]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setTitle("");
    setImgFile(null);
    setImgPrev(null);
    setRows([{ name: "", qty: "", unit: "g" }]);
    setSteps(["", "", ""]);
    setErr(null);
  }, [open]);

  const handleTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTitle(event.target.value);
  };

  const handleRowChange =
    (index: number, field: keyof Row) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setRows((list) =>
        list.map((row, rowIndex) =>
          rowIndex === index
            ? { ...row, [field]: field === "unit" ? (value as Row["unit"]) : value }
            : row
        )
      );
    };

  const handleInstructionChange =
    (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.currentTarget.value;
      setSteps((list) => list.map((entry, entryIndex) => (entryIndex === index ? value : entry)));
    };

  const addRow = () => setRows((list) => [...list, { name: "", qty: "", unit: "g" }]);
  const removeRow = (index: number) =>
    setRows((list) => (list.length > 1 ? list.filter((_, rowIndex) => rowIndex !== index) : list));

  const addStep = () => setSteps((list) => [...list, ""]);
  const removeStep = (index: number) =>
    setSteps((list) => (list.length > 1 ? list.filter((_, rowIndex) => rowIndex !== index) : list));

  const changeStep = (delta: 1 | -1) => {
    setStep((previous) => {
      const next = previous + delta;
      if (next < 0) return 0;
      if (next > 3) return 3;
      return next as WizardStep;
    });
  };

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    if (!file) return;
    setImgFile(file);
    setImgPrev(URL.createObjectURL(file));
  };

  async function save() {
    if (!meUid) return;
    const trimmedTitle = capFirst(title.trim());
    const cleanRows = rows
      .map((row) => ({
        name: row.name.trim(),
        qty: row.qty.trim(),
        unit: row.unit,
      }))
      .filter((row) => row.name && row.qty);

    if (!trimmedTitle) {
      setErr("Please enter a title.");
      setStep(0);
      return;
    }

    if (cleanRows.length === 0) {
      setErr("Please add at least one ingredient.");
      setStep(1);
      return;
    }

    const ingredients: Ingredient[] = cleanRows.map((row) => ({
      name: row.name,
      measure: `${row.qty} ${row.unit}`.trim(),
    }));

    const instructionsText = steps
      .map((instruction, index) =>
        instruction.trim() ? `${index + 1}) ${instruction.trim()}` : ""
      )
      .filter(Boolean)
      .join("\n");

    const payload = {
      uid: meUid,
      author: {
        uid: meUid,
        name: auth.currentUser?.displayName ?? null,
      } as { uid: string; name: string | null },
      title: trimmedTitle,
      titleLower: trimmedTitle.toLowerCase(),
      image: null as string | null,
      category: null as string | null,
      area: null as string | null,
      ingredients,
      instructions: instructionsText || null,
      createdAt: serverTimestamp(),
    };

    setBusy(true);
    setErr(null);
    try {
      const refDoc = await addDoc(collection(db, "recipes"), payload);
      if (imgFile) {
        const path = `recipeImages/${meUid}/${refDoc.id}/cover`;
        const storageRef = sref(storage, path);
        await uploadBytes(storageRef, imgFile, { contentType: imgFile.type });
        const url = await getDownloadURL(storageRef);
        await updateDoc(refDoc, { image: url });
      }
      onSaved();
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save recipe.";
      setErr(message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="ov" onClick={onClose} role="dialog" aria-modal>
      <div className="wiz" onClick={(event) => event.stopPropagation()}>
        <header className="header">
          <div className="title">Create recipe</div>
          <div className="dots">
            {[0, 1, 2, 3].map((index) => (
              <span key={index} className={`dot ${index <= step ? "on" : ""}`} />
            ))}
          </div>
        </header>

        {step === 0 && (
          <section className="slide">
            <Input
              label="Title"
              value={title}
              onChange={handleTitleChange}
              placeholder="Best Tomato Pasta"
            />
            <div>
              <label className="lab">
                Cover photo <span className="muted small">(optional)</span>
              </label>
              {imgPrev ? (
                <div className="pick">
                  <Image
                    className="cover"
                    src={imgPrev}
                    alt="Preview"
                    width={160}
                    height={100}
                    unoptimized
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setImgPrev(null);
                      setImgFile(null);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <input type="file" accept="image/*" onChange={onPick} />
              )}
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="slide">
            <h3 className="h3">Ingredients</h3>
            <div className="rows">
              {rows.map((row, index) => (
                <div key={index} className="row">
                  <input
                    className="name"
                    placeholder="Ingredient (e.g. Tomato)"
                    value={row.name}
                    onChange={handleRowChange(index, "name")}
                  />
                  <input
                    className="qty"
                    type="number"
                    min={0}
                    placeholder="Qty"
                    value={row.qty}
                    onChange={handleRowChange(index, "qty")}
                  />
                  <select
                    className="unit"
                    value={row.unit}
                    onChange={handleRowChange(index, "unit")}
                  >
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="l">l</option>
                    <option value="pcs">pcs</option>
                    <option value="tbsp">tbsp</option>
                    <option value="tsp">tsp</option>
                    <option value="cup">cup</option>
                  </select>
                  <button
                    type="button"
                    className="minus"
                    onClick={() => removeRow(index)}
                    aria-label="Remove ingredient"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="footerRow">
              <Button variant="secondary" onClick={addRow}>
                Add ingredient
              </Button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="slide">
            <h3 className="h3">Instructions</h3>
            <div className="steps">
              {steps.map((instruction, index) => (
                <div key={index} className="stepRow">
                  <div className="num">{index + 1})</div>
                  <input
                    className="stepInput"
                    placeholder="Write step…"
                    value={instruction}
                    onChange={handleInstructionChange(index)}
                  />
                  <button
                    type="button"
                    className="minus"
                    onClick={() => removeStep(index)}
                    aria-label="Remove instruction"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="footerRow">
              <Button variant="secondary" onClick={addStep}>
                Add step
              </Button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="slide">
            <h3 className="h3">Review</h3>
            <div className="review">
              <div>
                <strong>Title:</strong> {title || <em>(missing)</em>}
              </div>
              <div>
                <strong>Ingredients:</strong>
                <ul className="ul">
                  {rows
                    .filter((row) => row.name && row.qty)
                    .map((row, index) => (
                      <li key={index}>
                        {row.name} – {row.qty} {row.unit}
                      </li>
                    ))}
                </ul>
              </div>
              <div>
                <strong>Instructions:</strong>
                <ul className="ul">
                  {steps
                    .filter((instruction) => instruction.trim())
                    .map((instruction, index) => (
                      <li key={index}>
                        {index + 1}) {instruction}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {err && <p className="error">{err}</p>}

        <footer className="actions">
          {step > 0 ? (
            <Button variant="secondary" onClick={() => changeStep(-1)}>
              Back
            </Button>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={() => changeStep(1)}>Next</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setStep(0)}>
                No, go back
              </Button>
              <Button onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Yes, save recipe"}
              </Button>
            </>
          )}
        </footer>
      </div>

      <style jsx>{`
        .ov {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.55);
          display: grid;
          place-items: center;
          padding: 16px;
          z-index: 1450;
        }
        .wiz {
          width: 100%;
          max-width: 820px;
          max-height: 92vh;
          overflow: auto;
          background: var(--card-bg);
          border-radius: 16px;
          border: 1px solid var(--border);
          box-shadow: 0 20px 50px rgba(2, 6, 23, 0.18);
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border);
          padding: 12px 14px;
          background: color-mix(in oklab, var(--card-bg) 85%, #fff);
        }
        .title {
          font-weight: 800;
          color: var(--text);
        }
        .dots {
          display: flex;
          gap: 6px;
        }
        .dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #e5e7eb;
        }
        .dot.on {
          background: var(--primary);
        }
        .slide {
          padding: 14px;
          display: grid;
          gap: 10px;
        }
        .lab {
          display: block;
          margin: 8px 0 6px;
          font-weight: 600;
        }
        .pick {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .cover {
          width: 160px;
          height: 100px;
          object-fit: cover;
          border-radius: 10px;
          border: 1px solid var(--border);
        }
        .h3 {
          margin: 6px 0 2px;
          color: var(--text);
        }
        .rows {
          display: grid;
          gap: 8px;
        }
        .row {
          display: grid;
          grid-template-columns: 1fr 100px 110px 34px;
          gap: 8px;
        }
        .name,
        .qty,
        .unit {
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 8px 10px;
          background: var(--bg2);
          color: var(--text);
        }
        .minus {
          border: 0;
          background: #ef4444;
          color: #fff;
          border-radius: 10px;
          cursor: pointer;
        }
        .footerRow {
          display: flex;
          justify-content: flex-end;
        }
        .steps {
          display: grid;
          gap: 8px;
        }
        .stepRow {
          display: grid;
          grid-template-columns: 44px 1fr 34px;
          gap: 8px;
          align-items: center;
        }
        .num {
          font-weight: 800;
          color: var(--text);
          text-align: center;
        }
        .stepInput {
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 8px 10px;
          background: var(--bg2);
          color: var(--text);
        }
        .review {
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 10px;
          background: var(--bg2);
        }
        .ul {
          margin: 6px 0 0;
          padding-left: 18px;
        }
        .actions {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          border-top: 1px solid var(--border);
          padding: 12px 14px;
          background: color-mix(in oklab, var(--card-bg) 92%, #fff);
        }
        .error {
          margin: 8px 14px 0;
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}

function FavOverlay({
  uid,
  onClose,
  onOpen,
}: {
  uid: string | null;
  onClose: () => void;
  onOpen: (id: string, source: "api" | "user", recipeId: string) => void;
}) {
  const [rows, setRows] = useState<
    { id: string; title: string; image: string | null; source: "api" | "user"; recipeId: string }[]
  >([]);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "users", uid, "favoriteRecipes"));
    const stop = onSnapshot(q, (snap) => {
      const list = snap.docs.map((docSnapshot) => {
        const data = docSnapshot.data() as Record<string, unknown>;
        const source: "api" | "user" = data.source === "user" ? "user" : "api";
        return {
          id: docSnapshot.id,
          title: safeString(data.title, "Untitled"),
          image: safeNullableString(data.image),
          source,
          recipeId: safeString(data.recipeId, ""),
        };
      });
      setRows(list);
    });
    return () => stop();
  }, [uid]);

  async function removeFav(favId: string) {
    if (!uid) return;
    const ref = doc(db, "users", uid, "favoriteRecipes", favId);
    await deleteDoc(ref).catch(() => {});
  }

  return (
    <div className="ov" onClick={onClose} role="dialog" aria-modal>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <div className="bh">
          <div className="bt">Favorites</div>
          <button className="x" onClick={onClose}>
            ×
          </button>
        </div>
        {!uid ? (
          <p className="muted small" style={{ padding: 12 }}>
            Sign in to view favorites.
          </p>
        ) : rows.length === 0 ? (
          <p className="muted small" style={{ padding: 12 }}>
            No favorites yet.
          </p>
        ) : (
          <div className="gridFav">
            {rows.map((r) => (
              <div key={r.id} className="fi">
                {r.image ? (
                  <Image
                    className="fimg"
                    src={r.image}
                    alt={r.title ?? "Recipe image"}
                    width={320}
                    height={120}
                    unoptimized
                  />
                ) : (
                  <Image
                    className="fimg"
                    src={getRecipePlaceholder(r.id)}
                    alt={r.title ?? "Recipe image"}
                    width={320}
                    height={120}
                    unoptimized
                  />
                )}
                <div className="ft">{r.title}</div>
                <div className="btns">
                  <button className="open" onClick={() => onOpen(r.id, r.source, r.recipeId)}>
                    Open
                  </button>
                  <button className="unfav" onClick={() => removeFav(r.id)} title="Remove">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style jsx>{`
        .ov {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.55);
          display: grid;
          place-items: center;
          padding: 16px;
          z-index: 1500;
        }
        .box {
          width: 100%;
          max-width: 760px;
          max-height: 90vh;
          overflow: auto;
          background: var(--card-bg);
          border-radius: 16px;
          border: 1px solid var(--border);
        }
        .bh {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border);
          padding: 10px 12px;
        }
        .bt {
          font-weight: 800;
          color: var(--text);
        }
        .x {
          border: none;
          background: var(--text);
          color: var(--primary-contrast);
          border-radius: 10px;
          padding: 4px 10px;
          cursor: pointer;
        }
        .gridFav {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          padding: 12px;
        }
        @media (max-width: 840px) {
          .gridFav {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 560px) {
          .gridFav {
            grid-template-columns: 1fr;
          }
        }
        .fi {
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--bg2);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .fimg {
          width: 100%;
          height: 120px;
          object-fit: cover;
          background: #eee;
        }
        .ft {
          padding: 8px 10px;
          font-weight: 700;
          flex: 1;
          color: var(--text);
        }
        .btns {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          padding: 0 10px 10px;
        }
        .open {
          border: 1px solid var(--border);
          background: var(--bg2);
          border-radius: 8px;
          padding: 6px 10px;
          cursor: pointer;
        }
        .unfav {
          border: 1px solid rgb(249, 201, 6);
          background: #fef9c3;
          border-radius: 8px;
          padding: 6px 10px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

export default function RecipesPage() {
  const [me, setMe] = useState<string | null>(null);

  const [apiRecipes, setApiRecipes] = useState<RecipeListItem[]>([]);
  const [userRecipes, setUserRecipes] = useState<RecipeListItem[]>([]);
  const [pantryRecipes, setPantryRecipes] = useState<RecipeListItem[] | null>(null);

  const [favs, setFavs] = useState<Record<string, boolean>>({});
  const [showFavs, setShowFavs] = useState(false);

  const [pantry, setPantry] = useState<string[]>([]);

  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"name" | "ingredient">("name");
  const [areaFilter, setAreaFilter] = useState<string>("any");
  const [busySearch, setBusySearch] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [openModal, setOpenModal] = useState<CommonRecipe | null>(null);
  const [showPantryPicker, setShowPantryPicker] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const [showSigninPrompt, setShowSigninPrompt] = useState(false);

  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    let stopUserSub: (() => void) | null = null;
    let stopFavsSub: (() => void) | null = null;
    let stopPantrySub: (() => void) | null = null;

    const cleanupUserSubs = () => {
      if (stopUserSub) stopUserSub();
      if (stopFavsSub) stopFavsSub();
      if (stopPantrySub) stopPantrySub();
      stopUserSub = stopFavsSub = stopPantrySub = null;
    };

    setMe(auth.currentUser?.uid ?? null);

    const stopAuth = onAuthStateChanged(auth, (u) => {
      cleanupUserSubs();
      setMe(u?.uid ?? null);

      if (u) {
        const qMine = query(collection(db, "recipes"), where("uid", "==", u.uid));
        stopUserSub = onSnapshot(
          qMine,
          (snap) => {
            const rows = snap.docs
              .map((docSnapshot) => mapUserRecipeDoc(docSnapshot, u.uid))
              .sort((a, b) => b.createdAtMillis - a.createdAtMillis);
            setUserRecipes(rows);
          },
          () => {}
        );

        const fq = query(collection(db, "users", u.uid, "favoriteRecipes"));
        stopFavsSub = onSnapshot(fq, (snap) => {
          const map: Record<string, boolean> = {};
          snap.docs.forEach((d) => (map[d.id] = true));
          setFavs(map);
        });

        const pq = query(collection(db, "pantryItems"), where("uid", "==", u.uid));
        stopPantrySub = onSnapshot(pq, (snap) => {
          const names = snap.docs
            .map((docSnapshot) => {
              const data = docSnapshot.data() as Record<string, unknown>;
              const name = safeNullableString(data?.name);
              return name ? name.trim().toLowerCase() : "";
            })
            .filter((name) => name.length > 0);
          const uniq = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
          setPantry(uniq);
        });
      } else {
        setUserRecipes([]);
        setFavs({});
        setPantry([]);
      }
    });

    return () => {
      stopAuth();
      cleanupUserSubs();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await getRandomMeals(15);
        if (alive) setApiRecipes(list.map(withRecipeMeta));
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const id = setTimeout(async () => {
      setErr(null);
      setPantryRecipes(null);
      if (!q.trim()) {
        const list = await getRandomMeals(15);
        setApiRecipes(list.map(withRecipeMeta));
        setBusySearch(false);
        return;
      }
      setBusySearch(true);
      try {
        const list =
          mode === "ingredient"
            ? await searchMealsByIngredient(q.trim())
            : await searchMealsByName(q.trim());
        setApiRecipes(list.map(withRecipeMeta));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Search failed.";
        setErr(message);
      } finally {
        setBusySearch(false);
      }
    }, 280);
    return () => clearTimeout(id);
  }, [q, mode]);

  /* ---------- pantry picker → AND search ---------- */
  async function runPantrySearch(terms: string[]) {
    setErr(null);
    setBusySearch(true);
    setShowPantryPicker(false);
    try {
      const results = await searchMealsByIngredientsAND(terms, 36);
      setPantryRecipes(results.map(withRecipeMeta));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Pantry search failed.";
      setErr(message);
    } finally {
      setBusySearch(false);
    }
  }

  async function toggleFav(recipe: RecipeListItem) {
    const uid = me;
    if (!uid) {
      setShowSigninPrompt(true);
      return;
    }
    const id = ridFor(recipe);
    const ref = doc(db, "users", uid, "favoriteRecipes", id);
    if (favs[id]) {
      await deleteDoc(ref).catch(() => {});
    } else {
      await setDoc(ref, {
        title: recipe.title,
        image: recipe.image || null,
        source: recipe.source,
        recipeId: recipe.id,
        createdAt: serverTimestamp(),
      }).catch(() => {});
    }
  }

  async function openFavorite(id: string, source: "api" | "user", recipeId: string) {
    if (source === "api") {
      const hit =
        visibleRecipes.find((r) => r.source === "api" && r.id === recipeId) ||
        apiRecipes.find((r) => r.source === "api" && r.id === recipeId);
      if (hit) {
        setOpenModal(hit);
      } else {
        const full = await lookupMealById(recipeId);
        if (full) setOpenModal(full);
      }
    } else {
      const ref = doc(db, "recipes", recipeId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as Record<string, unknown>;
        setOpenModal({
          id: snap.id,
          source: "user",
          title: safeString(data.title, "Untitled"),
          image:
            safeNullableString(data.image) ??
            safeNullableString(data.imageURL) ??
            null,
          category: safeNullableString(data.category),
          area: safeNullableString(data.area),
          ingredients: normalizeIngredients(data.ingredients),
          instructions: safeNullableString(data.instructions),
          author: {
            uid: safeString(data.uid, ""),
            name:
              (data.author && typeof data.author === "object"
                ? safeNullableString((data.author as Record<string, unknown>).name)
                : null) ?? null,
          },
        } as CommonRecipe);
      }
    }
    setShowFavs(false);
  }

  const userFiltered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s || mode !== "name") return userRecipes;
    return userRecipes.filter((r) => (r.title || "").toLowerCase().includes(s));
  }, [userRecipes, q, mode]);

  const combined = useMemo(() => {
    if (pantryRecipes) return pantryRecipes;
    return [...userFiltered, ...apiRecipes];
  }, [pantryRecipes, userFiltered, apiRecipes]);

  const areas = useMemo(() => {
    const set = new Set<string>();
    combined.forEach((r) => {
      if (r.area) set.add(String(r.area));
    });
    return ["any", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [combined]);

  const visibleRecipes = useMemo(() => {
    if (areaFilter === "any") return combined;
    return combined.filter(
      (r) => (r.area || "").toLowerCase() === areaFilter.toLowerCase()
    );
  }, [combined, areaFilter]);

  const isSignedIn = !!me;

  return (
    <main className="container">
      <div className="topbar">
        <h1 className="title">Recipes</h1>
        <div className="right">
          {!isSignedIn && (
            <div className="signinHint">
              <strong>Tip:</strong> Sign in to create recipes, favorite, and search with your pantry.
            </div>
          )}
        </div>
      </div>

      <section className="card controls" aria-label="Search and actions">
        <div className="row">
          <div className="seg">
            <button
              className={`segBtn ${mode === "name" ? "active" : ""}`}
              onClick={() => setMode("name")}
              type="button"
            >
              By name
            </button>
            <button
              className={`segBtn ${mode === "ingredient" ? "active" : ""}`}
              onClick={() => setMode("ingredient")}
              type="button"
            >
              By ingredient
            </button>
          </div>

          <div className="grow">
            <div className="wave-group">
              <input
                required
                aria-label="Search"
                type="text"
                className="input"
                value={q}
                onChange={(e) => setQ(e.currentTarget.value)}
              />
              <span className="bar" />
              <label className="label" aria-hidden>
                {["S", "e", "a", "r", "c", "h"].map((ch, i) => (
                  <span className="label-char" style={waveCharStyle(i)} key={i}>
                    {ch}
                  </span>
                ))}
              </label>
            </div>
          </div>

          <div className="filters">
            <label className="small muted">Area</label>
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.currentTarget.value)}
              className="select"
            >
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a === "any" ? "Any area" : a}
                </option>
              ))}
            </select>
          </div>

          {isSignedIn ? (
            <div className="actionsRow">
              <Button variant="secondary" onClick={() => setShowPantryPicker(true)}>
                Find with my pantry
              </Button>
              <Button onClick={() => setShowWizard(true)}>Create recipe</Button>
              <Button className="linkBtn" onClick={() => setShowFavs(true)}>
                Favorites
              </Button>
            </div>
          ) : (
            <div className="actionsRow" />
          )}
        </div>

        {busySearch && <p className="muted small">Searching…</p>}
        {err && <p className="error">{err}</p>}
        {pantryRecipes && <p className="muted small">Showing suggestions from your pantry.</p>}
      </section>

      <section className="list">
        <div className="gridCards">
          {visibleRecipes.map((r, idx) => {
            const fav = favs[ridFor(r)];
            const key = `${r.source}-${r.id}`;
            const isOpen = expandedKey === key;
            const isLastCol = (idx + 1) % 3 === 0;

            const ingredientsList: IngredientObj[] = normalizeIngredientList(r.ingredients);
            const stepsList = r.instructions
              ? String(r.instructions).split("\n").filter(Boolean)
              : [];
            const imageUrl = getRecipeImage(r) ?? "/placeholder.png";

            const minutes = getRecipeMinutes(r);
            const baseServings = getRecipeServings(r) ?? 2;

            const isMine = r.source === "user" && !!me && r.author?.uid === me;
            const editHref = isMine ? `/profile/recipes/${r.id}` : undefined;

            return (
              <div key={key} className={`cardWrap ${isOpen && !isLastCol ? "span2" : ""}`}>
                <RecipeCard
                  title={r.title}
                  imageUrl={imageUrl}
                  ingredients={ingredientsList}
                  steps={stepsList}
                  open={isOpen}
                  onOpen={() => setExpandedKey(key)}
                  onClose={() => setExpandedKey(null)}
                  panelPlacement={isLastCol ? "overlay-right" : "push"}
                  minutes={typeof minutes === "number" ? minutes : null}
                  baseServings={baseServings}
                  isFavorite={!!fav}
                  onToggleFavorite={() => toggleFav(r)}
                  editHref={editHref}
                />
              </div>
            );
          })}
        </div>
      </section>

      {openModal ? (
        <RecipeModal
          recipe={openModal}
          onClose={() => setOpenModal(null)}
          isFavorite={!!favs[ridFor(openModal)]}
          onToggleFavorite={(r) => toggleFav(r as RecipeListItem)}
        />
      ) : null}

      {isSignedIn && showPantryPicker && (
        <PantryPicker
          open={showPantryPicker}
          onClose={() => setShowPantryPicker(false)}
          allItems={pantry}
          onSearch={runPantrySearch}
          busy={busySearch}
        />
      )}

      {isSignedIn && showWizard && (
        <CreateRecipeWizard
          open={showWizard}
          onClose={() => setShowWizard(false)}
          onSaved={() => {}}
          meUid={me}
        />
      )}

      {isSignedIn && showFavs && (
        <FavOverlay
          uid={me}
          onClose={() => setShowFavs(false)}
          onOpen={(id, source, recipeId) => openFavorite(id, source, recipeId)}
        />
      )}

      <SignInPrompt
        open={showSigninPrompt}
        onClose={() => setShowSigninPrompt(false)}
        onSigninHref="/auth/login"
      />

      <style jsx>{`
        .container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 20px;
        }
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .title {
          font-size: 28px;
          font-weight: 800;
          margin: 0;
        }
        .right {
          display: flex;
          gap: 10px;
        }
        .signinHint {
          font-size: 13px;
          color: var(--muted);
          background: var(--bg2);
          border: 1px dashed var(--border);
          padding: 6px 10px;
          border-radius: 10px;
        }

        .card {
          border: 1px solid var(--border);
          background: var(--card-bg);
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
        }
        .controls .row {
          display: grid;
          align-items: end;
          grid-template-columns: auto 1fr auto auto;
          gap: 14px;
          flex-wrap: wrap;
        }
        @media (max-width: 980px) {
          .controls .row {
            grid-template-columns: 1fr;
          }
        }
        .actionsRow {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        @media (max-width: 980px) {
          .actionsRow {
            justify-content: flex-start;
          }
        }

        .filters {
          display: grid;
          gap: 4px;
          align-items: end;
        }
        .select {
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 8px 10px;
          background: var(--bg2);
          color: var(--text);
        }
        .linkBtn {
          border: none;
          background: none;
          color: var(--text);
          text-decoration: underline;
          cursor: pointer;
          font-size: 13px;
        }

        .seg {
          display: inline-grid;
          grid-auto-flow: column;
          gap: 0;
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          background: var(--bg2);
        }
        .segBtn {
          padding: 10px 12px;
          font-weight: 700;
          border: 0;
          background: transparent;
          color: var(--text);
          cursor: pointer;
        }
        .segBtn + .segBtn {
          border-left: 1px solid var(--border);
        }
        .segBtn.active {
          background: var(--primary);
          color: var(--primary-contrast);
        }

        .wave-group {
          position: relative;
          max-width: 520px;
        }
        .wave-group .input {
          font-size: 16px;
          padding: 12px 10px 10px 6px;
          display: block;
          width: 100%;
          border: none;
          border-bottom: 1px solid var(--border);
          background: transparent;
          color: var(--text);
        }
        .wave-group .input:focus {
          outline: none;
        }
        .wave-group .label {
          color: var(--muted);
          font-size: 18px;
          position: absolute;
          pointer-events: none;
          left: 6px;
          top: 10px;
          display: flex;
        }
        .wave-group .label-char {
          transition: 0.2s ease all;
          transition-delay: calc(var(--index) * 0.05s);
        }
        .wave-group .input:focus ~ label .label-char,
        .wave-group .input:valid ~ label .label-char {
          transform: translateY(-20px);
          font-size: 14px;
          color: var(--primary);
        }
        .wave-group .bar {
          position: relative;
          display: block;
          width: 100%;
        }
        .wave-group .bar:before,
        .wave-group .bar:after {
          content: "";
          height: 2px;
          width: 0;
          bottom: 1px;
          position: absolute;
          background: var(--primary);
          transition: 0.2s ease all;
        }
        .wave-group .bar:before {
          left: 50%;
        }
        .wave-group .bar:after {
          right: 50%;
        }
        .wave-group .input:focus ~ .bar:before,
        .wave-group .input:focus ~ .bar:after {
          width: 50%;
        }

        .muted {
          color: var(--muted);
        }
        .small {
          font-size: 12px;
        }
        .error {
          margin-top: 8px;
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 13px;
        }

        .list {
          margin-top: 12px;
        }
        .gridCards {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          grid-auto-rows: minmax(440px, auto);
          gap: 22px;
          overflow: visible;
        }
        .cardWrap {
          position: relative;
          overflow: visible;
        }
        .cardWrap.span2 {
          grid-column: span 2;
        }

        @media (max-width: 980px) {
          .gridCards {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .gridCards {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
