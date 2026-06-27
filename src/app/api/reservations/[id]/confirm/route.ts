import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkIdempotencyKey, storeIdempotencyKey } from "@/lib/idempotency";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const idempotencyKey = req.headers.get("Idempotency-Key");
  const endpoint = `POST /api/reservations/${id}/confirm`;

  if (idempotencyKey) {
    const cached = await checkIdempotencyKey(idempotencyKey, endpoint);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.statusCode });
    }
  }

  const reservation = await prisma.reservation.findUnique({ where: { id } });

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }

  if (reservation.status === "CONFIRMED") {
    return NextResponse.json({ error: "Already confirmed." }, { status: 409 });
  }

  if (reservation.status === "RELEASED") {
    return NextResponse.json({ error: "Reservation was cancelled." }, { status: 410 });
  }

  if (reservation.expiresAt < new Date()) {
    // Release the reservation since it expired
    await prisma.$transaction([
      prisma.stockLevel.update({
        where: { id: reservation.stockLevelId },
        data: { reserved: { decrement: reservation.quantity } },
      }),
      prisma.reservation.update({
        where: { id },
        data: { status: "RELEASED", releasedAt: new Date() },
      }),
    ]);

    const responseBody = { error: "Reservation has expired." };
    if (idempotencyKey) {
      await storeIdempotencyKey(idempotencyKey, endpoint, responseBody, 410);
    }
    return NextResponse.json(responseBody, { status: 410 });
  }

  // Confirm: decrement totalUnits, decrement reserved, mark confirmed
  const [, updated] = await prisma.$transaction([
    prisma.stockLevel.update({
      where: { id: reservation.stockLevelId },
      data: {
        totalUnits: { decrement: reservation.quantity },
        reserved: { decrement: reservation.quantity },
      },
    }),
    prisma.reservation.update({
      where: { id },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    }),
  ]);

  const responseBody = {
    id: updated.id,
    status: updated.status,
    confirmedAt: updated.confirmedAt,
  };

  if (idempotencyKey) {
    await storeIdempotencyKey(idempotencyKey, endpoint, responseBody, 200);
  }

  return NextResponse.json(responseBody);
}
