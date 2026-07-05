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

export const adminApi = {
  dashboard: () => api.get('/admin/dashboard'),
  users: () => api.get('/admin/users'),
  updateUserRole: (id: string, role: AdminRole) => api.patch(`/admin/users/${id}/role`, { role }),
  updateAccountStatus: (id: string, accountStatus: AccountStatus) =>
    api.patch(`/admin/users/${id}/status`, { accountStatus }),
  pets: () => api.get('/admin/pets'),
  hidePet: (id: string) => api.patch(`/admin/pets/${id}/hide`),
  petVerifications: () => api.get('/admin/pet-verifications'),
  reviewPetVerification: (id: string, status: DocumentStatus, reviewNote?: string) =>
    api.patch(`/admin/pet-verifications/${id}/review`, { status, reviewNote }),
  matchingReports: () => api.get('/admin/matching-reports'),
  resolveMatchingReport: (id: string) => api.patch(`/admin/matching-reports/${id}/resolve`),
  stores: () => api.get('/admin/stores'),
  updateStoreStatus: (id: string, status: ApprovalStatus) => api.patch(`/admin/stores/${id}/status`, { status }),
  storeProducts: () => api.get('/admin/store-products'),
  storeOrders: () => api.get('/admin/store-orders'),
  spas: () => api.get('/admin/spas'),
  updateSpaStatus: (id: string, status: ApprovalStatus) => api.patch(`/admin/spas/${id}/status`, { status }),
  spaServices: () => api.get('/admin/spa-services'),
  spaBookings: () => api.get('/admin/spa-bookings'),
  complaints: (type?: string) => api.get('/admin/complaints', { params: type ? { type } : undefined }),
  resolveComplaint: (id: string, action: ComplaintAction, adminNote?: string) =>
    api.patch(`/admin/complaints/${id}/resolve`, { action, adminNote }),
  analytics: () => api.get('/admin/analytics'),
  settings: () => api.get('/admin/settings'),
  upsertSetting: (key: string, value: unknown) => api.post('/admin/settings', { key, value: JSON.stringify(value) }),
  auditLogs: () => api.get('/admin/audit-logs'),
};
