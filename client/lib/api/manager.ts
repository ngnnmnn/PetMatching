import api from '@/lib/axios';
import { Category } from '@/types';

export interface ManagerDashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalProductsSold: number;
  totalCustomers: number;
  cancellationRate: number;
  totalProfit?: number;
  profitMargin?: number;
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
  sellingPrice: number;
  importPrice?: number | null;
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
  ghnOrderCode?: string | null;
  refundStatus?: string | null;
  refundBankCode?: string | null;
  refundAccountNumber?: string | null;
  refundAccountName?: string | null;
  refundReason?: string | null;
  refundedAt?: string | null;
}

export interface ManagerCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalOrders: number;
  totalCancelled: number;
  spent: number;
  isNewCustomer?: boolean;
  orders?: {
    id: string;
    status: string;
    totalAmount: number;
    createdAt: string;
    items: {
      id: string;
      productName: string;
      quantity: number;
      price: number;
    }[];
  }[];
}

export interface ProductUnit {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export const managerApi = {
  getDashboardStats: () => api.get<ManagerDashboardStats>('/manager/dashboard-stats'),
  
  getProducts: () => api.get<ManagerProduct[]>('/manager/products'),
  createProduct: (data: Partial<ManagerProduct>) => api.post<ManagerProduct>('/manager/products', data),
  updateProduct: (id: string, data: Partial<ManagerProduct>) => api.put<ManagerProduct>(`/manager/products/${id}`, data),
  deleteProduct: (id: string) => api.delete(`/manager/products/${id}`),

  getOrders: () => api.get<ManagerOrder[]>('/manager/orders'),
  updateOrderStatus: (id: string, status: string) => api.patch<ManagerOrder>(`/manager/orders/${id}/status`, { status }),
  approveRefund: (id: string) => api.post<any>(`/manager/orders/${id}/approve-refund`),
  rejectRefund: (id: string) => api.post<any>(`/manager/orders/${id}/reject-refund`),
  createShippingOrder: (orderId: string) => api.post<any>('/shipping/create-order', { orderId }),
  exportOrders: (params: { startDate?: string; endDate?: string; onlyPendingGhn?: boolean; onlyRefunded?: boolean }) =>
    api.get<Blob>('/manager/orders/export', {
      params,
      responseType: 'blob',
    }),

  getCustomers: () => api.get<ManagerCustomer[]>('/manager/customers'),

  createCategory: (data: { name: string }) => api.post<Category>('/manager/categories', data),
  updateCategory: (id: string, data: { name: string }) => api.put<Category>(`/manager/categories/${id}`, data),
  deleteCategory: (id: string) => api.delete(`/manager/categories/${id}`),

  getProductUnits: () => api.get<ProductUnit[]>('/manager/units'),
  createProductUnit: (data: { name: string }) => api.post<ProductUnit>('/manager/units', data),
  updateProductUnit: (id: string, data: { name: string }) => api.put<ProductUnit>(`/manager/units/${id}`, data),
  deleteProductUnit: (id: string) => api.delete(`/manager/units/${id}`),

  importProducts: (file: File, images: File[] = []) => {
    const formData = new FormData();
    formData.append('file', file);
    images.forEach((img) => {
      const pathParts = (img as any).webkitRelativePath?.split('/');
      const folderName = pathParts && pathParts.length >= 2 ? pathParts[pathParts.length - 2] : '';
      if (folderName) {
        formData.append('images', img, `${folderName}_${img.name}`);
      } else {
        formData.append('images', img);
      }
    });
    return api.post<any>('/manager/products/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
