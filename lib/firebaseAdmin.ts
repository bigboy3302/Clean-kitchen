// lib/firebaseAdmin.ts
import 'server-only';

let _db: import('firebase-admin/firestore').Firestore | null = null;

function coercePrivateKey(raw?: string | null) {
  return (raw || '').replace(/\\n/g, '\n');
}

async function init() {
  if (_db) return _db;

  const { getApps, initializeApp, cert, applicationDefault } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  // 1) Full JSON in FIREBASE_SERVICE_ACCOUNT (recommended)
  const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (svcJson) {
    const parsed = JSON.parse(svcJson);
    if (typeof parsed.private_key === 'string') parsed.private_key = coercePrivateKey(parsed.private_key);
    const app = getApps().length ? getApps()[0]! : initializeApp({ credential: cert(parsed) });
    _db = getFirestore(app);
    return _db;
  }

  // 2) Separate vars
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKeyRaw) {
    const app = getApps().length
      ? getApps()[0]!
      : initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: coercePrivateKey(privateKeyRaw),
          }),
        });
    _db = getFirestore(app);
    return _db;
  }

  // 3) ADC fallback
  const app = getApps().length ? getApps()[0]! : initializeApp({ credential: applicationDefault() });
  _db = getFirestore(app);
  return _db;
}

export async function getAdminDb() {
  return await init();
}
