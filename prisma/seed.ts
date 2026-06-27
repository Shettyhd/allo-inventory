import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clean up
  await prisma.reservation.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // Warehouses
  const [delhi, mumbai, bangalore] = await Promise.all([
    prisma.warehouse.create({ data: { name: "Delhi Hub", location: "New Delhi, DL" } }),
    prisma.warehouse.create({ data: { name: "Mumbai Central", location: "Mumbai, MH" } }),
    prisma.warehouse.create({ data: { name: "Bengaluru Fulfillment", location: "Bengaluru, KA" } }),
  ]);

  // Products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Sony WH-1000XM5 Headphones",
        description: "Industry-leading noise cancelling wireless headphones with 30-hour battery life.",
        price: 29990,
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80",
      },
    }),
    prisma.product.create({
      data: {
        name: "Apple AirPods Pro (2nd Gen)",
        description: "Active noise cancellation, Adaptive Transparency, and Personalised Spatial Audio.",
        price: 24900,
        imageUrl: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=400&q=80",
      },
    }),
    prisma.product.create({
      data: {
        name: "Samsung Galaxy Watch 6",
        description: "Advanced health monitoring with BioActive Sensor and 40-hour battery.",
        price: 28999,
        imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80",
      },
    }),
    prisma.product.create({
      data: {
        name: "Logitech MX Master 3S",
        description: "Advanced wireless mouse with 8K DPI sensor and MagSpeed scrolling.",
        price: 9995,
        imageUrl: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&q=80",
      },
    }),
    prisma.product.create({
      data: {
        name: "Kindle Paperwhite (2023)",
        description: "300 ppi glare-free display, 3-month battery, IPX8 waterproof.",
        price: 13999,
        imageUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&q=80",
      },
    }),
    prisma.product.create({
      data: {
        name: "GoPro HERO12 Black",
        description: "5.3K60 video, HyperSmooth 6.0, 27MP photos with HDR.",
        price: 39990,
        imageUrl: "https://images.unsplash.com/photo-1508921108053-9f757ead871c?w=400&q=80",
      },
    }),
  ]);

  // Stock levels — some scarce to demo the race-condition logic
  const stockData = [
    // Sony headphones
    { productId: products[0].id, warehouseId: delhi.id, totalUnits: 15, reserved: 0 },
    { productId: products[0].id, warehouseId: mumbai.id, totalUnits: 8, reserved: 0 },
    { productId: products[0].id, warehouseId: bangalore.id, totalUnits: 3, reserved: 0 },
    // AirPods
    { productId: products[1].id, warehouseId: delhi.id, totalUnits: 20, reserved: 0 },
    { productId: products[1].id, warehouseId: mumbai.id, totalUnits: 1, reserved: 0 }, // scarce!
    { productId: products[1].id, warehouseId: bangalore.id, totalUnits: 12, reserved: 0 },
    // Galaxy Watch
    { productId: products[2].id, warehouseId: delhi.id, totalUnits: 5, reserved: 0 },
    { productId: products[2].id, warehouseId: bangalore.id, totalUnits: 10, reserved: 0 },
    // Logitech MX
    { productId: products[3].id, warehouseId: mumbai.id, totalUnits: 25, reserved: 0 },
    { productId: products[3].id, warehouseId: bangalore.id, totalUnits: 18, reserved: 0 },
    // Kindle
    { productId: products[4].id, warehouseId: delhi.id, totalUnits: 2, reserved: 0 }, // scarce!
    { productId: products[4].id, warehouseId: mumbai.id, totalUnits: 7, reserved: 0 },
    // GoPro
    { productId: products[5].id, warehouseId: delhi.id, totalUnits: 4, reserved: 0 },
    { productId: products[5].id, warehouseId: bangalore.id, totalUnits: 6, reserved: 0 },
  ];

  await prisma.stockLevel.createMany({ data: stockData });

  console.log(`✅ Seeded ${products.length} products, 3 warehouses, ${stockData.length} stock levels`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
