"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { addDoc, collection, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref as sref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebas1e";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import type { Ingredient } from "@/components/recipes/types";

const capFirst = (s: string) => s.replace(/^\p{L}/u, (m) => m.toUpperCase());

type Row = {
  name: string;
  qty: string;
  unit: "g" | "kg" | "ml" | "l" | "pcs" | "tbsp" | "tsp" | "cup";
};

type WizardStep = 0 | 1 | 2 | 3;

export default function CreateRecipeWizard({
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
  const [timeMinutes, setTimeMinutes] = useState("");
  const [servings, setServings] = useState("");
  const [category, setCategory] = useState("");
  const [area, setArea] = useState("");
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
    setTimeMinutes("");
    setServings("");
    setCategory("");
    setArea("");
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

    if (!timeMinutes.trim() || Number(timeMinutes) <= 0) {
      setErr("Please enter the cooking time in minutes.");
      setStep(0);
      return;
    }

    if (!servings.trim() || Number(servings) <= 0) {
      setErr("Please enter the number of servings.");
      setStep(0);
      return;
    }

    if (!category.trim()) {
      setErr("Please enter a category.");
      setStep(0);
      return;
    }

    if (!area.trim()) {
      setErr("Please enter an area.");
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
      timeMinutes: Number(timeMinutes),
      servings: Number(servings),
      category: category.trim(),
      area: area.trim(),
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
            <div className="metaGrid">
              <Input
                label="Servings"
                type="number"
                min={1}
                value={servings}
                onChange={(event) => setServings(event.currentTarget.value)}
                placeholder="2"
              />
              <Input
                label="Time (minutes)"
                type="number"
                min={1}
                value={timeMinutes}
                onChange={(event) => setTimeMinutes(event.currentTarget.value)}
                placeholder="30"
              />
              <Input
                label="Category"
                value={category}
                onChange={(event) => setCategory(event.currentTarget.value)}
                placeholder="Dinner"
              />
              <Input
                label="Area"
                value={area}
                onChange={(event) => setArea(event.currentTarget.value)}
                placeholder="Italian"
              />
            </div>
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
        .metaGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
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
        @media (max-width: 640px) {
          .metaGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
