import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding product variants...');

  // 1. Ao hoodie cho cho meo size S (slug: ao-hoodie-cho-cho-meo-size-s)
  const hoodie = await prisma.product.findUnique({
    where: { slug: 'ao-hoodie-cho-cho-meo-size-s' },
  });
  if (hoodie) {
    // Update main product name to generic name
    await prisma.product.update({
      where: { id: hoodie.id },
      data: { name: 'Áo Hoodie Cho Chó Mèo' },
    });

    // Delete existing variants if any
    await prisma.productVariant.deleteMany({
      where: { productId: hoodie.id },
    });

    // Create variants
    await prisma.productVariant.createMany({
      data: [
        {
          productId: hoodie.id,
          name: 'Size S - Màu Đỏ',
          sellingPrice: 150000,
          salePrice: 120000,
          stock: 20,
          imageUrl: 'https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?w=600&h=600&fit=crop',
          isActive: true,
        },
        {
          productId: hoodie.id,
          name: 'Size M - Màu Đỏ',
          sellingPrice: 160000,
          salePrice: 130000,
          stock: 15,
          imageUrl: 'https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?w=600&h=600&fit=crop',
          isActive: true,
        },
        {
          productId: hoodie.id,
          name: 'Size L - Màu Đỏ',
          sellingPrice: 170000,
          salePrice: 140000,
          stock: 10,
          imageUrl: 'https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?w=600&h=600&fit=crop',
          isActive: true,
        },
        {
          productId: hoodie.id,
          name: 'Size S - Màu Vàng',
          sellingPrice: 150000,
          salePrice: 120000,
          stock: 25,
          imageUrl: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600&h=600&fit=crop',
          isActive: true,
        },
        {
          productId: hoodie.id,
          name: 'Size M - Màu Vàng',
          sellingPrice: 160000,
          salePrice: 130000,
          stock: 18,
          imageUrl: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600&h=600&fit=crop',
          isActive: true,
        },
        {
          productId: hoodie.id,
          name: 'Size L - Màu Vàng',
          sellingPrice: 170000,
          salePrice: 140000,
          stock: 8,
          imageUrl: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600&h=600&fit=crop',
          isActive: true,
        },
      ],
    });
    console.log('Seeded variants for: Áo Hoodie Cho Chó Mèo');
  }

  // 2. Royal Canin Corgi Adult 3kg (slug: royal-canin-corgi-adult-3kg)
  const corgiFood = await prisma.product.findUnique({
    where: { slug: 'royal-canin-corgi-adult-3kg' },
  });
  if (corgiFood) {
    await prisma.product.update({
      where: { id: corgiFood.id },
      data: { name: 'Thức ăn Royal Canin Corgi Adult' },
    });

    await prisma.productVariant.deleteMany({
      where: { productId: corgiFood.id },
    });

    await prisma.productVariant.createMany({
      data: [
        {
          productId: corgiFood.id,
          name: 'Túi 1.5kg',
          sellingPrice: 650000,
          salePrice: 590000,
          stock: 50,
          imageUrl: 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?w=600&h=600&fit=crop',
          isActive: true,
        },
        {
          productId: corgiFood.id,
          name: 'Túi 3kg',
          sellingPrice: 1200000,
          salePrice: 1090000,
          stock: 30,
          imageUrl: 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?w=600&h=600&fit=crop',
          isActive: true,
        },
        {
          productId: corgiFood.id,
          name: 'Túi 10kg',
          sellingPrice: 3500000,
          salePrice: 3200000,
          stock: 12,
          imageUrl: 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?w=600&h=600&fit=crop',
          isActive: true,
        },
      ],
    });
    console.log('Seeded variants for: Thức ăn Royal Canin Corgi Adult');
  }

  // 3. Vong co da that cho meo mau hong (slug: vong-co-da-meo-mau-hong)
  const collar = await prisma.product.findUnique({
    where: { slug: 'vong-co-da-meo-mau-hong' },
  });
  if (collar) {
    await prisma.product.update({
      where: { id: collar.id },
      data: { name: 'Vòng cổ da thật cho chó mèo' },
    });

    await prisma.productVariant.deleteMany({
      where: { productId: collar.id },
    });

    await prisma.productVariant.createMany({
      data: [
        {
          productId: collar.id,
          name: 'Màu Hồng',
          sellingPrice: 220000,
          salePrice: 180000,
          stock: 15,
          imageUrl: 'https://images.unsplash.com/photo-1601758066966-c3c47ca4eb0e?w=600&h=600&fit=crop',
          isActive: true,
        },
        {
          productId: collar.id,
          name: 'Màu Xanh Dương',
          sellingPrice: 220000,
          salePrice: 180000,
          stock: 25,
          imageUrl: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600&h=600&fit=crop',
          isActive: true,
        },
        {
          productId: collar.id,
          name: 'Màu Đen Cá Tính',
          sellingPrice: 240000,
          salePrice: 200000,
          stock: 8,
          imageUrl: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=600&h=600&fit=crop',
          isActive: true,
        },
      ],
    });
    console.log('Seeded variants for: Vòng cổ da thật cho chó mèo');
  }

  console.log('Product variants seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
