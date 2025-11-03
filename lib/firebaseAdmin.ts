import "server-only";

let _app: import("firebase-admin/app").App | null = null;
let _db: import("firebase-admin/firestore").Firestore | null = null;
let _auth: import("firebase-admin/auth").Auth | null = null;

function coercePrivateKey(raw?: string | null) {
  return (raw || '').replace(/\\n/g, '\n');
}

async function ensureApp() {
  if (_app) return _app;

  const { getApps, initializeApp, cert, applicationDefault } = await import("firebase-admin/app");

  const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (svcJson) {
    const parsed = JSON.parse(svcJson);
    if (typeof parsed.private_key === 'string') parsed.private_key = coercePrivateKey(parsed.private_key);
    _app = getApps().length ? getApps()[0]! : initializeApp({ credential: cert(parsed) });
    return _app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKeyRaw) {
    _app = getApps().length
      ? getApps()[0]!
      : initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: coercePrivateKey(privateKeyRaw),
          }),
        });
    return _app;
  }

  _app = getApps().length ? getApps()[0]! : initializeApp({ credential: applicationDefault() });
  return _app;
}

export async function getAdminDb() {
  if (_db) return _db;
  const { getFirestore } = await import("firebase-admin/firestore");
  const app = await ensureApp();
  _db = getFirestore(app);
  return _db;
}

export async function getAdminAuth() {
  if (_auth) return _auth;
  const { getAuth } = await import("firebase-admin/auth");
  const app = await ensureApp();
  _auth = getAuth(app);
  return _auth;
}

export async function getAdminApp() {
  return ensureApp();
}
