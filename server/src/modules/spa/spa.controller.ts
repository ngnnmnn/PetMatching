import { Controller, Get, Post, Body, UseGuards, Req, Patch, Param, Query, Delete } from '@nestjs/common';
import { SpaService } from './spa.service';
import { CreateBookingDto, AddSubServicesDto, ManagerReassignDto, ManagerRescheduleDto, ManagerCancelBookingDto, RescheduleBookingDto, ManagerUpdateServicesDto, CreateStaffDto, CreateSpaFeedbackDto, CompleteSpaPaymentDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { SpaManagerGuard } from '../../common/auth/spa-manager.guard';
import type { AuthenticatedRequest } from '../../common/auth/authenticated-request';
import { Species } from '@prisma/client';

@Controller('api/spa')
export class SpaController {
  constructor(private readonly spaService: SpaService) {}

  @Get('branches')
  getBranches() {
    return this.spaService.getBranches();
  }

  @Get('categories')
  getCategories() {
    return this.spaService.getCategories();
  }

  @Get('services')
  getServices(@Query('species') species?: Species, @Query('weight') weight?: string) {
    return this.spaService.getServices(species, weight ? Number(weight) : undefined);
  }

  @Get('staff-list')
  getStaffList() {
    return this.spaService.getStaffList();
  }

  @Get('addresses')
  getSpaAddresses() {
    return this.spaService.getSpaAddresses();
  }

  @Get('feedbacks')
  getPublicFeedbacks() {
    return this.spaService.getPublicFeedbacks();
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
  @Patch('bookings/:id/reschedule')
  userRescheduleBooking(
    @Req() req: AuthenticatedRequest,
    @Param('id') bookingId: string,
    @Body() dto: RescheduleBookingDto,
  ) {
    return this.spaService.userRescheduleBooking(req.user.id, bookingId, dto.scheduledAt);
  }

  @UseGuards(JwtAuthGuard)
  @Post('bookings/:id/feedback')
  createFeedback(
    @Req() req: AuthenticatedRequest,
    @Param('id') bookingId: string,
    @Body() dto: CreateSpaFeedbackDto,
  ) {
    return this.spaService.createFeedback(req.user.id, bookingId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('staff/bookings')
  getStaffBookings(@Req() req: AuthenticatedRequest) {
    return this.spaService.getStaffBookings(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('staff/bookings/:id/checkin')
  staffCheckIn(@Req() req: AuthenticatedRequest, @Param('id') bookingId: string) {
    return this.spaService.staffCheckIn(req.user.id, bookingId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('staff/bookings/:id/sub-services')
  staffAddSubServices(
    @Req() req: AuthenticatedRequest,
    @Param('id') bookingId: string,
    @Body() dto: AddSubServicesDto,
  ) {
    return this.spaService.staffAddSubServices(req.user.id, bookingId, dto.subServiceIds);
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

  @UseGuards(JwtAuthGuard)
  @Post('staff/bookings/:id/complete-payment')
  completeStaffBooking(
    @Req() req: AuthenticatedRequest,
    @Param('id') bookingId: string,
    @Body() dto: CompleteSpaPaymentDto,
  ) {
    return this.spaService.completeStaffBooking(req.user.id, bookingId, dto);
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
  @Get('manager/categories')
  getManagerCategories(@Req() req: AuthenticatedRequest) {
    return this.spaService.getManagerCategories(req.user?.id);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Post('manager/categories')
  createManagerCategory(@Req() req: AuthenticatedRequest, @Body() dto: any) {
    return this.spaService.createManagerCategory(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Patch('manager/categories/:id')
  updateManagerCategory(
    @Req() req: AuthenticatedRequest,
    @Param('id') categoryId: string,
    @Body() dto: any,
  ) {
    return this.spaService.updateManagerCategory(req.user.id, categoryId, dto);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Delete('manager/categories/:id')
  deleteManagerCategory(@Req() req: AuthenticatedRequest, @Param('id') categoryId: string) {
    return this.spaService.deleteManagerCategory(req.user.id, categoryId);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Get('manager/brands')
  getManagerBrands(@Req() req: AuthenticatedRequest) {
    return this.spaService.getManagerCategories(req.user.id);
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
    @Body() dto: ManagerRescheduleDto,
  ) {
    return this.spaService.rescheduleBooking(req.user.id, bookingId, dto.scheduledAt);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Patch('manager/bookings/:id/reassign')
  managerReassignStaff(
    @Req() req: AuthenticatedRequest,
    @Param('id') bookingId: string,
    @Body() dto: ManagerReassignDto,
  ) {
    return this.spaService.managerReassignStaff(req.user.id, bookingId, dto.staffId);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Patch('manager/bookings/:id/late-discount')
  managerApplyLateDiscount(
    @Req() req: AuthenticatedRequest,
    @Param('id') bookingId: string,
  ) {
    return this.spaService.managerApplyLateDiscount(req.user.id, bookingId);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Patch('manager/bookings/:id/update-services')
  managerUpdateBookingServices(
    @Req() req: AuthenticatedRequest,
    @Param('id') bookingId: string,
    @Body() dto: ManagerUpdateServicesDto,
  ) {
    return this.spaService.managerUpdateBookingServices(req.user.id, bookingId, dto.mainServiceId, dto.subServiceIds);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Get('manager/staff-performance')
  getManagerStaffPerformance(
    @Req() req: AuthenticatedRequest,
    @Query('branchId') branchId: string,
    @Query('filter') filter?: 'ALL' | 'ON_TIME' | 'LATE',
  ) {
    return this.spaService.getManagerStaffPerformance(req.user.id, branchId, filter);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Patch('manager/bookings/:id/confirm')
  confirmBooking(@Req() req: AuthenticatedRequest, @Param('id') bookingId: string) {
    return this.spaService.confirmBooking(req.user.id, bookingId);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Patch('manager/bookings/:id/cancel')
  managerCancelBooking(
    @Req() req: AuthenticatedRequest,
    @Param('id') bookingId: string,
    @Body() dto: ManagerCancelBookingDto,
  ) {
    return this.spaService.managerCancelBooking(req.user.id, bookingId, dto.reason);
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

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Post('manager/staffs')
  createManagerStaff(@Req() req: AuthenticatedRequest, @Body() dto: CreateStaffDto) {
    return this.spaService.createManagerStaff(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Patch('manager/staffs/:id/toggle-status')
  toggleStaffStatus(@Req() req: AuthenticatedRequest, @Param('id') staffId: string) {
    return this.spaService.toggleStaffStatus(req.user.id, staffId);
  }

  @UseGuards(JwtAuthGuard, SpaManagerGuard)
  @Get('manager/feedbacks')
  getManagerFeedbacks(@Req() req: AuthenticatedRequest, @Query('branchId') branchId?: string) {
    return this.spaService.getManagerFeedbacks(req.user.id, branchId);
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
