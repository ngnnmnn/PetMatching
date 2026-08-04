import api from '@/lib/axios';
import { SpaBranchType, SpaServiceType, SpaBookingType, AddressSpaType, SpaStaffProfileType } from '@/types';

export interface CreateBookingData {
  branchId?: string;
  addressSpaId?: string;
  serviceId?: string;
  mainServiceId?: string;
  subServiceIds?: string[];
  petName?: string;
  petSpecies?: 'DOG' | 'CAT';
  petWeight?: number;
  petId?: string;
  staffId?: string;
  scheduledAt: string;
  note?: string;
}

export const spaApi = {
  getCategories: () => api.get<any[]>('/spa/categories'),
  getBranches: () => api.get<SpaBranchType[]>('/spa/branches'),
  getServices: (species?: string, weight?: number) => {
    const params = new URLSearchParams();
    if (species) params.append('species', species);
    if (weight !== undefined) params.append('weight', weight.toString());
    const query = params.toString();
    return api.get<SpaServiceType[]>(`/spa/services${query ? `?${query}` : ''}`);
  },
  getSpaAddresses: () => api.get<AddressSpaType[]>('/spa/addresses'),
  getStaffList: () => api.get<any[]>('/spa/staff-list'),
  getStaffProfile: () => api.get<SpaStaffProfileType>('/spa/staff/profile'),
  createBooking: (data: CreateBookingData) => api.post<any>('/spa/bookings', data),
  getMyBookings: () => api.get<SpaBookingType[]>('/spa/bookings/my'),
  cancelBooking: (id: string) => api.patch<any>(`/spa/bookings/${id}/cancel`),
  createFeedback: (id: string, data: { rateStaff: number; rateServices: number; comment?: string }) =>
    api.post<any>(`/spa/bookings/${id}/feedback`, data),
  
  // Staff APIs
  getStaffBookings: () => api.get<SpaBookingType[]>('/spa/staff/bookings'),
  staffCheckIn: (id: string) => api.patch<SpaBookingType>(`/spa/staff/bookings/${id}/checkin`),
  staffAddSubServices: (id: string, subServiceIds: string[]) =>
    api.post<SpaBookingType>(`/spa/staff/bookings/${id}/sub-services`, { subServiceIds }),
  updateStaffBooking: (id: string, data: {
    status?: string;
    petConditionAfter?: string;
    photoAfter?: string | null;
    issueReported?: string | null;
  }) => api.patch<SpaBookingType>(`/spa/staff/bookings/${id}`, data),

  // Spa Manager API Methods
  getManagerBranches: () => api.get<AddressSpaType[]>('/spa/manager/branches'),
  getManagerCategories: () => api.get<any[]>('/spa/manager/categories'),
  createManagerCategory: (data: any) => api.post<any>('/spa/manager/categories', data),
  updateManagerCategory: (id: string, data: any) => api.patch<any>(`/spa/manager/categories/${id}`, data),
  deleteManagerCategory: (id: string) => api.delete<any>(`/spa/manager/categories/${id}`),
  getManagerBrands: () => api.get<any[]>('/spa/manager/brands'),
  getManagerDashboardStats: (branchId: string) => api.get<any>(`/spa/manager/dashboard-stats?branchId=${branchId}`),
  getManagerServices: () => api.get<any[]>('/spa/manager/services'),
  createManagerService: (data: any) => api.post<any>('/spa/manager/services', data),
  updateManagerService: (id: string, data: any) => api.patch<any>(`/spa/manager/services/${id}`, data),
  getManagerBookings: (branchId: string) => api.get<any[]>(`/spa/manager/bookings?branchId=${branchId}`),
  rescheduleBooking: (id: string, scheduledAt: string) => api.patch<any>(`/spa/manager/bookings/${id}/reschedule`, { scheduledAt }),
  reassignStaff: (id: string, staffId: string) => api.patch<any>(`/spa/manager/bookings/${id}/reassign`, { staffId }),
  applyLateDiscount: (id: string) => api.patch<any>(`/spa/manager/bookings/${id}/late-discount`),
  updateManagerBookingServices: (id: string, mainServiceId: string, subServiceIds?: string[]) =>
    api.patch<any>(`/spa/manager/bookings/${id}/update-services`, { mainServiceId, subServiceIds }),
  getManagerStaffPerformance: (branchId: string, filter?: string) =>
    api.get<any[]>(`/spa/manager/staff-performance?branchId=${branchId}${filter ? `&filter=${filter}` : ''}`),
  confirmBooking: (id: string) => api.patch<any>(`/spa/manager/bookings/${id}/confirm`),
  getAvailableStaffForBooking: (id: string) => api.get<any[]>(`/spa/manager/bookings/${id}/available-staff`),
  assignStaff: (id: string, staffId: string) => api.patch<any>(`/spa/manager/bookings/${id}/assign`, { staffId }),
  getManagerStaffs: (branchId: string) => api.get<any[]>(`/spa/manager/staffs?branchId=${branchId}`),
  createManagerStaff: (data: { username: string; password: string; fullname: string; phone: string; branchId?: string }) =>
    api.post<any>('/spa/manager/staffs', data),
  toggleStaffStatus: (id: string) => api.patch<any>(`/spa/manager/staffs/${id}/toggle-status`),
  getManagerFeedbacks: (branchId?: string) =>
    api.get<any[]>(`/spa/manager/feedbacks${branchId ? `?branchId=${branchId}` : ''}`),
  getAvailability: (branchId: string, date: string, durationMin?: number) =>
    api.get<any[]>(`/spa/availability?branchId=${branchId}&date=${date}${durationMin ? `&durationMin=${durationMin}` : ''}`),
};
