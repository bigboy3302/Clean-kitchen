// lib/firebase/config.ts
import type { FirebaseOptions } from "firebase/app";

function readFromNextPublic(): Partial<FirebaseOptions> {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

function readFromFirebaseHosting(): Partial<FirebaseOptions> {
  // Firebase App Hosting injects this JSON string (you can see it in your logs)
  const raw = process.env.FIREBASE_WEBAPP_CONFIG;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return {
      apiKey: parsed.apiKey,
      authDomain: parsed.authDomain,
      projectId: parsed.projectId,
      storageBucket: parsed.storageBucket,
      messagingSenderId: parsed.messagingSenderId,
      appId: parsed.appId,
    };
  } catch {
    // Don’t crash builds on malformed env; just ignore
    return {};
  }
}

/**
 * Returns a complete Firebase web config if available, otherwise null.
 * NEXT_PUBLIC_* wins over FIREBASE_WEBAPP_CONFIG when both exist.
 */
export function getFirebaseClientConfig(): FirebaseOptions | null {
  const fromNext = readFromNextPublic();
  const fromHosting = readFromFirebaseHosting();
  const cfg: Partial<FirebaseOptions> = { ...fromHosting, ...fromNext }; // prefer NEXT_PUBLIC_*

  const needed = [
    cfg.apiKey,
    cfg.authDomain,
    cfg.projectId,
    cfg.storageBucket,
    cfg.messagingSenderId,
    cfg.appId,
  ];

  if (needed.some((v) => !v)) return null;
  return cfg as FirebaseOptions;
}
