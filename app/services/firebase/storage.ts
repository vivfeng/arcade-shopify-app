import { ref, uploadBytes, type StorageReference } from "firebase/storage";
import { signInWithCustomToken } from "firebase/auth";
import { getFirebaseAuth, getFirebaseStorage } from "./firebase";

export const inspirationImageRef = (userId: string): StorageReference =>
  ref(
    getFirebaseStorage(),
    `composer/inspiration_images/${userId}/${Math.random()}_`,
  );

async function ensureSignedInAs(
  expectedUid: string,
  customToken: string,
): Promise<void> {
  const auth = getFirebaseAuth();

  if (auth.currentUser?.uid === expectedUid) return;

  await auth.authStateReady();
  if (auth.currentUser?.uid === expectedUid) return;

  await signInWithCustomToken(auth, customToken);
}

export async function uploadInspirationImage(
  file: File,
  userId: string,
  customToken: string,
): Promise<string> {
  await ensureSignedInAs(userId, customToken);

  const result = await uploadBytes(inspirationImageRef(userId), file, {
    contentType: file.type || "image/jpeg",
    cacheControl: "public,max-age=31536000",
  });

  return `https://storage.googleapis.com/${result.metadata.bucket}/${result.metadata.fullPath}`;
}
