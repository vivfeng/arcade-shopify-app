import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ─── Manufacturer ───
  const manufacturer = await db.manufacturer.upsert({
    where: { id: "mfr-esme-textiles" },
    update: {},
    create: {
      id: "mfr-esme-textiles",
      name: "Esme Textiles",
      capabilities: [
        "scarves",
        "decorative_pillows",
        "table_linens",
        "napkins",
        "placemats",
        "tablecloths",
        "table_runners",
        "duvet_covers",
        "shams",
        "quilts",
        "quilted_shams",
        "curtains",
        "lampshades",
      ],
      fulfillmentCapacity: 500,
    },
  });

  // ─── Categories + Product Types ───
  // Prices sourced from Pricing HQ spreadsheet (Rounded Retail Price, minimum per product type)
  const categories: Array<{
    name: string;
    slug: string;
    sortOrder: number;
    imageUrl: string;
    productTypes: Array<{
      name: string;
      slug: string;
      specs: string;
      basePrice: number;
      sizeOptions: string[];
      fabricOptions: string[];
    }>;
  }> = [
    {
      name: "Pillow Covers",
      slug: "pillow-covers",
      sortOrder: 1,
      imageUrl: "https://www.datocms-assets.com/134217/1760394017-pillowcropped.jpeg",
      productTypes: [
        {
          name: "Square Pillow",
          slug: "square-pillow",
          specs: '11"–26", cotton canvas · linen · recycled polyester',
          basePrice: 20.0,
          sizeOptions: ['11x11"', '12x12"', '14x14"', '16x16"', '18x18"', '20x20"', '22x22"', '24x24"', '26x26"'],
          fabricOptions: ["Everyday Cotton (100% Cotton Canvas)", "Crisp Linen (100% Linen)", "100% Recycled Polyester (Outdoor)"],
        },
        {
          name: "Rectangular Pillow",
          slug: "rectangular-pillow",
          specs: '12x16"–20x30", cotton canvas · linen · recycled polyester',
          basePrice: 20.0,
          sizeOptions: ['12x16"', '12x18"', '12x20"', '12x21"', '14x20"', '14x22"', '14x30"', '16x26"', '20x30"'],
          fabricOptions: ["Everyday Cotton (100% Cotton Canvas)", "Crisp Linen (100% Linen)", "100% Recycled Polyester (Outdoor)"],
        },
        {
          name: "Lumbar Pillow",
          slug: "lumbar-pillow",
          specs: '12x24"–36x14", cotton canvas · linen · recycled polyester',
          basePrice: 30.0,
          sizeOptions: ['12x24"', '14x36"', '36x14"'],
          fabricOptions: ["Everyday Cotton (100% Cotton Canvas)", "Crisp Linen (100% Linen)", "100% Recycled Polyester (Outdoor)"],
        },
        {
          name: "Floor Pillow",
          slug: "floor-pillow",
          specs: '36x36"–30x72", cotton canvas · linen · recycled polyester',
          basePrice: 64.0,
          sizeOptions: ['36x36"', '30x72"'],
          fabricOptions: ["Everyday Cotton (100% Cotton Canvas)", "Crisp Linen (100% Linen)", "100% Recycled Polyester (Outdoor)"],
        },
      ],
    },
    {
      name: "Table Linens",
      slug: "table-linens",
      sortOrder: 2,
      imageUrl: "https://www.datocms-assets.com/134217/1760393303-napkinclose.jpg",
      productTypes: [
        {
          name: "Cocktail Napkin Set",
          slug: "cocktail-napkin-set",
          specs: "Set of 4–6, cotton canvas · linen",
          basePrice: 22.0,
          sizeOptions: ["Set of 4", "Set of 6"],
          fabricOptions: ["Everyday Cotton (100% Cotton Canvas)", "Crisp Linen (100% Linen)"],
        },
        {
          name: "Dinner Napkin Set",
          slug: "dinner-napkin-set",
          specs: "Set of 4, cotton canvas · linen",
          basePrice: 28.0,
          sizeOptions: ["Set of 4"],
          fabricOptions: ["Everyday Cotton (100% Cotton Canvas)", "Crisp Linen (100% Linen)"],
        },
        {
          name: "Placemat Set",
          slug: "placemat-set",
          specs: "Set of 4, cotton canvas · linen",
          basePrice: 28.0,
          sizeOptions: ["Set of 4"],
          fabricOptions: ["Everyday Cotton (100% Cotton Canvas)", "Crisp Linen (100% Linen)"],
        },
        {
          name: "Table Runner",
          slug: "table-runner",
          specs: "Cotton canvas · linen",
          basePrice: 56.0,
          sizeOptions: [],
          fabricOptions: ["Everyday Cotton (100% Cotton Canvas)", "Crisp Linen (100% Linen)"],
        },
        {
          name: "Tablecloth",
          slug: "tablecloth",
          specs: "Cotton canvas · linen",
          basePrice: 60.0,
          sizeOptions: [],
          fabricOptions: ["Everyday Cotton (100% Cotton Canvas)", "Crisp Linen (100% Linen)"],
        },
      ],
    },
    {
      name: "Curtain Panels",
      slug: "curtain-panels",
      sortOrder: 3,
      imageUrl: "https://www.datocms-assets.com/134217/1760377023-curtainseditorial.jpg",
      productTypes: [
        {
          name: "Curtain Panel",
          slug: "curtain-panel",
          specs: "Cotton canvas · linen · rod pocket · tabs · grommet",
          basePrice: 48.0,
          sizeOptions: [],
          fabricOptions: ["Everyday Cotton (100% Cotton Canvas)", "Crisp Linen (100% Linen)"],
        },
      ],
    },
    {
      name: "Scarves",
      slug: "scarves",
      sortOrder: 4,
      imageUrl: "https://www.datocms-assets.com/134217/1760377755-scarfladyproduct.jpg",
      productTypes: [
        {
          name: "Rectangular Scarf",
          slug: "rectangular-scarf",
          specs: "Raw hem, cotton canvas · linen",
          basePrice: 26.0,
          sizeOptions: [],
          fabricOptions: ["Everyday Cotton (100% Cotton Canvas)", "Crisp Linen (100% Linen)"],
        },
        {
          name: "Square Scarf",
          slug: "square-scarf",
          specs: "Cotton canvas · linen",
          basePrice: 88.0,
          sizeOptions: [],
          fabricOptions: ["Everyday Cotton (100% Cotton Canvas)", "Crisp Linen (100% Linen)"],
        },
      ],
    },
    {
      name: "Bedding",
      slug: "bedding",
      sortOrder: 5,
      imageUrl: "https://www.datocms-assets.com/134217/1760376922-duvet.jpg",
      productTypes: [
        {
          name: "Sham",
          slug: "sham",
          specs: "Each, cotton canvas · linen",
          basePrice: 32.0,
          sizeOptions: ["Standard", "King", "Euro"],
          fabricOptions: ["Everyday Cotton (100% Cotton Canvas)", "Crisp Linen (100% Linen)"],
        },
        {
          name: "Quilted Sham",
          slug: "quilted-sham",
          specs: "Each, cotton canvas · linen",
          basePrice: 48.0,
          sizeOptions: ["Standard", "King", "Euro"],
          fabricOptions: ["Everyday Cotton (100% Cotton Canvas)", "Crisp Linen (100% Linen)"],
        },
        {
          name: "Quilt",
          slug: "quilt",
          specs: "Cotton canvas · linen",
          basePrice: 122.0,
          sizeOptions: ["Twin", "Full/Queen", "King"],
          fabricOptions: ["Everyday Cotton (100% Cotton Canvas)", "Crisp Linen (100% Linen)"],
        },
        {
          name: "Duvet Cover",
          slug: "duvet-cover",
          specs: "Cotton canvas · linen",
          basePrice: 148.0,
          sizeOptions: ["Twin", "Full/Queen", "King"],
          fabricOptions: ["Everyday Cotton (100% Cotton Canvas)", "Crisp Linen (100% Linen)"],
        },
      ],
    },
    {
      name: "Lampshades",
      slug: "lampshades",
      sortOrder: 6,
      imageUrl: "https://www.datocms-assets.com/134217/1760377721-floorlamp.jpg",
      productTypes: [
        {
          name: "Drum Lampshade",
          slug: "drum-lampshade",
          specs: '12" diameter, linen',
          basePrice: 18.0,
          sizeOptions: ['8" diameter', '10" diameter', '12" diameter', '14" diameter'],
          fabricOptions: ["Linen", "Cotton", "Silk"],
        },
        {
          name: "Empire Lampshade",
          slug: "empire-lampshade",
          specs: '10" base, silk',
          basePrice: 22.0,
          sizeOptions: ['8" base', '10" base', '12" base'],
          fabricOptions: ["Silk", "Linen", "Pleated Fabric"],
        },
      ],
    },
  ];

  for (const cat of categories) {
    const category = await db.productCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        sortOrder: cat.sortOrder,
        imageUrl: cat.imageUrl,
      },
      create: {
        name: cat.name,
        slug: cat.slug,
        sortOrder: cat.sortOrder,
        imageUrl: cat.imageUrl,
      },
    });

    for (const pt of cat.productTypes) {
      await db.productType.upsert({
        where: { slug: pt.slug },
        update: {
          name: pt.name,
          specs: pt.specs,
          basePrice: pt.basePrice,
          sizeOptions: pt.sizeOptions,
          fabricOptions: pt.fabricOptions,
        },
        create: {
          name: pt.name,
          slug: pt.slug,
          specs: pt.specs,
          basePrice: pt.basePrice,
          sizeOptions: pt.sizeOptions,
          fabricOptions: pt.fabricOptions,
          imageUrl: `/images/product-types/${pt.slug}.jpg`,
          categoryId: category.id,
          manufacturerId: manufacturer.id,
        },
      });
    }

    console.log(
      `  Seeded category "${cat.name}" with ${cat.productTypes.length} product types`,
    );
  }

  console.log("Seed complete!");
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
