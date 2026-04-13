import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Firebase client config — these are public keys (not secrets).
// Arcade AI staging project.
const firebaseConfig = {
  apiKey: "AIzaSyAtApiR30J7B6fWeHbV7YalZ1DAGwJy9tI",
  appId: "1:990004546669:web:14045a95a78f7eb0634364",
  authDomain: "arcade-ai-staging.firebaseapp.com",
  databaseURL: "https://arcade-ai-staging.firebaseio.com",
  projectId: "arcade-ai-staging",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
