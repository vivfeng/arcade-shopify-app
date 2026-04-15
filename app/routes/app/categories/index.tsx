import { data, type LoaderFunctionArgs, Link, useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../../../shopify.server";
import db from "../../../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const categories = await db.productCategory.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
    },
  });

  return data({ categories });
};

export default function CategoriesIndex() {
  const { categories } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-page px-8 pt-7 pb-12">
      <Link to="/app" className="no-underline">
        <h1 className="m-0 text-[22px] font-semibold text-primary">Arcade</h1>
      </Link>
      <p className="mt-1.5 mb-0 text-[13px] text-subdued">
        Design custom products with AI — browse categories to get started
      </p>

      <div className="mt-5 grid grid-cols-4 gap-4">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => navigate(`/app/categories/${cat.slug}`)}
            className="group cursor-pointer flex flex-col bg-card border border-card-border-soft rounded-lg overflow-hidden transition-colors hover:border-card-border-hover appearance-none text-left"
          >
            <div className="w-full aspect-[242/138] overflow-hidden">
              {cat.imageUrl ? (
                <img
                  src={cat.imageUrl}
                  alt={cat.name}
                  className="size-full object-cover block"
                />
              ) : (
                <div className="size-full bg-surface-muted" />
              )}
            </div>
            <div className="px-3 py-2.5">
              <span className="text-[13px] font-medium text-primary">
                {cat.name}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
