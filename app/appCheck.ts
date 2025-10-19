
"use client";

import app from "@/lib/firebas1e";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

let started = false;

type AppCheckGlobal = typeof self & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean };

export function initAppCheck() {
  if (started) return;
  started = true;

  const dbg = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN;
  if (process.env.NODE_ENV !== "production") {
    (self as AppCheckGlobal).FIREBASE_APPCHECK_DEBUG_TOKEN = dbg || true;
    if (dbg) console.log("[AppCheck] Using pinned debug token from .env");
  }

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY!;
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
