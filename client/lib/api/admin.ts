import api from '@/lib/axios';

export type AdminRole = 'USER' | 'ADMIN' | 'MODERATOR' | 'STORE_MANAGER' | 'SPA_MANAGER' | 'SPA_STAFF';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED';
export type ApprovalStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
export type DocumentStatus = 'PENDING' | 'REVIEWING' | 'APPROVED' | 'REJECTED' | 'NEED_MORE_INFO';
export type ComplaintAction =
  | 'DISMISS'
  | 'WARNING'
  | 'HIDE_CONTENT'
  | 'SUSPEND_ACCOUNT'
  | 'RESOLVE'
  | 'ESCALATE';
export type HidePetReason =
  | 'CONTENT_VIOLATION'
  | 'INACCURATE_INFORMATION'
  | 'SUSPECTED_FAKE'
  | 'DOCUMENT_FRAUD'
  | 'UNRESOLVED_REPORT'
  | 'OTHER';
export type RestorePetReason =
  | 'INFORMATION_VERIFIED'
  | 'REPORT_RESOLVED'
  | 'DOCUMENTS_APPROVED'
  | 'ADMIN_REVIEW'
  | 'OTHER';

export type Species = 'DOG' | 'CAT';

export interface BreedRule {
  id: string;
  species: Species;
  breedA: string;
  breedB: string;
  isCompatible: boolean;
  offspringName: string | null;
  warningNote: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BreedRulePayload = Pick<
  BreedRule,
  'species' | 'breedA' | 'breedB' | 'isCompatible' | 'isActive'
> & {
  offspringName?: string;
  warningNote?: string;
};

export interface Breed {
  id: string;
  species: Species;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomBreedItem {
  species: Species;
  name: string;
  isCustom: boolean;
}

export interface BreedCatalogResponse {
  official: Breed[];
  custom: CustomBreedItem[];
}

export type CreateBreedPayload = {
  species: Species;
  name: string;
  isActive?: boolean;
};

export type UpdateBreedPayload = {
  name?: string;
  isActive?: boolean;
};

export const adminApi = {
  dashboard: () => api.get('/admin/dashboard'),
  users: () => api.get('/admin/users'),
  updateUserRole: (id: string, role: AdminRole) => api.patch(`/admin/users/${id}/role`, { role }),
  grantSpaManager: (id: string, allowReassignment = false) =>
    api.patch(`/admin/users/${id}/spa-manager/grant`, { allowReassignment }),
  revokeSpaManager: (id: string, mode: 'UNASSIGN' | 'TRANSFER', newManagerId?: string) =>
    api.patch(`/admin/users/${id}/spa-manager/revoke`, { mode, newManagerId }),
  updateAccountStatus: (id: string, accountStatus: AccountStatus) =>
    api.patch(`/admin/users/${id}/status`, { accountStatus }),
  pets: () => api.get('/admin/pets'),
  pet: (id: string) => api.get(`/admin/pets/${id}`),
  hidePet: (id: string, reason: HidePetReason, note?: string) =>
    api.patch(`/admin/pets/${id}/hide`, { reason, note }),
  restorePet: (id: string, reason: RestorePetReason, note?: string) =>
    api.patch(`/admin/pets/${id}/restore`, { reason, note }),
  petVerifications: () => api.get('/admin/pet-verifications'),
  reviewPetVerification: (id: string, status: DocumentStatus, reviewNote?: string) =>
    api.patch(`/admin/pet-verifications/${id}/review`, { status, reviewNote }),
  matchingReports: () => api.get('/admin/matching-reports'),
  matchingReport: (id: string) => api.get(`/admin/matching-reports/${id}`),
  resolveMatchingReport: (id: string) => api.patch(`/admin/matching-reports/${id}/resolve`),
  breedRules: (params?: { species?: Species; active?: string; search?: string }) =>
    api.get<BreedRule[]>('/admin/breed-rules', { params }),
  createBreedRule: (data: BreedRulePayload) => api.post<BreedRule>('/admin/breed-rules', data),
  updateBreedRule: (id: string, data: BreedRulePayload) =>
    api.patch<BreedRule>(`/admin/breed-rules/${id}`, data),
  deleteBreedRule: (id: string) => api.delete(`/admin/breed-rules/${id}`),
  breeds: (params?: { species?: Species; search?: string }) =>
    api.get<BreedCatalogResponse>('/admin/breeds', { params }),
  createBreed: (data: CreateBreedPayload) => api.post<Breed>('/admin/breeds', data),
  updateBreed: (id: string, data: UpdateBreedPayload) =>
    api.patch<Breed>(`/admin/breeds/${id}`, data),
  deleteBreed: (id: string) => api.delete(`/admin/breeds/${id}`),
  stores: () => api.get('/admin/stores'),
  systemProfile: () => api.get('/admin/system-profile'),
  updateSystemProfile: (data: { name: string; description?: string; address: string; phone: string; storeStatus: ApprovalStatus; spaStatus: ApprovalStatus }) =>
    api.put('/admin/system-profile', data),
  storeDashboard: () => api.get('/admin/store-dashboard'),
  storeProducts: () => api.get('/admin/store-products'),
  storeOrders: () => api.get('/admin/store-orders'),
  spas: () => api.get('/admin/spas'),
  spaDashboard: () => api.get('/admin/spa-dashboard'),
  spaServices: () => api.get('/admin/spa-services'),
  spaStaffSchedule: () => api.get('/admin/spa-staff-schedule'),
  spaBookings: () => api.get('/admin/spa-bookings'),
  complaints: (type?: string) => api.get('/admin/complaints', { params: type ? { type } : undefined }),
  resolveComplaint: (id: string, action: ComplaintAction, adminNote?: string) =>
    api.patch(`/admin/complaints/${id}/resolve`, { action, adminNote }),
};

