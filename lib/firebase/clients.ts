"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { isSupported, getAnalytics } from "firebase/analytics";
import { getFirebaseClientConfig } from "./config";

let _app: FirebaseApp | null = null;

export function getClientApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;

  const cfg = getFirebaseClientConfig();
  if (!cfg) {
    console.warn("Firebase web config not available at runtime.");
    return null;
  }

  _app = getApps()[0] ?? initializeApp(cfg);

  isSupported()
    .then((ok) => {
      if (ok) getAnalytics(_app!);
    })
    .catch(() => {});

  return _app;
}
