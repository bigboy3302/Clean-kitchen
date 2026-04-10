"use client";

import { useEffect } from "react";
import AuthDialog from "@/components/auth/AuthDialog";
import { useAuthModal } from "@/context/AuthModalContext";

export default function AuthModal() {
  const { close, isOpen, mode, redirectTo, setMode } = useAuthModal();

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AuthDialog
      mode={mode}
      onModeChange={setMode}
      onClose={close}
      redirectTo={redirectTo}
    />
  );
}
