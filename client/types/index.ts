export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  accountStatus?: string;
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
  provinceId?: number | null;
  districtId?: number | null;
  wardCode?: string | null;
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
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'EXPIRED' | 'PAYMENT_ERROR';
  totalAmount: number;
  shippingFee?: number;
  shippingAddress: string;
  districtId?: number | null;
  wardCode?: string | null;
  ghnOrderCode?: string | null;
  shippingStatus?: string | null;
  paymentMethod?: string;
  orderCode?: number | null;
  paymentUrl?: string | null;
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

export type ProductCategory = string;

export interface Category {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductReview {
  id: string;
  rating: number;
  comment?: string | null;
  userId: string;
  productId: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
}

export interface Product {
  id: string;
  name: string;
  slug?: string;
  category: ProductCategory;
  targetSpecies: 'DOG' | 'CAT' | 'ALL';
  description?: string;
  imageUrl?: string;
  images: string[];
  specifications?: Record<string, string> | null;
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

export interface SpaServiceType {
  id: string;
  categoryId?: string;
  brandId?: string;
  branchId?: string;
  name: string;
  description: string | null;
  species?: 'DOG' | 'CAT' | null;
  petWeightMin?: number | null;
  petWeightMax?: number | null;
  price: number;
  durationMin: number;
  durationMax?: number | null;
  isMain?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category?: {
    id?: string;
    name: string;
    isMain?: boolean;
  };
  brand?: {
    id: string;
    name: string;
    isMain?: boolean;
  };
  branch?: {
    id: string;
    name: string;
  };
}

export interface SpaBranchType {
  id: string;
  name: string;
  description: string | null;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
  managerId: string | null;
  approvedAt: string | null;
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
  services?: SpaServiceType[];
}

export interface SpaBookingType {
  id: string;
  categoryId?: string | null;
  brandId?: string | null;
  branchId?: string | null;
  serviceId: string | null;
  mainServiceId?: string | null;
  subServiceIds?: string[];
  userId: string;
  staffId: string | null;
  petName: string | null;
  petId?: string | null;
  petSpecies?: 'DOG' | 'CAT' | null;
  petWeight?: number | null;
  scheduledAt: string;
  status: 'PENDING' | 'CONFIRMED' | 'CHECK_IN' | 'ARRIVED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'LATE';
  priceSnapshot: number | null;
  totalPrice?: number;
  discountAmount?: number;
  timeStartExpected?: string | null;
  timeEndExpected?: string | null;
  timeStartReal?: string | null;
  timeEndReal?: string | null;
  completionDiffMinutes?: number | null;
  note: string | null;
  petConditionAfter?: string | null;
  photoAfter?: string | null;
  issueReported?: string | null;
  createdAt: string;
  updatedAt: string;
  category?: {
    name: string;
  } | null;
  brand?: {
    name: string;
  } | null;
  branch?: {
    name: string;
  } | null;
  service?: {
    id?: string;
    name: string;
    description: string | null;
    price?: number;
  } | null;
  subServices?: Array<{
    id: string;
    name: string;
    price: number;
    description?: string | null;
  }>;
  user?: User | null;
  pet?: any | null;
  staff?: {
    name: string;
    avatarUrl?: string | null;
  } | null;
  addressSpaId?: string | null;
  addressSpa?: {
    name: string;
    address: string;
    phone?: string | null;
  } | null;
}

export interface SpaStaffType {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  phone?: string | null;
}

export interface AddressSpaType {
  id: string;
  name: string;
  description?: string | null;
  address: string;
  phone?: string | null;
}

export interface SpaStaffProfileType {
  id: string;
  userId: string;
  addressSpaId?: string | null;
  addressSpa?: AddressSpaType | null;
}
