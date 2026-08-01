import { Injectable } from '@nestjs/common';
import { Species } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class BreedsService {
  constructor(private readonly prisma: PrismaService) {}

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
      },
    });
  }
}
