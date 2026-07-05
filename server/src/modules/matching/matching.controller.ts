import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../common/auth/authenticated-request';
import { CreateMatchingRequestDto } from './dto/create-matching-request.dto';
import { GetCandidatesDto } from './dto/get-candidates.dto';
import { PassPetDto } from './dto/pass-pet.dto';
import { MatchingService } from './matching.service';

@UseGuards(JwtAuthGuard)
@Controller('api/matching')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Get('candidates')
  getCandidates(@Req() request: AuthenticatedRequest, @Query() dto: GetCandidatesDto) {
    return this.matchingService.getCandidates(request.user.id, dto);
  }

  @Post('pass')
  passPet(@Req() request: AuthenticatedRequest, @Body() dto: PassPetDto) {
    return this.matchingService.passPet(request.user.id, dto);
  }

  @Post('requests')
  createRequest(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateMatchingRequestDto,
  ) {
    return this.matchingService.createRequest(request.user.id, dto);
  }

  @Get('requests/incoming')
  getIncomingRequests(@Req() request: AuthenticatedRequest) {
    return this.matchingService.getIncomingRequests(request.user.id);
  }

  @Post('requests/:id/accept')
  acceptRequest(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.matchingService.acceptRequest(request.user.id, id);
  }

  @Post('requests/:id/reject')
  rejectRequest(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.matchingService.rejectRequest(request.user.id, id);
  }

  @Get('matches')
  getMatches(@Req() request: AuthenticatedRequest) {
    return this.matchingService.getMatches(request.user.id);
  }
}
