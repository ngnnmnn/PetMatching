import api from '@/lib/axios';
import { SpaBranchType, SpaServiceType, SpaBookingType, AddressSpaType, SpaStaffProfileType } from '@/types';

export interface CreateBookingData {
  branchId?: string;
  addressSpaId?: string;
  serviceId: string;
  petName?: string;
  petId?: string;
  staffId?: string;
  scheduledAt: string;
  note?: string;
}

export const spaApi = {
  getBranches: () => api.get<SpaBranchType[]>('/spa/branches'),
  getServices: () => api.get<SpaServiceType[]>('/spa/services'),
  getSpaAddresses: () => api.get<AddressSpaType[]>('/spa/addresses'),
  getStaffList: () => api.get<any[]>('/spa/staff-list'),
  getStaffProfile: () => api.get<SpaStaffProfileType>('/spa/staff/profile'),
  createBooking: (data: CreateBookingData) => api.post<any>('/spa/bookings', data),
  getMyBookings: () => api.get<SpaBookingType[]>('/spa/bookings/my'),
  cancelBooking: (id: string) => api.patch<any>(`/spa/bookings/${id}/cancel`),
  getStaffBookings: () => api.get<SpaBookingType[]>('/spa/staff/bookings'),
  updateStaffBooking: (id: string, data: {
    status?: string;
    petConditionAfter?: string;
    photoAfter?: string;
    issueReported?: string;
  }) => api.patch<SpaBookingType>(`/spa/staff/bookings/${id}`, data),

  // Spa Manager API Methods
  getManagerBranches: () => api.get<AddressSpaType[]>('/spa/manager/branches'),
  getManagerBrands: () => api.get<any[]>('/spa/manager/brands'),
  getManagerDashboardStats: (branchId: string) => api.get<any>(`/spa/manager/dashboard-stats?branchId=${branchId}`),
  getManagerServices: () => api.get<any[]>('/spa/manager/services'),
  createManagerService: (data: any) => api.post<any>('/spa/manager/services', data),
  updateManagerService: (id: string, data: any) => api.patch<any>(`/spa/manager/services/${id}`, data),
  getManagerBookings: (branchId: string) => api.get<any[]>(`/spa/manager/bookings?branchId=${branchId}`),
  rescheduleBooking: (id: string, scheduledAt: string) => api.patch<any>(`/spa/manager/bookings/${id}/reschedule`, { scheduledAt }),
  confirmBooking: (id: string) => api.patch<any>(`/spa/manager/bookings/${id}/confirm`),
  getAvailableStaffForBooking: (id: string) => api.get<any[]>(`/spa/manager/bookings/${id}/available-staff`),
  assignStaff: (id: string, staffId: string) => api.patch<any>(`/spa/manager/bookings/${id}/assign`, { staffId }),
  getManagerStaffs: (branchId: string) => api.get<any[]>(`/spa/manager/staffs?branchId=${branchId}`),
  getAvailability: (branchId: string, date: string, durationMin?: number) =>
    api.get<any[]>(`/spa/availability?branchId=${branchId}&date=${date}${durationMin ? `&durationMin=${durationMin}` : ''}`),
};
