// lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  collection,
  doc,
  type Firestore,
  setLogLevel,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;                      // e.g. clean-kitchen-de925.firebaseapp.com
  projectId: string;                       // e.g. clean-kitchen-de925
  storageBucket: string;                   // e.g. clean-kitchen-de925.firebasestorage.app
  appId: string;
  // messagingSenderId is optional
  messagingSenderId?: string;
};

const firebaseConfig: FirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  // Only include if you actually have it set
  ...(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
    ? { messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID }
    : {}),
};

// Validate only the required ones
const missing: string[] = [];
if (!firebaseConfig.apiKey) missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
if (!firebaseConfig.authDomain) missing.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
if (!firebaseConfig.projectId) missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
if (!firebaseConfig.storageBucket) missing.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
if (!firebaseConfig.appId) missing.push("NEXT_PUBLIC_FIREBASE_APP_ID");

if (missing.length) {
  console.error("Missing Firebase env vars:", missing);
  throw new Error("Missing required Firebase env vars");
}

declare global {
  // eslint-disable-next-line no-var
  var _firebaseApp: FirebaseApp | undefined;
  // eslint-disable-next-line no-var
  var _appCheckInited: boolean | undefined;
}

const app = globalThis._firebaseApp ?? (getApps().length ? getApp() : initializeApp(firebaseConfig));
globalThis._firebaseApp = app;

export const auth = getAuth(app);
export const db: Firestore = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});
export const storage = getStorage(app);
// If you use callable functions and care about region, you can set it here, e.g. getFunctions(app, "us-central1")
export const functions = getFunctions(app);

if (process.env.NODE_ENV === "development") {
  setLogLevel("error");
}

// ----- App Check (reCAPTCHA v3) is OPTIONAL -----
function initAppCheckOnce() {
  if (typeof window === "undefined") return;              // only in browser
  if (globalThis._appCheckInited) return;

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY;
  if (!siteKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[AppCheck] No reCAPTCHA v3 site key; skipping App Check.");
    }
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    // @ts-ignore debug token for local dev
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

// Initialize App Check after window load (avoids SSR/RSC pitfalls)
if (typeof window !== "undefined") {
  if (document.readyState === "complete") initAppCheckOnce();
  else window.addEventListener("load", () => initAppCheckOnce(), { once: true });
}

// Small helpers you already use elsewhere
export const col = (path: string) => collection(db, path);
export const userDoc = (uid: string) => doc(db, "users", uid);
export const userSubcol = (uid: string, name: string) => collection(doc(db, "users", uid), name);

export { app };
export default app;
