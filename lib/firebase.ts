// lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider /*, ReCaptchaEnterpriseProvider */ } from "firebase/app-check";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!, // your-project-id.appspot.com
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

if (Object.values(firebaseConfig).some((v) => !v)) {
  console.error("Missing Firebase env vars:", firebaseConfig);
  throw new Error("Missing Firebase env vars (.env.local)");
}

// cache across HMR/SSR
declare global {
  // eslint-disable-next-line no-var
  var _firebaseApp: FirebaseApp | undefined;
  // eslint-disable-next-line no-var
  var _appCheckInited: boolean | undefined;
}

const app =
  globalThis._firebaseApp ?? (getApps().length ? getApp() : initializeApp(firebaseConfig));
globalThis._firebaseApp = app;

function initAppCheckOnce() {
  if (typeof window === "undefined") return;         // never during SSR
  if (globalThis._appCheckInited) return;            // already inited
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY;

  if (!siteKey) {
    console.warn("[AppCheck] No reCAPTCHA v3 site key found; skipping App Check init.");
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    // Local dev: enable debug token so App Check won’t block requests
    // @ts-ignore
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN || true;
  }

  try {
    // If you used an **Enterprise** key, switch to ReCaptchaEnterpriseProvider
    // const provider = new ReCaptchaEnterpriseProvider(siteKey);
    const provider = new ReCaptchaV3Provider(siteKey);

    initializeAppCheck(app, {
      provider,
      isTokenAutoRefreshEnabled: true,
    });

    globalThis._appCheckInited = true;
    console.log("[AppCheck] initialized");
  } catch (e) {
    console.warn("[AppCheck] init failed:", e);
  }
}

// Wait for window load just to be extra-safe with the reCAPTCHA loader.
if (typeof window !== "undefined") {
  if (document.readyState === "complete") initAppCheckOnce();
  else window.addEventListener("load", () => initAppCheckOnce(), { once: true });
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); // uses config.storageBucket
export const functions = getFunctions(app);

// allow both `import app from` and `import { app } from`
export { app };
export default app;
