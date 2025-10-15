// Client-only Firebase (Web SDK)
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  // senderId / measurementId optional
};

let _app: FirebaseApp;
let _auth: Auth;
let _db: Firestore;
let _storage: FirebaseStorage;

export function getFirebase() {
  _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  _auth = _auth ?? getAuth(_app);
  _db = _db ?? getFirestore(_app);
  _storage = _storage ?? getStorage(_app);
  return { app: _app, auth: _auth, db: _db, storage: _storage };
}
