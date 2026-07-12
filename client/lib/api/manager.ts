import api from '@/lib/axios';

export interface ManagerDashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalProductsSold: number;
  totalCustomers: number;
  cancellationRate: number;
}

export interface ManagerProduct {
  id: string;
  name: string;
  slug?: string;
  category: string;
  targetSpecies: string;
  description?: string;
  imageUrl?: string;
  images?: string[];
  specifications?: any;
  originalPrice: number;
  salePrice?: number | null;
  brand?: string;
  unit?: string;
  rating?: number;
  reviewCount?: number;
  stock?: number | null;
  sales?: number;
  isActive: boolean;
  isFeatured: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ManagerOrder {
  id: string;
  userId: string;
  status: string;
  totalAmount: number;
  shippingAddress: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  items: {
    id: string;
    productId: string;
    quantity: number;
    price: number;
    product: {
      id: string;
      name: string;
      imageUrl?: string;
    };
  }[];
}

export interface ManagerCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalOrders: number;
  totalCancelled: number;
  spent: number;
}

export interface StoreSettings {
  id: string;
  name: string;
  phone: string;
  address: string;
  description?: string;
}

export const managerApi = {
  getDashboardStats: () => api.get<ManagerDashboardStats>('/manager/dashboard-stats'),
  
  getProducts: () => api.get<ManagerProduct[]>('/manager/products'),
  createProduct: (data: Partial<ManagerProduct>) => api.post<ManagerProduct>('/manager/products', data),
  updateProduct: (id: string, data: Partial<ManagerProduct>) => api.put<ManagerProduct>(`/manager/products/${id}`, data),
  deleteProduct: (id: string) => api.delete(`/manager/products/${id}`),

  getOrders: () => api.get<ManagerOrder[]>('/manager/orders'),
  updateOrderStatus: (id: string, status: string) => api.patch<ManagerOrder>(`/manager/orders/${id}/status`, { status }),

  getCustomers: () => api.get<ManagerCustomer[]>('/manager/customers'),

  getStoreSettings: () => api.get<StoreSettings>('/manager/store-settings'),
  updateStoreSettings: (data: Partial<StoreSettings>) => api.put<StoreSettings>('/manager/store-settings', data),
};
