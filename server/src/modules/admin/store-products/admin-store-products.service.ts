import { PrismaService } from '../../../common/prisma/prisma.service';
import { findConfiguredStoreId } from '../../../common/store.utils';

export class AdminStoreProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProducts() {
    const storeId = await findConfiguredStoreId(this.prisma);

    return this.prisma.product.findMany({
      where: { storeId: storeId ?? '__missing__' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        brand: true,
        category: true,
        imageUrl: true,
        sellingPrice: true,
        importPrice: true,
        salePrice: true,
        stock: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }
}
