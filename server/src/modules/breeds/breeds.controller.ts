import { Controller, Get, Query } from '@nestjs/common';
import { Species } from '@prisma/client';
import { BreedsService } from './breeds.service';

@Controller('api/breeds')
export class BreedsController {
  constructor(private readonly breedsService: BreedsService) {}

  @Get()
  getBreeds(@Query('species') species?: Species) {
    return this.breedsService.getBreeds(species);
  }
}
