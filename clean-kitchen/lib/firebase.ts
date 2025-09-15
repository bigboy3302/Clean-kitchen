// lib/firebase.ts
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider, AppCheck } from "firebase/app-check";
// (Optional – harmless if unused)
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

// App Check – client only
if (typeof window !== "undefined" && !global._appCheck) {
  const pinned = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN; // optional
  if (process.env.NODE_ENV !== "production") {
    // If you don't have a token yet, set to true so the SDK prints one in DevTools.
    // @ts-ignore
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = pinned || true;
  }

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY!;
  global._appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// (Optional – harmless if you don't use Functions in Option A)
export const functions = getFunctions(app);

export default app;
