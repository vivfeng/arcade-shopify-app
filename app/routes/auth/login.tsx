import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data, Form, useActionData, useLoaderData } from "react-router";
import {
  AppProvider as PolarisAppProvider,
  Button,
  Card,
  FormLayout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import polarisArcade from "../../polaris-arcade.css?url";
import { login } from "../../shopify.server";
import { loginErrorMessage } from "./login.error.server";

export const links = () => [
  { rel: "stylesheet", href: polarisStyles },
  { rel: "stylesheet", href: polarisArcade },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = await login(request);

  return data({
    errors,
    polarisTranslations: await import(
      "@shopify/polaris/locales/en.json"
    ).then((m) => m.default),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = await login(request);

  return data({
    errors: {
      shop: errors?.shop ? loginErrorMessage(errors) : undefined,
    },
  });
};

export default function Auth() {
  const { polarisTranslations } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const errorMessage = actionData?.errors?.shop;

  return (
    <PolarisAppProvider i18n={polarisTranslations}>
      <Page>
        <Card>
          <Form method="post">
            <FormLayout>
              <Text variant="headingMd" as="h2">
                Log in
              </Text>
              <TextField
                type="text"
                name="shop"
                label="Store domain"
                helpText="example.myshopify.com"
                autoComplete="on"
                error={errorMessage}
              />
              <Button submit>Log in</Button>
            </FormLayout>
          </Form>
        </Card>
      </Page>
    </PolarisAppProvider>
  );
}
