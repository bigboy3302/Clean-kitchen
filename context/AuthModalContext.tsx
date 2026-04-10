"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AuthModalMode = "login" | "register";

type AuthModalContextValue = {
  isOpen: boolean;
  mode: AuthModalMode;
  redirectTo: string | null;
  openLogin: (redirectTo?: string | null) => void;
  openRegister: (redirectTo?: string | null) => void;
  setMode: (mode: AuthModalMode) => void;
  close: () => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthModalMode>("login");
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  const openLogin = useCallback((next?: string | null) => {
    setMode("login");
    setRedirectTo(next ?? null);
    setIsOpen(true);
  }, []);

  const openRegister = useCallback((next?: string | null) => {
    setMode("register");
    setRedirectTo(next ?? null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo<AuthModalContextValue>(
    () => ({
      isOpen,
      mode,
      redirectTo,
      openLogin,
      openRegister,
      setMode,
      close,
    }),
    [close, isOpen, mode, openLogin, openRegister, redirectTo]
  );

  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>;
}

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error("useAuthModal must be used inside AuthModalProvider");
  }
  return context;
}
