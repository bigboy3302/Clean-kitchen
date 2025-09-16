import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider, AppCheck } from "firebase/app-check";
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
  // eslint-disable-next-line no-var
  var _firebaseApp: FirebaseApp | undefined;
  // eslint-disable-next-line no-var
  var _appCheck: AppCheck | undefined;
}

const app = global._firebaseApp ?? (getApps().length ? getApp() : initializeApp(firebaseConfig));
global._firebaseApp = app;

function ensureAppCheckClient() {
  if (typeof window === "undefined") return;
  if (global._appCheck) return;

  const pinned = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN;
  if (process.env.NODE_ENV !== "production") {
    // @ts-ignore
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = pinned || true;
    console.log("[AppCheck] Debug token:", pinned ? "(using pinned token from .env)" : "(will auto-generate; check console once)");
  }

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY!;
  try {
    global._appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    console.log("[AppCheck] Initialized");
  } catch (e) {
    console.warn("[AppCheck] Initialize failed/skipped:", e);
  }
}
ensureAppCheckClient();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app, `gs://${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}`); // explicit bucket
export const functions = getFunctions(app);
export default app;
