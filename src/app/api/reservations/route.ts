import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { acquireLock, releaseLock } from "@/lib/redis";
import { ReserveSchema } from "@/lib/schemas";
import { checkIdempotencyKey, storeIdempotencyKey } from "@/lib/idempotency";

const RESERVATION_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get("Idempotency-Key");
  const endpoint = "POST /api/reservations";

  // Idempotency check (bonus)
  if (idempotencyKey) {
    const cached = await checkIdempotencyKey(idempotencyKey, endpoint);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.statusCode });
    }
  }

  const body = await req.json();
  const parsed = ReserveSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { productId, warehouseId, quantity } = parsed.data;

  // Distributed lock key scoped to the specific product+warehouse SKU
  const lockKey = `lock:stock:${productId}:${warehouseId}`;
  const acquired = await acquireLock(lockKey, 8000);

  if (!acquired) {
    return NextResponse.json(
      { error: "Service busy, please retry in a moment." },
      { status: 503 }
    );
  }

  try {
    // Read current stock INSIDE the lock
    const stockLevel = await prisma.stockLevel.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    });

    if (!stockLevel) {
      return NextResponse.json(
        { error: "Product not available at this warehouse." },
        { status: 404 }
      );
    }

    const available = stockLevel.totalUnits - stockLevel.reserved;

    if (available < quantity) {
      const responseBody = {
        error: "Not enough stock available.",
        available,
        requested: quantity,
      };
      if (idempotencyKey) {
        await storeIdempotencyKey(idempotencyKey, endpoint, responseBody, 409);
      }
      return NextResponse.json(responseBody, { status: 409 });
    }

    // Atomically increment reserved + create reservation
    const expiresAt = new Date(Date.now() + RESERVATION_WINDOW_MS);

    const [, reservation] = await prisma.$transaction([
      prisma.stockLevel.update({
        where: { id: stockLevel.id },
        data: { reserved: { increment: quantity } },
      }),
      prisma.reservation.create({
        data: {
          stockLevelId: stockLevel.id,
          quantity,
          expiresAt,
        },
        include: {
          stockLevel: {
            include: { product: true, warehouse: true },
          },
        },
      }),
    ]);

    const responseBody = {
      id: reservation.id,
      status: reservation.status,
      quantity: reservation.quantity,
      expiresAt: reservation.expiresAt,
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

    if (idempotencyKey) {
      await storeIdempotencyKey(idempotencyKey, endpoint, responseBody, 201);
    }

    return NextResponse.json(responseBody, { status: 201 });
  } finally {
    await releaseLock(lockKey);
  }
}
