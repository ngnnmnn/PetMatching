import api from '@/lib/axios';

export type AdminRole = 'USER' | 'ADMIN' | 'MODERATOR' | 'STORE_MANAGER' | 'SPA_MANAGER' | 'SPA_STAFF';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_MANAGER';
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

export const adminApi = {
  dashboard: () => api.get('/admin/dashboard'),
  users: () => api.get('/admin/users'),
  updateUserRole: (id: string, role: AdminRole) => api.patch(`/admin/users/${id}/role`, { role }),
  grantSpaManager: (id: string, branchIds: string[], allowReassignment = false) =>
    api.patch(`/admin/users/${id}/spa-manager/grant`, { branchIds, allowReassignment }),
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
  resolveMatchingReport: (id: string) => api.patch(`/admin/matching-reports/${id}/resolve`),
  stores: () => api.get('/admin/stores'),
  updateStoreSettings: (data: { name: string; phone?: string; address?: string; description?: string }) =>
    api.put('/admin/store-settings', data),
  storeProducts: () => api.get('/admin/store-products'),
  storeOrders: () => api.get('/admin/store-orders'),
  spas: () => api.get('/admin/spas'),
  updateSpaStatus: (id: string, status: ApprovalStatus) => api.patch(`/admin/spas/${id}/status`, { status }),
  spaBookings: () => api.get('/admin/spa-bookings'),
  complaints: (type?: string) => api.get('/admin/complaints', { params: type ? { type } : undefined }),
  resolveComplaint: (id: string, action: ComplaintAction, adminNote?: string) =>
    api.patch(`/admin/complaints/${id}/resolve`, { action, adminNote }),
};
