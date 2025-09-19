import { useState } from "react";
import { hardDeleteRecipe } from "@/lib/HardDelete";

export function RecipeDeleteButton({ recipeId }: { recipeId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onDelete() {
    setErr(null);
    setBusy(true);
    try {
      await hardDeleteRecipe(recipeId);
      // optionally: close modal or toast
    } catch (e: any) {
      setErr(e?.message || "Failed to delete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="btn danger" onClick={onDelete} disabled={busy}>
        {busy ? "Deleting…" : "Delete recipe"}
      </button>
      {err && <p className="error">{err}</p>}
    </div>
  );
}
