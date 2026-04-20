import admin from "firebase-admin";
import type { ServiceAccount } from "firebase-admin";
import db from "../../db.server";
import { env } from "../../lib/env/env.server";

const FIREBASE_WEB_API_KEY = env.VITE_FIREBASE_WEB_API_KEY;
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

function getFirebaseAdmin(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const serviceAccount = JSON.parse(
    env.FIREBASE_SERVICE_ACCOUNT_KEY,
  ) as ServiceAccount;

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

interface CachedToken {
  idToken: string;
  expiryMs: number;
}

const tokenCache = new Map<string, CachedToken>();

export function evictTokenCache(arcadeAccountId: string): void {
  tokenCache.delete(arcadeAccountId);
}

export const LINK_CONFLICT_MESSAGE =
  "You have already connected another account to this Shopify store. Please reach out for help at cs@arcade.ai.";

export class LinkShopConflictError extends Error {
  readonly code = "LINK_SHOP_CONFLICT" as const;
  constructor() {
    super(LINK_CONFLICT_MESSAGE);
    this.name = "LinkShopConflictError";
  }
}

export async function getArcadeAccountIdForShop(
  shopDomain: string,
): Promise<string | null> {
  const shop = await db.shop.findUnique({
    where: { domain: shopDomain },
    select: { arcadeAccountId: true },
  });
  return shop?.arcadeAccountId ?? null;
}

export async function requireArcadeAccountIdForApi(
  shopDomain: string,
): Promise<string> {
  const id = await getArcadeAccountIdForShop(shopDomain);
  if (!id) {
    throw new Error(
      "[ArcadeAuth] This shop has no linked Arcade account. Complete Connect Arcade first.",
    );
  }
  return id;
}

/**
 * First-time link: sets Firebase UID on the shop after client sign-in / sign-up.
 * Re-linking a different account is not allowed (CS must intervene).
 */
export async function linkShopToArcadeAccount(params: {
  shopDomain: string;
  idToken: string;
}): Promise<void> {
  const decoded = await getFirebaseAdmin().auth().verifyIdToken(params.idToken);
  const uid = decoded.uid;

  const shop = await db.shop.findUnique({
    where: { domain: params.shopDomain },
    select: { id: true, arcadeAccountId: true },
  });

  if (!shop) {
    throw new Error(`[ArcadeAuth] No Shop record for ${params.shopDomain}`);
  }

  if (shop.arcadeAccountId && shop.arcadeAccountId !== uid) {
    throw new LinkShopConflictError();
  }

  if (shop.arcadeAccountId === uid) {
    return;
  }

  await db.shop.update({
    where: { id: shop.id },
    data: {
      arcadeAccountId: uid,
      arcadeLinkedAt: new Date(),
    },
  });
}

interface AdminGraphql {
  (query: string, options?: { variables?: Record<string, unknown> }): Promise<Response>;
}

export async function ensureShopRecord(session: {
  shop: string;
}): Promise<{ id: string; arcadeAccountId: string | null }> {
  const existing = await db.shop.findUnique({
    where: { domain: session.shop },
    select: { id: true, arcadeAccountId: true },
  });

  if (existing) return existing;

  return db.shop.create({
    data: {
      domain: session.shop,
      name: session.shop.replace(".myshopify.com", ""),
    },
    select: { id: true, arcadeAccountId: true },
  });
}

const SHOP_EMAIL_QUERY = `#graphql
  query shopEmail {
    shop { email }
  }
`;

async function fetchShopEmail(graphql: AdminGraphql): Promise<string | null> {
  try {
    const res = await graphql(SHOP_EMAIL_QUERY);
    const { data: gqlData } = await res.json();
    return gqlData?.shop?.email || null;
  } catch (err) {
    console.warn("[ArcadeAuth] Failed to fetch shop email from Shopify:", err);
    return null;
  }
}

async function findFirebaseUserByEmail(
  auth: admin.auth.Auth,
  email: string,
): Promise<string | null> {
  try {
    const user = await auth.getUserByEmail(email);
    return user.uid;
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "auth/user-not-found") return null;
    throw err;
  }
}

export async function ensureArcadePrincipal(
  shopId: string,
  shopDomain: string,
  graphql: AdminGraphql,
): Promise<string> {
  const shop = await db.shop.findUniqueOrThrow({
    where: { id: shopId },
    select: { arcadeAccountId: true },
  });

  if (shop.arcadeAccountId) return shop.arcadeAccountId;

  const firebaseApp = getFirebaseAdmin();
  const auth = firebaseApp.auth();

  const normalizedDomain = shopDomain.replace(".myshopify.com", "");
  const syntheticEmail = `${normalizedDomain}@shops.arcade.ai`;

  let uid: string | null = null;

  // 1. Try real shop email → links to existing Arcade accounts
  const shopEmail = await fetchShopEmail(graphql);
  if (shopEmail) {
    uid = await findFirebaseUserByEmail(auth, shopEmail);
    if (uid) {
      console.log(
        `[ArcadeAuth] Linked existing Arcade account ${uid} via shop email ${shopEmail}`,
      );
    }
  }

  // 2. Try synthetic email → previously provisioned by this app
  if (!uid) {
    uid = await findFirebaseUserByEmail(auth, syntheticEmail);
    if (uid) {
      console.log(
        `[ArcadeAuth] Found existing Firebase user ${uid} for ${syntheticEmail}`,
      );
    }
  }

  // 3. Create new Firebase user with synthetic email
  if (!uid) {
    const created = await auth.createUser({
      email: syntheticEmail,
      displayName: normalizedDomain,
    });
    uid = created.uid;
    console.log(
      `[ArcadeAuth] Created new Firebase user ${uid} for ${syntheticEmail}`,
    );
  }

  await db.shop.update({
    where: { id: shopId },
    data: { arcadeAccountId: uid },
  });

  console.log(
    `[ArcadeAuth] Provisioned Arcade principal for ${shopDomain} (uid=${uid})`,
  );

  return uid;
}

export async function createClientAuthToken(
  arcadeAccountId: string,
): Promise<string> {
  const firebaseApp = getFirebaseAdmin();
  return firebaseApp.auth().createCustomToken(arcadeAccountId);
}

export async function getValidArcadeToken(
  arcadeAccountId: string,
  forceRefresh = false,
): Promise<string> {
  if (!forceRefresh) {
    const cached = tokenCache.get(arcadeAccountId);
    if (cached && cached.expiryMs - Date.now() > TOKEN_EXPIRY_BUFFER_MS) {
      return cached.idToken;
    }
  }

  const firebaseApp = getFirebaseAdmin();
  const customToken = await firebaseApp
    .auth()
    .createCustomToken(arcadeAccountId);

  const { idToken, expiresIn } = await exchangeCustomToken(customToken);

  tokenCache.set(arcadeAccountId, {
    idToken,
    expiryMs: Date.now() + expiresIn * 1000,
  });

  return idToken;
}

export async function resolveArcadeAccountId(
  shopDomain: string,
  graphql: AdminGraphql,
): Promise<string> {
  const shop = await db.shop.findUnique({
    where: { domain: shopDomain },
    select: { id: true, arcadeAccountId: true },
  });

  if (!shop) {
    throw new Error(
      `[ArcadeAuth] No Shop record for ${shopDomain} — ensureShopRecord must run first`,
    );
  }

  if (shop.arcadeAccountId) return shop.arcadeAccountId;

  return ensureArcadePrincipal(shop.id, shopDomain, graphql);
}

interface ExchangeResult {
  idToken: string;
  expiresIn: number;
}

async function exchangeCustomToken(
  customToken: string,
): Promise<ExchangeResult> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `[ArcadeAuth] signInWithCustomToken failed (${res.status}): ${body}`,
    );
  }

  const data = await res.json();
  return {
    idToken: data.idToken,
    expiresIn: Number(data.expiresIn) || 3600,
  };
}
