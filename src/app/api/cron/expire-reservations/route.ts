import { NextRequest, NextResponse } from "next/server";
import { releaseExpiredReservations } from "@/lib/expiry";

/**
 * Called by Vercel Cron.
 * Schedule: Every 2 minutes.
 * Protected by a shared secret.
 */
export async function GET(req: NextRequest) {
  const secret =
    req.headers.get("x-cron-secret") ??
    req.nextUrl.searchParams.get("secret");

  if (
    process.env.CRON_SECRET &&
    secret !== process.env.CRON_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const released = await releaseExpiredReservations();

  return NextResponse.json({
    ok: true,
    releasedCount: released,
    timestamp: new Date().toISOString(),
  });
}