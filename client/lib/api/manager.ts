import api from '@/lib/axios';
import { Category, Product, Order } from '@/types';

export interface ManagerDashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalProductsSold: number;
  totalCustomers: number;
  cancellationRate: number;
  statusDistribution?: {
    PENDING: number;
    CONFIRMED: number;
    SHIPPED: number;
    DELIVERED: number;
    CANCELLED: number;
  };
}

/**
 * Kiểu dữ liệu sản phẩm quản lý cho Store Manager (kế thừa từ Product chung)
 */
export interface ManagerProduct extends Omit<Product, 'variants' | 'targetSpecies' | 'reviewCount' | 'images' | 'rating' | 'specifications'> {
  targetSpecies: string;
  description?: string;
  imageUrl?: string;
  images?: string[];
  specifications?: Record<string, unknown> | string | null;
  sellingPrice: number;
  importPrice?: number | null;
  salePrice?: number | null;
  brand?: string;
  rating?: number;
  reviewCount?: number;
  stock?: number | null;
  sales?: number;
  isActive: boolean;
  isFeatured: boolean;
  variants?: ManagerProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface ManagerProductVariantInput {
  name: string;
  sellingPrice: number;
  salePrice?: number | null;
  importPrice?: number | null;
  stock: number;
  weightKg?: number | null;
  imageUrl?: string | null;
  isActive?: boolean;
}

export type ManagerProductInput = Partial<
  Omit<ManagerProduct, 'id' | 'variants'>
> & {
  variants?: ManagerProductVariantInput[];
  discountType?: 'NONE' | 'AMOUNT' | 'PERCENT';
  discountValue?: number;
};

export interface ImportProductsResult {
  success: boolean;
  updatedCount: number;
  createdCount: number;
  errors: string[];
}

/**
 * Kiểu dữ liệu đơn hàng cho Store Manager (kế thừa từ Order chung)
 */
export interface ManagerOrder extends Omit<Order, 'user' | 'items' | 'status' | 'payment'> {
  status: string;
  user: {
    id: string | null;
    name: string;
    email: string;
    phone?: string | null;
  } | null;
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
  /// Mã vận đơn Giao Hàng Nhanh (GHN)
  ghnOrderCode?: string | null;
  /// Mã vận đơn AhaMove hỏa tốc
  ahamoveOrderCode?: string | null;
  deliveryProofUrl?: string | null;
  shippingNote?: string | null;
  payment?: {
    id: string;
    method: string;
    status: string;
    amount: number;
    orderCode?: number | null;
  } | null;
  refundStatus?: string | null;
  refundBankCode?: string | null;
  refundAccountNumber?: string | null;
  refundAccountName?: string | null;
  refundReason?: string | null;
  refundedAt?: string | null;
  refundProofUrl?: string | null;
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

export const managerApi = {
  getDashboardStats: () =>
    api.get<ManagerDashboardStats>('/manager/dashboard-stats'),
  getProducts: () => api.get<ManagerProduct[]>('/manager/products'),
  createProduct: (data: ManagerProductInput) =>
    api.post<ManagerProduct>('/manager/products', data),
  updateProduct: (id: string, data: ManagerProductInput) =>
    api.put<ManagerProduct>(`/manager/products/${id}`, data),
  deleteProduct: (id: string) => api.delete(`/manager/products/${id}`),

  getOrders: () => api.get<ManagerOrder[]>('/manager/orders'),
  updateOrderStatus: (
    id: string,
    status: string,
    deliveryProofUrl?: string,
    shippingNote?: string,
  ) =>
    api.patch<ManagerOrder>(`/manager/orders/${id}/status`, {
      status,
      deliveryProofUrl,
      shippingNote,
    }),
  uploadRefundProof: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ url: string }>(
      '/manager/orders/upload-refund-proof',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
  },
  approveRefund: (id: string, refundProofUrl?: string) =>
    api.post<unknown>(`/manager/orders/${id}/approve-refund`, {
      refundProofUrl,
    }),
  rejectRefund: (id: string) =>
    api.post<unknown>(`/manager/orders/${id}/reject-refund`),
  updateRefundProof: (id: string, refundProofUrl: string) =>
    api.patch<ManagerOrder>(`/manager/orders/${id}/refund-proof`, {
      refundProofUrl,
    }),
  exportOrders: (params: {
    startDate?: string;
    endDate?: string;
    onlyRefunded?: boolean;
  }) =>
    api.get<Blob>('/manager/orders/export', {
      params,
      responseType: 'blob',
    }),

  getCustomers: () => api.get<ManagerCustomer[]>('/manager/customers'),

  createCategory: (data: { name: string }) =>
    api.post<Category>('/manager/categories', data),
  updateCategory: (id: string, data: { name: string }) =>
    api.put<Category>(`/manager/categories/${id}`, data),
  deleteCategory: (id: string) => api.delete(`/manager/categories/${id}`),

  getProductVariants: (productId: string) =>
    api.get<ManagerProductVariant[]>(`/manager/products/${productId}/variants`),
  createProductVariant: (productId: string, data: ManagerProductVariantInput) =>
    api.post<ManagerProductVariant>(
      `/manager/products/${productId}/variants`,
      data,
    ),
  updateProductVariant: (
    variantId: string,
    data: Partial<ManagerProductVariantInput>,
  ) => api.put<ManagerProductVariant>(`/manager/variants/${variantId}`, data),
  deleteProductVariant: (variantId: string) =>
    api.delete(`/manager/variants/${variantId}`),

  importProducts: (file: File, images: File[] = []) => {
    const formData = new FormData();
    formData.append('file', file);
    images.forEach((img) => {
      const pathParts = (
        img as File & { webkitRelativePath?: string }
      ).webkitRelativePath?.split('/');
      const folderName =
        pathParts && pathParts.length >= 2
          ? pathParts[pathParts.length - 2]
          : '';
      if (folderName) {
        formData.append('images', img, `${folderName}_${img.name}`);
      } else {
        formData.append('images', img);
      }
    });
    return api.post<ImportProductsResult>(
      '/manager/products/import',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
  },
};

export interface ManagerProductVariant {
  id: string;
  productId: string;
  name: string;
  sellingPrice: number;
  salePrice?: number | null;
  importPrice?: number | null;
  stock: number;
  weightKg?: number | null;
  sales?: number;
  imageUrl?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}
