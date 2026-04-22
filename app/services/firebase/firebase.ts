import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import { clientEnv } from "../../lib/env/client.env";

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;
let _auth: Auth | null = null;

function getApp(): FirebaseApp {
  if (_app) return _app;

  const existing = getApps();
  if (existing.length > 0) {
    _app = existing[0];
    return _app;
  }

  _app = initializeApp({
    apiKey: clientEnv.VITE_FIREBASE_WEB_API_KEY,
    appId: clientEnv.VITE_FIREBASE_APP_ID,
    authDomain: clientEnv.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: clientEnv.VITE_FIREBASE_DATABASE_URL,
    projectId: clientEnv.VITE_FIREBASE_PROJECT_ID,
    storageBucket: clientEnv.VITE_FIREBASE_STORAGE_BUCKET,
  });

  return _app;
}

export function getDb(): Firestore {
  if (_db) return _db;
  _db = getFirestore(getApp());
  return _db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (_storage) return _storage;
  _storage = getStorage(getApp());
  return _storage;
}

export function getFirebaseAuth(): Auth {
  if (_auth) return _auth;

  if (typeof window === "undefined") {
    throw new Error(
      "[firebase] getFirebaseAuth() called on the server — Auth is browser-only",
    );
  }

  const app = getApp();

  try {
    _auth = initializeAuth(app, {
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
      ],
    });
  } catch {
    _auth = getAuth(app);
  }

  return _auth;
}
