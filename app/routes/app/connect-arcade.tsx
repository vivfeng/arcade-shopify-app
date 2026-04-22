import {
  data,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  useFetcher,
  useLoaderData,
} from "react-router";
import { useCallback, useState } from "react";
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Button,
  Text,
  Banner,
  BlockStack,
} from "@shopify/polaris";
import { authenticate } from "../../shopify.server";
import { env } from "../../lib/env/env.server";
import {
  ensureShopRecord,
  linkShopToArcadeAccount,
  LinkShopConflictError,
  LINK_CONFLICT_MESSAGE,
} from "../../services/arcade/arcadeAuth.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await ensureShopRecord(session);

  return data({
    firebase: {
      apiKey: env.VITE_FIREBASE_WEB_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    },
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await ensureShopRecord(session);

  const formData = await request.formData();
  const idToken = formData.get("idToken");
  if (typeof idToken !== "string" || idToken.length < 10) {
    return data({ error: "Missing or invalid sign-in token." }, { status: 400 });
  }

  try {
    await linkShopToArcadeAccount({
      shopDomain: session.shop,
      idToken,
    });
  } catch (e) {
    if (e instanceof LinkShopConflictError) {
      return data({ error: LINK_CONFLICT_MESSAGE }, { status: 409 });
    }
    throw e;
  }

  return redirect("/app");
};

type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
};

async function mintIdToken(
  firebase: FirebaseWebConfig,
  email: string,
  password: string,
  mode: "signIn" | "signUp",
): Promise<string> {
  const { initializeApp, getApps, getApp } = await import("firebase/app");
  const {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
  } = await import("firebase/auth");

  const app =
    getApps().length === 0 ? initializeApp(firebase) : getApp();
  const auth = getAuth(app);
  const credential =
    mode === "signIn"
      ? await signInWithEmailAndPassword(auth, email, password)
      : await createUserWithEmailAndPassword(auth, email, password);
  return credential.user.getIdToken();
}

export default function ConnectArcadeRoute() {
  const { firebase } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ error?: string }>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busyMode, setBusyMode] = useState<"signIn" | "signUp" | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  const submitToken = useCallback(
    (idToken: string) => {
      const fd = new FormData();
      fd.set("idToken", idToken);
      fetcher.submit(fd, { method: "post" });
    },
    [fetcher],
  );

  const handleAuth = useCallback(
    async (mode: "signIn" | "signUp") => {
      setClientError(null);
      setBusyMode(mode);
      try {
        const token = await mintIdToken(firebase, email.trim(), password, mode);
        submitToken(token);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Sign-in failed. Try again.";
        setClientError(message);
      } finally {
        setBusyMode(null);
      }
    },
    [email, password, firebase, submitToken],
  );

  const serverError =
    fetcher.data && "error" in fetcher.data ? fetcher.data.error : null;

  return (
    <Page title="Connect your Arcade account">
      <BlockStack gap="400">
        {(clientError || serverError) && (
          <Banner tone="critical" title="Could not connect">
            <p>{serverError ?? clientError}</p>
          </Banner>
        )}
        <Card>
          <BlockStack gap="400">
            <Text as="p" variant="bodyMd">
              Sign in to your existing Arcade account or create a new one. Your
              store can only be linked to one Arcade account (contact
              cs@arcade.ai to change it later).
            </Text>
            <FormLayout>
              <TextField
                autoComplete="email"
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
              />
              <TextField
                autoComplete="current-password"
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
              />
              <Button
                variant="primary"
                loading={busyMode === "signIn"}
                onClick={() => void handleAuth("signIn")}
              >
                Sign in to Arcade
              </Button>
              <Button
                loading={busyMode === "signUp"}
                onClick={() => void handleAuth("signUp")}
              >
                Create Arcade account
              </Button>
            </FormLayout>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
