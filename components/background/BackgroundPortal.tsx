"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import MovingBackground from "./MovingBackground";

export default function BackgroundPortal() {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let el = document.getElementById("bg-root") as HTMLElement | null;

    if (!el) {
      el = document.createElement("div");
      el.id = "bg-root";
      document.body.prepend(el);
    }

    setHost(el);
  }, []);

  if (!host) return null;
  return createPortal(<MovingBackground />, host);
}
