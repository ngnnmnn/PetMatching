import api from '@/lib/axios';
import { SpaBranchType, SpaServiceType, SpaBookingType } from '@/types';

export interface CreateBookingData {
  branchId: string;
  serviceId: string;
  petName?: string;
  scheduledAt: string;
  note?: string;
}

export const spaApi = {
  getBranches: () => api.get<SpaBranchType[]>('/spa/branches'),
  getServices: () => api.get<SpaServiceType[]>('/spa/services'),
  createBooking: (data: CreateBookingData) => api.post<any>('/spa/bookings', data),
  getMyBookings: () => api.get<SpaBookingType[]>('/spa/bookings/my'),
  cancelBooking: (id: string) => api.patch<any>(`/spa/bookings/${id}/cancel`),
};
