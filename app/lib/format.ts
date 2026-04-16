import type { Prisma } from "@prisma/client";

export function formatPrice(value: Prisma.Decimal | number | string): string {
  return `$${Number(value).toFixed(2)}`;
}

export function gidToNumericId(gid: string | null): string | null {
  if (!gid) return null;
  const match = gid.match(/\/Product\/(\d+)$/);
  return match ? match[1] : null;
}
