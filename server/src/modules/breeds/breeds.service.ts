import { Injectable } from '@nestjs/common';
import { Species } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class BreedsService {
  constructor(private readonly prisma: PrismaService) {}

  // Lấy danh sách giống đang hoạt động kèm phân loại thuần chủng/lai và quyền nộp phả hệ
  getBreeds(species?: Species) {
    return this.prisma.breed.findMany({
      where: {
        isActive: true,
        ...(species ? { species } : {}),
      },
      orderBy: [{ species: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        species: true,
        name: true,
        breedType: true,
        allowPedigree: true,
      },
    });
  }
}
