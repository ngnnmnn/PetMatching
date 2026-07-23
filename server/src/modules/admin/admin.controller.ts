import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import {
  AccountStatus,
  ApprovalStatus,
  ComplaintStatus,
  ComplaintType,
  DocumentStatus,
  PetStatus,
  Species,
  UserRole,
} from '@prisma/client';
import { AdminGuard } from '../../common/auth/admin.guard';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../common/auth/authenticated-request';
import { AdminService } from './admin.service';
import {
  GrantSpaManagerDto,
  CreateBreedRuleDto,
  HidePetDto,
  RevokeSpaManagerDto,
  RestorePetDto,
  ResolveComplaintDto,
  ReviewPetDocumentDto,
  UpdateAccountStatusDto,
  UpdateApprovalStatusDto,
  UpdateUserRoleDto,
  UpdateBreedRuleDto,
} from './dto/admin-actions.dto';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('api/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('users')
  getUsers(
    @Query('role') role?: UserRole,
    @Query('accountStatus') accountStatus?: AccountStatus,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers({ role, accountStatus, search });
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  @Patch('users/:id/role')
  updateUserRole(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(request.user, id, dto);
  }

  @Patch('users/:id/status')
  updateUserStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAccountStatusDto,
  ) {
    return this.adminService.updateAccountStatus(request.user, id, dto);
  }

  @Patch('users/:id/spa-manager/grant')
  grantSpaManager(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: GrantSpaManagerDto,
  ) {
    return this.adminService.grantSpaManager(request.user, id, dto);
  }

  @Patch('users/:id/spa-manager/revoke')
  revokeSpaManager(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: RevokeSpaManagerDto,
  ) {
    return this.adminService.revokeSpaManager(request.user, id, dto);
  }

  @Get('pets')
  getPets(
    @Query('verified') verified?: string,
    @Query('status') status?: PetStatus,
    @Query('search') search?: string,
  ) {
    return this.adminService.getPets({ verified, status, search });
  }

  @Get('pets/:id')
  getPet(@Param('id') id: string) {
    return this.adminService.getPet(id);
  }

  @Patch('pets/:id/hide')
  hidePet(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: HidePetDto,
  ) {
    return this.adminService.hidePet(request.user, id, dto);
  }

  @Patch('pets/:id/restore')
  restorePet(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: RestorePetDto,
  ) {
    return this.adminService.restorePet(request.user, id, dto);
  }

  @Get('pet-verifications')
  getPetDocuments(@Query('status') status?: DocumentStatus) {
    return this.adminService.getPetDocuments({ status });
  }

  @Patch('pet-verifications/:id/review')
  reviewPetDocument(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ReviewPetDocumentDto,
  ) {
    return this.adminService.reviewPetDocument(request.user, id, dto);
  }

  @Get('matching-reports')
  getMatchingReports() {
    return this.adminService.getMatchingReports();
  }

  @Get('breed-rules')
  getBreedRules(
    @Query('species') species?: Species,
    @Query('active') active?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getBreedRules({ species, active, search });
  }

  @Post('breed-rules')
  createBreedRule(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateBreedRuleDto,
  ) {
    return this.adminService.createBreedRule(request.user, dto);
  }

  @Patch('breed-rules/:id')
  updateBreedRule(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateBreedRuleDto,
  ) {
    return this.adminService.updateBreedRule(request.user, id, dto);
  }

  @Delete('breed-rules/:id')
  deleteBreedRule(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.adminService.deleteBreedRule(request.user, id);
  }

  @Patch('matching-reports/:id/resolve')
  resolveMatchingReport(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.adminService.resolveMatchingReport(request.user, id);
  }

  @Get('stores')
  getStores(@Query('status') status?: ApprovalStatus) {
    return this.adminService.getStores({ status });
  }

  @Get('store-dashboard')
  getStoreDashboard() {
    return this.adminService.getStoreDashboard();
  }

  @Put('store-settings')
  updateStoreSettings(
    @Req() request: AuthenticatedRequest,
    @Body() dto: { name: string; phone?: string; address?: string; description?: string },
  ) {
    return this.adminService.updateStoreSettings(request.user, dto);
  }

  @Get('store-products')
  getStoreProducts(@Query('storeId') storeId?: string) {
    return this.adminService.getStoreProducts(storeId);
  }

  @Get('store-orders')
  getStoreOrders(@Query('storeId') storeId?: string) {
    return this.adminService.getStoreOrders(storeId);
  }

  @Get('spas')
  getSpaBranches(@Query('status') status?: ApprovalStatus) {
    return this.adminService.getSpaBranches({ status });
  }

  @Get('spa-dashboard')
  getSpaDashboard() {
    return this.adminService.getSpaDashboard();
  }

  @Get('spa-services')
  getSpaServices() {
    return this.adminService.getSpaServices();
  }

  @Get('spa-staff-schedule')
  getSpaStaffSchedule() {
    return this.adminService.getSpaStaffSchedule();
  }

  @Put('spa-settings')
  updateSpaSettings(
    @Req() request: AuthenticatedRequest,
    @Body() dto: { name: string; phone?: string; address: string; description?: string; status?: ApprovalStatus },
  ) {
    return this.adminService.updateSpaSettings(request.user, dto);
  }

  @Patch('spas/:id/status')
  updateSpaBranchStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateApprovalStatusDto,
  ) {
    return this.adminService.updateSpaBranchStatus(request.user, id, dto);
  }

  @Get('spa-bookings')
  getSpaBookings(@Query('branchId') branchId?: string) {
    return this.adminService.getSpaBookings(branchId);
  }

  @Get('complaints')
  getComplaints(@Query('type') type?: ComplaintType, @Query('status') status?: ComplaintStatus) {
    return this.adminService.getComplaints({ type, status });
  }

  @Patch('complaints/:id/resolve')
  resolveComplaint(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ResolveComplaintDto,
  ) {
    return this.adminService.resolveComplaint(request.user, id, dto);
  }

}
