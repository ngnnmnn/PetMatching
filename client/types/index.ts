export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
  phone?: string;
  isVerified: boolean;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  accessToken?: string;
  user?: User;
  requiresVerification?: boolean;
  email?: string;
}

export interface Address {
  id: string;
  userId: string;
  receiverName: string;
  receiverPhone: string;
  province: string;
  district: string;
  ward: string;
  detail: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
  product?: {
    id: string;
    name: string;
    imageUrl?: string | null;
  };
}

export interface Order {
  id: string;
  userId: string;
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  totalAmount: number;
  shippingAddress: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ProfileResponse extends User {
  addresses: Address[];
  orders: Order[];
  stats: {
    pets: number;
    orders: number;
    totalSpent: number;
  };
}

export interface UpdateProfileData {
  name?: string;
  phone?: string;
  avatarUrl?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone?: string;
  avatarUrl?: string;
}

export type ProductCategory =
  | 'DOG_FOOD'
  | 'CAT_FOOD'
  | 'TOY'
  | 'ACCESSORY'
  | 'GROOMING'
  | 'CAGE_BED'
  | 'LEASH_COLLAR'
  | 'MEDICAL';

export interface Product {
  id: string;
  name: string;
  slug?: string;
  category: ProductCategory;
  targetSpecies: 'DOG' | 'CAT' | 'ALL';
  description?: string;
  imageUrl?: string;
  images: string[];
  originalPrice: number;
  salePrice?: number | null;
  brand?: string;
  unit?: string;
  rating: number;
  reviewCount: number;
  stock?: number | null;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
