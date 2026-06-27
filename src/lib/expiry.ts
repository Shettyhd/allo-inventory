import { prisma } from "./prisma";

/**
 * Release all PENDING reservations that have passed their expiresAt time.
 * Called lazily on reads (GET /api/products) and by Vercel Cron.
 */
export async function releaseExpiredReservations(): Promise<number> {
  const now = new Date();

  // Find expired PENDING reservations
  const expired = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lte: now },
    },
    select: { id: true, stockLevelId: true, quantity: true },
  });

  if (expired.length === 0) return 0;

  // For each expired reservation, update status + decrement reserved count atomically
  await prisma.$transaction(
    expired.map((r) =>
      prisma.stockLevel.update({
        where: { id: r.stockLevelId },
        data: { reserved: { decrement: r.quantity } },
      })
    )
  );

  await prisma.reservation.updateMany({
    where: { id: { in: expired.map((r) => r.id) } },
    data: { status: "RELEASED", releasedAt: now },
  });

  return expired.length;
}
