import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const reservation = await prisma.reservation.findUnique({ where: { id } });

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }

  if (reservation.status !== "PENDING") {
    return NextResponse.json(
      { error: `Reservation is already ${reservation.status.toLowerCase()}.` },
      { status: 409 }
    );
  }

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

  return NextResponse.json({ id, status: "RELEASED" });
}
