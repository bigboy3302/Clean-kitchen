
"use client";

import { useState } from "react";
import Image from "next/image";
import { uploadRecipeCover, uploadRecipeGalleryImage, deleteRecipeGalleryImage } from "../../lib/storageActions";

type Props = {
  uid: string;
  recipeId: string;
  initialCoverUrl?: string | null;
  onCoverSaved?: (url: string) => void;        
  onGalleryAdd?: (item: { id: string; url: string }) => void; 
  onGalleryRemove?: (id: string) => void;
  gallery?: { id: string; url: string }[];       
};

export default function RecipeImageUploader({
  uid,
  recipeId,
  initialCoverUrl,
  onCoverSaved,
  onGalleryAdd,
  onGalleryRemove,
  gallery = [],
}: Props) {
  const [coverPreview, setCoverPreview] = useState<string | null>(initialCoverUrl ?? null);
  const [busy, setBusy] = useState(false);

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadRecipeCover(uid, recipeId, file);
      setCoverPreview(url);
      onCoverSaved?.(url);
    } finally {
      setBusy(false);
      e.currentTarget.value = "";
    }
  }

  async function handleGalleryAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const item = await uploadRecipeGalleryImage(uid, recipeId, file);
      onGalleryAdd?.(item);
    } finally {
      setBusy(false);
      e.currentTarget.value = "";
    }
  }

  async function handleGalleryRemove(id: string) {
    setBusy(true);
    try {
      await deleteRecipeGalleryImage(uid, recipeId, id);
      onGalleryRemove?.(id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <label className="text-sm font-medium">Cover image</label>
        {coverPreview ? (
          <div className="relative h-48 w-full rounded-2xl overflow-hidden ring-1 ring-black/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverPreview} alt="cover" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="h-32 grid place-items-center rounded-2xl border border-dashed">
            <span className="text-sm opacity-70">No cover yet</span>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleCoverChange}
          disabled={busy}
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Gallery</label>
        <div className="flex flex-wrap gap-3">
          {gallery.map(g => (
            <div key={g.id} className="relative">
              <Image src={g.url} alt="gallery" width={112} height={112} className="rounded-xl object-cover" />
              <button
                className="absolute -top-2 -right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full"
                onClick={() => handleGalleryRemove(g.id)}
                disabled={busy}
                aria-label="Remove image"
              >
                ✕
              </button>
            </div>
          ))}
          <label className="h-28 w-28 grid place-items-center rounded-xl border border-dashed cursor-pointer">
            <span className="text-sm">Add</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleGalleryAdd}
              disabled={busy}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
