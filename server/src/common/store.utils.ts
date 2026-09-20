import type { Prisma } from '@prisma/client';

type StoreLookupClient = Pick<Prisma.TransactionClient, 'store'>;

/**
 * The Store workflow uses the oldest Store record as the configured store.
 * Keeping this lookup in one place prevents modules from selecting it
 * differently while the existing schema still retains store relations.
 */
export async function findConfiguredStoreId(
  client: StoreLookupClient,
): Promise<string | null> {
  const store = await client.store.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  return store?.id ?? null;
}

/** Products that still have stock overall but need a variant-level refill. */
export function lowStockProductWhere(
  storeId?: string,
): Prisma.ProductWhereInput {
  return {
    storeId: storeId ?? '__missing__',
    stock: { gt: 0 },
    OR: [
      { variants: { some: { stock: { lt: 5 } } } },
      { variants: { none: {} }, stock: { lt: 5 } },
    ],
  };
}
