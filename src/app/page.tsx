import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/expiry";
import { ProductCard } from "@/components/ProductCard";
import { Boxes } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getProducts() {
  await releaseExpiredReservations();
  return prisma.product.findMany({
    include: { stockLevels: { include: { warehouse: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export default async function HomePage() {
  const products = await getProducts();

  const productData = products.map((p) => ({
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

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-indigo-100">
            <Boxes className="h-6 w-6 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Product Catalogue</h1>
        </div>
        <p className="text-slate-500 ml-14">
          Select a warehouse and reserve your items — you&apos;ll have 10 minutes to complete checkout.
        </p>
      </div>

      {productData.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Boxes className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium">No products found</p>
          <p className="text-sm mt-1">Run <code className="bg-slate-100 px-1.5 py-0.5 rounded">npm run db:seed</code> to add sample data.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {productData.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
