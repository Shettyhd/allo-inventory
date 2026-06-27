import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CheckoutClient } from "./CheckoutClient";

export const dynamic = "force-dynamic";

async function getReservation(id: string) {
  return prisma.reservation.findUnique({
    where: { id },
    include: { stockLevel: { include: { product: true, warehouse: true } } },
  });
}

export default async function CheckoutPage({ params }: { params: { id: string } }) {
  const reservation = await getReservation(params.id);
  if (!reservation) notFound();

  const data = {
    id: reservation.id,
    status: reservation.status as "PENDING" | "CONFIRMED" | "RELEASED",
    quantity: reservation.quantity,
    expiresAt: reservation.expiresAt.toISOString(),
    confirmedAt: reservation.confirmedAt?.toISOString() ?? null,
    releasedAt: reservation.releasedAt?.toISOString() ?? null,
    createdAt: reservation.createdAt.toISOString(),
    product: {
      id: reservation.stockLevel.product.id,
      name: reservation.stockLevel.product.name,
      price: reservation.stockLevel.product.price,
      imageUrl: reservation.stockLevel.product.imageUrl,
    },
    warehouse: {
      id: reservation.stockLevel.warehouse.id,
      name: reservation.stockLevel.warehouse.name,
      location: reservation.stockLevel.warehouse.location,
    },
  };

  return <CheckoutClient initialReservation={data} />;
}
