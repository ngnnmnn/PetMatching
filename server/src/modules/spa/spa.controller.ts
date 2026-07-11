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

  @Get('staff-list')
  getStaffList() {
    return this.spaService.getStaffList();
  }

  @Get('addresses')
  getSpaAddresses() {
    return this.spaService.getSpaAddresses();
  }

  @UseGuards(JwtAuthGuard)
  @Get('staff/profile')
  getStaffProfile(@Req() req: AuthenticatedRequest) {
    return this.spaService.getStaffProfile(req.user.id);
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

  @UseGuards(JwtAuthGuard)
  @Get('staff/bookings')
  getStaffBookings(@Req() req: AuthenticatedRequest) {
    return this.spaService.getStaffBookings(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('staff/bookings/:id')
  updateStaffBooking(
    @Req() req: AuthenticatedRequest,
    @Param('id') bookingId: string,
    @Body() dto: {
      status?: any;
      petConditionAfter?: string;
      photoAfter?: string;
      issueReported?: string;
    },
  ) {
    return this.spaService.updateStaffBooking(req.user.id, bookingId, dto);
  }
}
