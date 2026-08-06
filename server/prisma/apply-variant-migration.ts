import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Applying SQL migration for product_variants and variant_id ---');

  // 1. Create table product_variants
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.product_variants (
      id TEXT NOT NULL PRIMARY KEY,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      attributes JSONB,
      selling_price DOUBLE PRECISION NOT NULL,
      sale_price DOUBLE PRECISION,
      stock INT NOT NULL DEFAULT 0,
      image_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✓ Table public.product_variants ensured.');

  // Foreign key for product_variants -> products
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE ON UPDATE CASCADE;
    `);
  } catch (e: any) {
    // Ignore if constraint already exists
  }

  // Index on product_variants
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS product_variants_product_id_is_active_idx ON public.product_variants(product_id, is_active);
  `);

  // 2. Add variant_id to order_items
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_id TEXT;
  `);
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_variant_id_fkey
      FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL ON UPDATE CASCADE;
    `);
  } catch (e: any) {}
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS order_items_variant_id_idx ON public.order_items(variant_id);
  `);
  console.log('✓ Column order_items.variant_id ensured.');

  // 3. Add variant_id to cart_items
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS variant_id TEXT;
  `);
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.cart_items
      ADD CONSTRAINT cart_items_variant_id_fkey
      FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE ON UPDATE CASCADE;
    `);
  } catch (e: any) {}
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS cart_items_variant_id_idx ON public.cart_items(variant_id);
  `);
  console.log('✓ Column cart_items.variant_id ensured.');

  console.log('Migration execution complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
