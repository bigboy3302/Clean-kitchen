"use client";

export default function Avatar({
  src, alt, size = 40,
}: { src?: string | null; alt?: string; size?: number }) {
  const dimension = `${size}px`;
  return (
    <img
      src={src || "/default-avatar.png"}
      alt={alt || "avatar"}
      style={{ width: dimension, height: dimension }}
      className="rounded-full border object-cover"
    />
  );
}
