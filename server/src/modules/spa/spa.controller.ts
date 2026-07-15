import { Controller, Get, Post, Body, UseGuards, Req, Patch, Param, Query } from '@nestjs/common';
import { SpaService } from './spa.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { SpaManagerGuard } from '../../common/auth/spa-manager.guard';
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

  // =============================================================
  // SPA MANAGER ENDPOINTS
  // =============================================================

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Get('manager/branches')
  getManagerBranches(@Req() req: AuthenticatedRequest) {
    return this.spaService.getManagerBranches(req.user.id);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Get('manager/brands')
  getManagerBrands(@Req() req: AuthenticatedRequest) {
    return this.spaService.getManagerBrands(req.user.id);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Get('manager/dashboard-stats')
  getManagerDashboardStats(@Req() req: AuthenticatedRequest, @Query('branchId') branchId: string) {
    return this.spaService.getManagerDashboardStats(req.user.id, branchId);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Get('manager/services')
  getManagerServices(@Req() req: AuthenticatedRequest) {
    return this.spaService.getManagerServices(req.user.id);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Post('manager/services')
  createManagerService(@Req() req: AuthenticatedRequest, @Body() dto: any) {
    return this.spaService.createManagerService(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Patch('manager/services/:id')
  updateManagerService(
    @Req() req: AuthenticatedRequest,
    @Param('id') serviceId: string,
    @Body() dto: any,
  ) {
    return this.spaService.updateManagerService(req.user.id, serviceId, dto);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Get('manager/bookings')
  getManagerBookings(@Req() req: AuthenticatedRequest, @Query('branchId') branchId: string) {
    return this.spaService.getManagerBookings(req.user.id, branchId);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Patch('manager/bookings/:id/reschedule')
  rescheduleBooking(
    @Req() req: AuthenticatedRequest,
    @Param('id') bookingId: string,
    @Body('scheduledAt') scheduledAt: string,
  ) {
    return this.spaService.rescheduleBooking(req.user.id, bookingId, scheduledAt);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Patch('manager/bookings/:id/confirm')
  confirmBooking(@Req() req: AuthenticatedRequest, @Param('id') bookingId: string) {
    return this.spaService.confirmBooking(req.user.id, bookingId);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Get('manager/bookings/:id/available-staff')
  getAvailableStaffForBooking(@Req() req: AuthenticatedRequest, @Param('id') bookingId: string) {
    return this.spaService.getAvailableStaffForBooking(req.user.id, bookingId);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Patch('manager/bookings/:id/assign')
  assignStaffToBooking(
    @Req() req: AuthenticatedRequest,
    @Param('id') bookingId: string,
    @Body('staffId') staffId: string,
  ) {
    return this.spaService.assignStaffToBooking(req.user.id, bookingId, staffId);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Get('manager/staffs')
  getManagerStaffs(@Req() req: AuthenticatedRequest, @Query('branchId') branchId: string) {
    return this.spaService.getManagerStaffs(req.user.id, branchId);
  }

  // =============================================================
  // AVAILABILITY ENDPOINT (PUBLIC & MANAGER ACCESS)
  // =============================================================

  @Get('availability')
  getAvailability(
    @Query('branchId') branchId: string,
    @Query('date') dateStr: string,
    @Query('durationMin') durationMin?: string,
  ) {
    return this.spaService.getAvailability(branchId, dateStr, durationMin ? Number(durationMin) : 30);
  }
}
