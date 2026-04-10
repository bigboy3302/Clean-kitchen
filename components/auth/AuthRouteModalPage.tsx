"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthModal } from "@/context/AuthModalContext";

type Props = {
  mode: "login" | "register";
};

export default function AuthRouteModalPage({ mode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { close, isOpen, openLogin, openRegister } = useAuthModal();
  const mountedRef = useRef(false);

  useEffect(() => {
    const next = searchParams.get("next");
    mountedRef.current = true;
    if (mode === "login") openLogin(next);
    else openRegister(next);

    return () => {
      mountedRef.current = false;
      close();
    };
  }, [close, mode, openLogin, openRegister, searchParams]);

  useEffect(() => {
    if (!mountedRef.current || isOpen) return;
    router.replace(searchParams.get("next") || "/");
  }, [isOpen, router, searchParams]);

  return (
    <main className="authRouteCanvas" aria-hidden>
      <div className="authRouteGlow authRouteGlow--one" />
      <div className="authRouteGlow authRouteGlow--two" />
      <style jsx>{`
        .authRouteCanvas {
          min-height: 100dvh;
          background:
            radial-gradient(70% 60% at 10% 10%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 60%),
            radial-gradient(60% 50% at 90% 90%, color-mix(in oklab, var(--ring) 18%, transparent), transparent 70%),
            linear-gradient(180deg, color-mix(in oklab, var(--bg) 94%, var(--primary) 6%), var(--bg));
        }
        .authRouteGlow {
          position: fixed;
          border-radius: 999px;
          filter: blur(80px);
          opacity: 0.5;
        }
        .authRouteGlow--one {
          top: 8%;
          left: 6%;
          width: 32vw;
          height: 32vw;
          background: color-mix(in oklab, var(--primary) 26%, transparent);
        }
        .authRouteGlow--two {
          right: 8%;
          bottom: 10%;
          width: 28vw;
          height: 28vw;
          background: color-mix(in oklab, var(--ring) 24%, transparent);
        }
      `}</style>
    </main>
  );
}
