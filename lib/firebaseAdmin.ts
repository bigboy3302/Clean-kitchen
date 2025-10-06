// lib/firebaseAdmin.ts
import { App, getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function die(msg: string): never {
  throw new Error(`[firebaseAdmin] ${msg}`);
}

function initApp(): App {
  // 1) Single ENV that holds the full JSON (recommended on Vercel)
  // FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...", ... }'
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed.private_key === "string") {
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
      }
      if (!parsed.project_id) die('FIREBASE_SERVICE_ACCOUNT JSON missing "project_id".');
      return initializeApp({ credential: cert(parsed) });
    } catch (e: any) {
      die(`FIREBASE_SERVICE_ACCOUNT is not valid JSON: ${e?.message || e}`);
    }
  }

  // 2) Three separate ENVs (what you started with)
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKeyRaw) {
    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  // 3) Application Default Credentials (ADC) – works on GCP / Firebase Hosting / local if GOOGLE_APPLICATION_CREDENTIALS is set
  try {
    return initializeApp({ credential: applicationDefault() });
  } catch {
    // If we got here, nothing was configured correctly
    const missing = [
      projectId ? null : "FIREBASE_PROJECT_ID",
      clientEmail ? null : "FIREBASE_CLIENT_EMAIL",
      privateKeyRaw ? null : "FIREBASE_PRIVATE_KEY",
      json ? null : "FIREBASE_SERVICE_ACCOUNT (JSON)",
      "GOOGLE_APPLICATION_CREDENTIALS (for ADC)",
    ]
      .filter(Boolean)
      .join(", ");
    die(
      `No valid Firebase Admin credentials. Provide FIREBASE_SERVICE_ACCOUNT (JSON) or the three vars, or set ADC. Missing/unused: ${missing}`
    );
  }
}

const app = getApps().length ? getApps()[0]! : initApp();
export const adminDb = getFirestore(app);
