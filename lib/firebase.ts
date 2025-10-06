// lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, doc, type Firestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

/** ---- Config from env ---- */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!, // keep YOUR working bucket
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// Fail fast if something critical is missing
if (Object.values(firebaseConfig).some((v) => !v)) {
  // Print which ones are missing for easier debugging
  console.error("Missing Firebase env vars:", firebaseConfig);
  throw new Error("Missing Firebase env vars (.env.local)");
}

/** ---- Guard globals so Fast Refresh doesn’t re-init ---- */
declare global {
  // eslint-disable-next-line no-var
  var _firebaseApp: FirebaseApp | undefined;
  // eslint-disable-next-line no-var
  var _appCheckInited: boolean | undefined;
}

/** ---- Initialize core app (once) ---- */
const app = globalThis._firebaseApp ?? (getApps().length ? getApp() : initializeApp(firebaseConfig));
globalThis._firebaseApp = app;

/** ---- Export client SDKs ---- */
export const auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

/** ---- App Check (browser only, once) ---- */
function initAppCheckOnce() {
  if (typeof window === "undefined") return;
  if (globalThis._appCheckInited) return;

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY;
  if (!siteKey) {
    // App still works without App Check in dev
    if (process.env.NODE_ENV !== "production") {
      console.warn("[AppCheck] No reCAPTCHA v3 site key; skipping.");
    }
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    // Enable debug token in dev so you can test without real challenges
    // @ts-ignore
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN || true;
  }

  try {
    const provider = new ReCaptchaV3Provider(siteKey);
    initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
    globalThis._appCheckInited = true;
    if (process.env.NODE_ENV !== "production") console.log("[AppCheck] initialized");
  } catch (e) {
    console.warn("[AppCheck] init failed:", e);
  }
}

// Kick off App Check after window load (avoids SSR)
if (typeof window !== "undefined") {
  if (document.readyState === "complete") initAppCheckOnce();
  else window.addEventListener("load", () => initAppCheckOnce(), { once: true });
}

/** ---- Tiny helpers to avoid common collection() mistakes ---- */
// Use these so you always pass a Firestore/DocumentReference first.
export const col = (path: string) => collection(db, path);
export const userDoc = (uid: string) => doc(db, "users", uid);
export const userSubcol = (uid: string, name: string) => collection(doc(db, "users", uid), name);

export { app };
export default app;
