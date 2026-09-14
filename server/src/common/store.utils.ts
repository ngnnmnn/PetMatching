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
