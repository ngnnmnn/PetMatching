import { Controller, Get, Post, Body, UseGuards, Req, Patch, Param } from '@nestjs/common';
import { SpaService } from './spa.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../common/auth/authenticated-request';

@Controller('api/spa')
export class SpaController {
  constructor(private readonly spaService: SpaService) {}

  @Get('branches')
  getBranches() {
    return this.spaService.getBranches();
  }

  @Get('services')
  getServices() {
    return this.spaService.getServices();
  }

  @UseGuards(JwtAuthGuard)
  @Post('bookings')
  createBooking(@Req() req: AuthenticatedRequest, @Body() dto: CreateBookingDto) {
    return this.spaService.createBooking(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('bookings/my')
  getMyBookings(@Req() req: AuthenticatedRequest) {
    return this.spaService.getMyBookings(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('bookings/:id/cancel')
  cancelBooking(@Req() req: AuthenticatedRequest, @Param('id') bookingId: string) {
    return this.spaService.cancelBooking(req.user.id, bookingId);
  }
}
