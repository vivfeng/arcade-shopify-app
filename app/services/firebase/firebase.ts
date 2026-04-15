import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { clientEnv } from "../../lib/env/client.env";

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;

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
  });

  return _app;
}

export function getDb(): Firestore {
  if (_db) return _db;
  _db = getFirestore(getApp());
  return _db;
}
