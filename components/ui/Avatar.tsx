"use client";

import Image from "next/image";
import { useState } from "react";
import { DEFAULT_AVATAR } from "@/lib/constants";

type Props = {
  src?: string | null;
  alt?: string;
  size?: number;
  name?: string | null;
  className?: string;
};

export default function Avatar({ src, alt = "avatar", size = 100, name, className }: Props) {
  const [failed, setFailed] = useState(false);
  const imageSrc = !failed && src ? src : DEFAULT_AVATAR;
  void name;
  return (
    <>
      <span
        className={`ui-avatar ${className || ""}`}
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
        aria-label={alt}
      >
        <Image
          src={imageSrc}
          alt={alt}
          width={size}
          height={size}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setFailed(true)}
        />
      </span>

      <style jsx>{`
        .ui-avatar {
          display: inline-block;
          border-radius: 999px;
          overflow: hidden;
          background: #000;
          border: 1px solid var(--border);
          line-height: 0;
        }
        .ui-avatar :global(img) {
          display: block;
          border-radius: 999px;
        }
      `}</style>
    </>
  );
}
