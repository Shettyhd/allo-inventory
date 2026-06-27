import { prisma } from "./prisma";

/**
 * Check if an idempotency key already exists.
 * Returns the cached response if found, null otherwise.
 */
export async function checkIdempotencyKey(
  key: string,
  endpoint: string
): Promise<{ body: unknown; statusCode: number } | null> {
  const record = await prisma.idempotencyKey.findUnique({ where: { key } });
  if (!record) return null;
  if (record.endpoint !== endpoint) return null; // key reused across endpoints — reject
  return {
    body: JSON.parse(record.responseBody),
    statusCode: record.statusCode,
  };
}

/**
 * Store an idempotency key with the response so retries get the same result.
 */
export async function storeIdempotencyKey(
  key: string,
  endpoint: string,
  body: unknown,
  statusCode: number
): Promise<void> {
  await prisma.idempotencyKey.upsert({
    where: { key },
    update: {},
    create: {
      key,
      endpoint,
      responseBody: JSON.stringify(body),
      statusCode,
    },
  });
}
