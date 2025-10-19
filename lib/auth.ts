"use client";

import { onAuthStateChanged, User } from "firebase/auth";
import { create } from "zustand";
import { auth } from "@/lib/firebase/firebase";

export type AuthState = {
  user: User | null | undefined;
  setUser: (u: User | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: undefined,
  setUser: (u) => set({ user: u }),
}));

let initialized = false;
export const initAuthListener = () => {
  if (initialized) return;
  initialized = true;
  onAuthStateChanged(auth, (u) => {
    useAuthStore.getState().setUser(u ?? null);
  });
};
