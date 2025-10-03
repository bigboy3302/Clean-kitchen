import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

if (Object.values(firebaseConfig).some((v) => !v)) {
  console.error("Missing Firebase env vars:", firebaseConfig);
  throw new Error("Missing Firebase env vars (.env.local)");
}

declare global {
  var _firebaseApp: FirebaseApp | undefined;
  var _appCheckInited: boolean | undefined;
}

const app =
  globalThis._firebaseApp ?? (getApps().length ? getApp() : initializeApp(firebaseConfig));
globalThis._firebaseApp = app;

function initAppCheckOnce() {
  if (typeof window === "undefined") return;
  if (globalThis._appCheckInited) return;
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY;

  if (!siteKey) {
    console.warn("[AppCheck] No reCAPTCHA v3 site key found; skipping App Check init.");
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    // @ts-ignore
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN || true;
  }

  try {
    const provider = new ReCaptchaV3Provider(siteKey);
    initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
    globalThis._appCheckInited = true;
    console.log("[AppCheck] initialized");
  } catch (e) {
    console.warn("[AppCheck] init failed:", e);
  }
}

if (typeof window !== "undefined") {
  if (document.readyState === "complete") initAppCheckOnce();
  else window.addEventListener("load", () => initAppCheckOnce(), { once: true });
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

export { app };
export default app;
