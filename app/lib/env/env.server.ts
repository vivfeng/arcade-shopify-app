import { z } from "zod";
import { clientEnvSchema } from "./client.env";

export type { ClientEnv } from "./client.env";
export { clientEnvSchema } from "./client.env";

const serverEnvSchema = clientEnvSchema.extend({
  SHOPIFY_API_KEY: z.string().min(1),
  SHOPIFY_API_SECRET: z.string().min(1),
  SHOPIFY_APP_URL: z.string().optional(),
  SCOPES: z.string(),
  DATABASE_URL: z.string().min(1),
  ARCADE_API_URL: z.url(),
  ARCADE_API_KEY: z.string().min(1),
  FIREBASE_SERVICE_ACCOUNT_KEY: z.string().min(1),
  SHOP_CUSTOM_DOMAIN: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "production", "staging"])
    .default("development"),
});

export type Env = z.infer<typeof serverEnvSchema>;

function parseEnv(): Env {
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Missing or invalid environment variables:\n${formatted}`,
    );
  }
  return result.data;
}

export const env = parseEnv();
