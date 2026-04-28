import {
  data,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  Form,
  useLoaderData,
  useNavigate,
} from "react-router";
import { AppPage } from "../../components/layout/AppPage";
import { authenticate } from "../../shopify.server";
import db from "../../db.server";
import { Sparkle } from "./components/icons";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await db.shop.findUnique({
    where: { domain: session.shop },
    select: { onboardingComplete: true },
  });

  return data({
    onboardingComplete: shop?.onboardingComplete ?? false,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  await db.shop.update({
    where: { domain: session.shop },
    data: { onboardingComplete: true },
  });

  return redirect("/app/categories");
};

const STEPS = [
  {
    number: "1",
    title: "Browse & Choose",
    description: "Over 1 million+ SKUs created on arcade",
  },
  {
    number: "2",
    title: "Design with AI",
    description: "Describe your vision, AI creates it",
  },
  {
    number: "3",
    title: "Publish & Sell",
    description: "One click to your Shopify store",
  },
];

const VALUE_PROPS: { label: string; sparkle?: boolean }[] = [
  { label: "AI Design", sparkle: true },
  { label: "1M+ SKUs on Arcade" },
  { label: "Auto-Fulfillment" },
  { label: "No Upfront Cost" },
];

export default function Home() {
  const { onboardingComplete } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <AppPage>
      <div className="mx-auto flex max-w-[720px] flex-col gap-4 py-8">
        <section className="flex flex-col items-center gap-5 rounded-3xl border border-card-border bg-card px-6 py-12 text-center shadow-card sm:px-14 sm:py-16">
          <div className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-primary">
            <span
              role="img"
              aria-label="Arcade"
              className="size-5 bg-white mask-[url(/arcade-a-logo.svg)] mask-center mask-no-repeat mask-contain"
            />
          </div>

          <h1 className="font-display text-3xl! font-medium leading-[1.08] tracking-[-0.03em] text-primary sm:text-[44px]">
            Turn thoughts into things
          </h1>

          <p className="mx-auto max-w-[420px] font-sans text-sm! font-normal! text-secondary">
            Arcade is the world&rsquo;s first AI product creation platform.
            Design custom products with AI and sell them in your Shopify store
            &mdash; no inventory, no upfront costs.
          </p>

          <div className="flex flex-wrap justify-center gap-2">
            {VALUE_PROPS.map((prop) => (
              <span
                key={prop.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-card-border bg-page px-3.5 py-1.5 font-mono text-xs text-secondary"
              >
                {prop.sparkle && (
                  <Sparkle className="size-3 text-primary" />
                )}
                {prop.label}
              </span>
            ))}
          </div>

          <div className="flex flex-col items-center gap-4 pt-10">
            {!onboardingComplete ? (
              <Form method="post">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3 font-sans text-base font-medium text-primary transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <Sparkle className="size-4" />
                  Get Started
                </button>
              </Form>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/app/categories")}
                className="cursor-pointer inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3 font-sans text-base font-medium text-primary transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Sparkle className="size-4" />
                Get Started
              </button>
            )}

            <a
              href="https://arcade.ai"
              target="_blank"
              rel="noreferrer"
              className="font-sans text-sm font-medium text-gold transition hover:text-gold-dark"
            >
              Learn more about Arcade &rarr;
            </a>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="flex flex-col gap-1.5 rounded-2xl border border-card-border bg-card p-4 shadow-card"
            >
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-gold-pale font-mono text-xs font-medium text-gold-dark">
                {step.number}
              </span>
              <p className="font-sans text-normal! font-medium! text-primary">
                {step.title}
              </p>
              <p className="font-sans font-normal! text-xs! leading-relaxed text-subdued">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </AppPage>
  );
}
