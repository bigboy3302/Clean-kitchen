"use client";

import { useEffect } from "react";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import app from "@/lib/firebase";

export default function FirebaseAppCheck() {
  useEffect(() => {

    // @ts-ignore
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN || undefined;

    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY!),
        isTokenAutoRefreshEnabled: true,
      });
    } catch {
      // ignore "already initialized" during fast refresh
    }
  }, []);

  return null;
}
