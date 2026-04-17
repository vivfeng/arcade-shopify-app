import { data, type LoaderFunctionArgs, useLoaderData, useNavigate } from "react-router";
import { AppPage } from "../../../components/layout/AppPage";
import { authenticate } from "../../../shopify.server";
import db from "../../../db.server";
import { formatPrice } from "../../../lib/format";
import { PageShell } from "../../../components/layout/PageShell";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const { slug } = params;

  const category = await db.productCategory.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      productTypes: {
        select: {
          id: true,
          name: true,
          slug: true,
          specs: true,
          basePrice: true,
          imageUrl: true,
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!category) {
    throw new Response("Category not found", { status: 404 });
  }

  const serialized = {
    ...category,
    productTypes: category.productTypes.map((pt) => ({
      ...pt,
      basePrice: Number(pt.basePrice),
    })),
  };

  return data({ category: serialized });
};

const POPULAR_LIMIT = 1;

export default function CategoryProductTypes() {
  const { category } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const singularName = category.name.toLowerCase().replace(/s$/, "");

  return (
    <AppPage>
      <PageShell
        heading={category.name}
        subtitle={`Choose a ${singularName} style to start designing`}
        backLabel="Back to Categories"
        onBack={() => navigate("/app/categories")}
      >
        {category.productTypes.map((pt, index) => (
          <div
            key={pt.id}
            className="flex items-center gap-4 h-16 px-4 bg-card border border-card-border rounded-lg shadow-card"
          >
            <div className="size-10 rounded-md shrink-0 bg-surface-muted overflow-hidden">
              {pt.imageUrl && !pt.imageUrl.startsWith("/images/product-types/") && (
                <img
                  src={pt.imageUrl}
                  alt={pt.name}
                  className="size-full object-cover block"
                />
              )}
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-primary whitespace-nowrap">
                  {pt.name}
                </span>
                {index < POPULAR_LIMIT && (
                  <span className="inline-flex items-center justify-center h-[18px] px-1.5 rounded-xs bg-gold-pale text-gold text-[9px] font-mono whitespace-nowrap">
                    Popular
                  </span>
                )}
              </div>
              {pt.specs && (
                <span className="text-[10px] text-subdued font-mono whitespace-nowrap overflow-hidden text-ellipsis">
                  {pt.specs}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[13px] font-semibold text-primary whitespace-nowrap">
                From {formatPrice(pt.basePrice)}
              </span>
              <button
                type="button"
                onClick={() => navigate(`/app/design/prompt?type=${pt.slug}`)}
                className="h-[30px] px-3 rounded-md border-none bg-primary text-card text-xs font-medium cursor-pointer whitespace-nowrap"
              >
                Design
              </button>
            </div>
          </div>
        ))}
      </PageShell>
    </AppPage>
  );
}
