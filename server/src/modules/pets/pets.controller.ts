import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../common/auth/authenticated-request';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { PetsService } from './pets.service';

@UseGuards(JwtAuthGuard)
@Controller('api/pets')
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @Get('my')
  getMyPets(@Req() request: AuthenticatedRequest) {
    return this.petsService.getMyPets(request.user.id);
  }

  @Post()
  createPet(@Req() request: AuthenticatedRequest, @Body() dto: CreatePetDto) {
    return this.petsService.createPet(request.user.id, dto);
  }

  @Get(':id')
  getPetDetail(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.petsService.getPetDetail(request.user.id, id);
  }

  @Patch(':id')
  updatePet(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdatePetDto,
  ) {
    return this.petsService.updatePet(request.user.id, id, dto);
  }

  @Patch(':id/availability')
  updateAvailability(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.petsService.updateAvailability(request.user.id, id, dto);
  }
}
