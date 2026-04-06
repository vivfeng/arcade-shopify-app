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
      name: "Scarves",
      slug: "scarves",
      sortOrder: 1,
      imageUrl: "https://www.datocms-assets.com/134217/1760377755-scarfladyproduct.jpg",
      productTypes: [
        {
          name: "Silk Scarf",
          slug: "silk-scarf",
          specs: '36x36", 100% silk twill',
          basePrice: 12.5,
          sizeOptions: ['24x24"', '36x36"', '42x42"'],
          fabricOptions: ["Silk Twill", "Silk Charmeuse", "Silk Chiffon"],
        },
        {
          name: "Wool Scarf",
          slug: "wool-scarf",
          specs: '12x72", merino wool blend',
          basePrice: 15.0,
          sizeOptions: ['10x60"', '12x72"', '14x80"'],
          fabricOptions: ["Merino Wool", "Cashmere Blend", "Wool-Silk Blend"],
        },
      ],
    },
    {
      name: "Decorative Pillows",
      slug: "decorative-pillows",
      sortOrder: 2,
      imageUrl: "https://www.datocms-assets.com/134217/1760394017-pillowcropped.jpeg",
      productTypes: [
        {
          name: "Square Throw Pillow Cover",
          slug: "square-throw-pillow-cover",
          specs: '18x18", 100% polyester',
          basePrice: 6.5,
          sizeOptions: ['11x11"', '16x16"', '18x18"', '20x20"'],
          fabricOptions: ["Cotton Canvas", "Linen", "Velvet"],
        },
        {
          name: "Lumbar Pillow Cover",
          slug: "lumbar-pillow-cover",
          specs: '12x20", linen-cotton blend',
          basePrice: 7.25,
          sizeOptions: ['12x16"', '12x20"', '14x24"'],
          fabricOptions: ["Cotton Canvas", "Linen-Cotton Blend", "Velvet"],
        },
        {
          name: "Euro Sham Cover",
          slug: "euro-sham-cover",
          specs: '26x26", cotton sateen',
          basePrice: 8.95,
          sizeOptions: ['26x26"'],
          fabricOptions: ["Cotton Sateen", "Linen", "Velvet"],
        },
        {
          name: "Outdoor Pillow Cover",
          slug: "outdoor-pillow-cover",
          specs: '18x18", UV-resistant polyester',
          basePrice: 9.5,
          sizeOptions: ['16x16"', '18x18"', '20x20"'],
          fabricOptions: ["UV-Resistant Polyester", "Sunbrella Fabric"],
        },
      ],
    },
    {
      name: "Table Linens",
      slug: "table-linens",
      sortOrder: 3,
      imageUrl: "https://www.datocms-assets.com/134217/1760393303-napkinclose.jpg",
      productTypes: [
        {
          name: "Linen Table Set",
          slug: "linen-table-set",
          specs: "4-piece set, 100% linen",
          basePrice: 24.0,
          sizeOptions: ["4-piece", "6-piece", "8-piece"],
          fabricOptions: ["Pure Linen", "Linen-Cotton Blend"],
        },
      ],
    },
    {
      name: "Napkins",
      slug: "napkins",
      sortOrder: 4,
      imageUrl: "https://www.datocms-assets.com/134217/1760381488-napkinclose.jpg",
      productTypes: [
        {
          name: "Cloth Dinner Napkin",
          slug: "cloth-dinner-napkin",
          specs: '20x20", cotton',
          basePrice: 3.5,
          sizeOptions: ['18x18"', '20x20"', '22x22"'],
          fabricOptions: ["Cotton", "Linen", "Cotton-Poly Blend"],
        },
        {
          name: "Cocktail Napkin",
          slug: "cocktail-napkin",
          specs: '10x10", cotton',
          basePrice: 2.25,
          sizeOptions: ['8x8"', '10x10"'],
          fabricOptions: ["Cotton", "Linen"],
        },
      ],
    },
    {
      name: "Placemats",
      slug: "placemats",
      sortOrder: 5,
      imageUrl: "https://www.datocms-assets.com/134217/1760376408-placematcropped.jpg",
      productTypes: [
        {
          name: "Woven Placemat",
          slug: "woven-placemat",
          specs: '14x19", cotton weave',
          basePrice: 4.75,
          sizeOptions: ['13x18"', '14x19"', '14x20"'],
          fabricOptions: ["Cotton Weave", "Jute", "Linen"],
        },
      ],
    },
    {
      name: "Tablecloths",
      slug: "tablecloths",
      sortOrder: 6,
      imageUrl: "https://www.datocms-assets.com/134217/1760376407-tablecoth.jpg",
      productTypes: [
        {
          name: "Rectangular Tablecloth",
          slug: "rectangular-tablecloth",
          specs: '60x84", cotton-poly blend',
          basePrice: 18.0,
          sizeOptions: ['60x84"', '60x102"', '60x120"'],
          fabricOptions: ["Cotton", "Cotton-Poly Blend", "Linen"],
        },
        {
          name: "Round Tablecloth",
          slug: "round-tablecloth",
          specs: '70" diameter, cotton',
          basePrice: 16.0,
          sizeOptions: ['60" round', '70" round', '90" round'],
          fabricOptions: ["Cotton", "Cotton-Poly Blend", "Linen"],
        },
      ],
    },
    {
      name: "Table Runners",
      slug: "table-runners",
      sortOrder: 7,
      imageUrl: "https://www.datocms-assets.com/134217/1760376408-tablerunner.jpg",
      productTypes: [
        {
          name: "Table Runner",
          slug: "table-runner",
          specs: '14x72", cotton-linen blend',
          basePrice: 8.5,
          sizeOptions: ['13x48"', '14x72"', '14x90"', '14x108"'],
          fabricOptions: ["Cotton", "Linen", "Cotton-Linen Blend", "Burlap"],
        },
      ],
    },
    {
      name: "Duvet Covers",
      slug: "duvet-covers",
      sortOrder: 8,
      imageUrl: "https://www.datocms-assets.com/134217/1760376922-duvet.jpg",
      productTypes: [
        {
          name: "Duvet Cover Set",
          slug: "duvet-cover-set",
          specs: "Queen, 300TC cotton sateen",
          basePrice: 35.0,
          sizeOptions: ["Twin", "Full/Queen", "King", "Cal King"],
          fabricOptions: [
            "Cotton Sateen",
            "Cotton Percale",
            "Linen",
            "Bamboo-Cotton",
          ],
        },
      ],
    },
    {
      name: "Shams",
      slug: "shams",
      sortOrder: 9,
      imageUrl: "https://www.datocms-assets.com/134217/1760376922-shams.jpg",
      productTypes: [
        {
          name: "Pillow Sham",
          slug: "pillow-sham",
          specs: 'Standard 20x26", cotton sateen',
          basePrice: 10.0,
          sizeOptions: ['Standard 20x26"', 'Queen 20x30"', 'King 20x36"'],
          fabricOptions: ["Cotton Sateen", "Cotton Percale", "Linen"],
        },
      ],
    },
    {
      name: "Quilts",
      slug: "quilts",
      sortOrder: 10,
      imageUrl: "https://www.datocms-assets.com/134217/1760376922-quilt.jpg",
      productTypes: [
        {
          name: "Coverlet Quilt",
          slug: "coverlet-quilt",
          specs: "Queen 90x96\", cotton fill",
          basePrice: 42.0,
          sizeOptions: ["Twin 68x88\"", "Full/Queen 90x96\"", "King 108x96\""],
          fabricOptions: [
            "Cotton Shell + Cotton Fill",
            "Cotton Shell + Poly Fill",
          ],
        },
      ],
    },
    {
      name: "Quilted Shams",
      slug: "quilted-shams",
      sortOrder: 11,
      imageUrl: "https://www.datocms-assets.com/134217/1760376922-quilt-shams.jpg",
      productTypes: [
        {
          name: "Quilted Pillow Sham",
          slug: "quilted-pillow-sham",
          specs: 'Standard 20x26", quilted cotton',
          basePrice: 14.0,
          sizeOptions: ['Standard 20x26"', 'King 20x36"', 'Euro 26x26"'],
          fabricOptions: ["Quilted Cotton", "Quilted Linen"],
        },
      ],
    },
    {
      name: "Curtains",
      slug: "curtains",
      sortOrder: 12,
      imageUrl: "https://www.datocms-assets.com/134217/1760377023-curtainseditorial.jpg",
      productTypes: [
        {
          name: "Curtain Panel",
          slug: "curtain-panel",
          specs: '50x84", cotton-linen blend',
          basePrice: 22.0,
          sizeOptions: ['50x63"', '50x84"', '50x96"', '50x108"'],
          fabricOptions: [
            "Cotton",
            "Linen",
            "Cotton-Linen Blend",
            "Blackout Lining",
          ],
        },
      ],
    },
    {
      name: "Lampshades",
      slug: "lampshades",
      sortOrder: 13,
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
