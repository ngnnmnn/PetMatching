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
};
