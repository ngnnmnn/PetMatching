import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GetProductsDto } from './dto/get-products.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async getProducts(dto: GetProductsDto) {
    const {
      category,
      targetSpecies,
      search,
      sortBy = 'popular',
      page = 1,
      limit = 12,
    } = dto;

    const where: Prisma.ProductWhereInput = { isActive: true };

    if (category) {
      where.category = category;
    }

    if (targetSpecies && targetSpecies !== 'ALL') {
      where.OR = [{ targetSpecies }, { targetSpecies: 'ALL' }];
    }

    if (search?.trim()) {
      const keyword = search.trim();
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { name: { contains: keyword, mode: 'insensitive' } },
            { brand: { contains: keyword, mode: 'insensitive' } },
            { description: { contains: keyword, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const skip = (page - 1) * limit;

    if (sortBy === 'price_asc' || sortBy === 'price_desc') {
      const [allProducts, total] = await this.prisma.$transaction([
        this.prisma.product.findMany({ where }),
        this.prisma.product.count({ where }),
      ]);

      const data = allProducts
        .sort((a, b) => {
          const priceA = a.salePrice ?? a.originalPrice;
          const priceB = b.salePrice ?? b.originalPrice;
          const priceCompare = sortBy === 'price_asc' ? priceA - priceB : priceB - priceA;

          return priceCompare || b.reviewCount - a.reviewCount;
        })
        .slice(skip, skip + limit);

      return {
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      sortBy === 'newest'
        ? [{ createdAt: 'desc' }, { id: 'desc' }]
        : [{ reviewCount: 'desc' }, { rating: 'desc' }];

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getFeaturedProducts() {
    return this.prisma.product.findMany({
      where: { isFeatured: true, isActive: true },
      orderBy: { reviewCount: 'desc' },
      take: 4,
    });
  }

  async getProductById(id: string) {
    return this.prisma.product.findUnique({ where: { id } });
  }
}
