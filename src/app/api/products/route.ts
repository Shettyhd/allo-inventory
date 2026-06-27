import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/expiry";

export async function GET() {
  // Lazy expiry cleanup on every product fetch
  await releaseExpiredReservations();

  const products = await prisma.product.findMany({
    include: {
      stockLevels: {
        include: { warehouse: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const result = products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    price: p.price,
    stock: p.stockLevels.map((sl) => ({
      stockLevelId: sl.id,
      warehouseId: sl.warehouseId,
      warehouseName: sl.warehouse.name,
      warehouseLocation: sl.warehouse.location,
      totalUnits: sl.totalUnits,
      reserved: sl.reserved,
      available: sl.totalUnits - sl.reserved,
    })),
  }));

  return NextResponse.json(result);
}
