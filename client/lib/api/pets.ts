import api from "@/lib/axios";

export type PetStatus = "ACTIVE" | "HIDDEN" | "INACTIVE";

export type PetDocument = {
  id: string;
  type: "VACCINE_RECORD" | "PEDIGREE_CERT" | "HEALTH_CHECK";
  title?: string | null;
  imageUrls: string[];
  userNote?: string | null;
  status: "PENDING" | "REVIEWING" | "APPROVED" | "REJECTED" | "NEED_MORE_INFO";
  reviewNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Pet = {
  id: string;
  name: string;
  species: "DOG" | "CAT";
  breed: string;
  gender: "MALE" | "FEMALE";
  birthday: string;
  weight: number;
  location: string;
  district?: string | null;
  ward?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  avatarUrl?: string | null;
  gallery: string[];
  personality?: string | null;
  isVaccinated: boolean;
  hasPedigree: boolean;
  pedigreeNumber?: string | null;
  vaccineVerified: boolean;
  pedigreeVerified: boolean;
  verificationBadge: "NONE" | "PENDING" | "VERIFIED";
  documents: PetDocument[];
  isAvailableForMatching: boolean;
  breedingOption: "CASH" | "SHARE_LITTER" | "NEGOTIATE";
  breedingFee?: number | null;
  shareLitterCount?: number | null;
  totalBreedings: number;
  status: PetStatus;
  createdAt: string;
  updatedAt: string;
};

export type UpdatePetPayload = Partial<
  Pick<
    Pet,
    | "name"
    | "weight"
    | "location"
    | "district"
    | "ward"
    | "latitude"
    | "longitude"
    | "avatarUrl"
    | "gallery"
    | "personality"
    | "isVaccinated"
    | "hasPedigree"
    | "pedigreeNumber"
  >
> & {
  vaccineDocumentUrls?: string[];
  pedigreeDocumentUrls?: string[];
};

export type DeletePetResult = {
  success: true;
  message: string;
  cancelledSpaBookings: number;
  cancelledMatchingRequests: number;
  endedMatches: number;
};

import { fetchWithCache, invalidateCache } from "@/lib/cache/api-cache";

/**
 * Xóa bộ nhớ đệm danh sách thú cưng của tôi khi có thao tác thêm/sửa/xóa
 */
export function invalidateMyPetsCache() {
  invalidateCache("pets:my");
}

export const petsApi = {
  /**
   * Lấy danh sách thú cưng của người dùng có hỗ trợ bộ nhớ đệm (TTL: 5 phút)
   * Giúp chuyển đổi mượt mà giữa các trang Shop, Explore, My Pets và Đặt lịch Spa
   */
  getMine: (options?: { force?: boolean }) =>
    fetchWithCache(
      "pets:my",
      () => api.get<Pet[]>("/pets/my"),
      5 * 60 * 1000,
      options?.force,
    ),
  getDetail: (petId: string) => api.get<Pet>(`/pets/${petId}`),
  /** Cập nhật thông tin thú cưng và tự động làm mới bộ nhớ đệm */
  update: async (petId: string, payload: UpdatePetPayload) => {
    const res = await api.patch<Pet>(`/pets/${petId}`, payload);
    invalidateMyPetsCache();
    return res;
  },
  /** Cập nhật trạng thái ghép đôi và tự động làm mới bộ nhớ đệm */
  updateAvailability: async (
    petId: string,
    payload: {
      isAvailableForMatching?: boolean;
      status?: Pet["status"];
      breedingOption?: Pet["breedingOption"];
      breedingFee?: number;
      shareLitterCount?: number;
      personality?: string;
    },
  ) => {
    const res = await api.patch<Pet>(`/pets/${petId}/availability`, payload);
    invalidateMyPetsCache();
    return res;
  },
  /** Xóa thú cưng và tự động làm mới bộ nhớ đệm */
  delete: async (petId: string) => {
    const res = await api.delete<DeletePetResult>(`/pets/${petId}`);
    invalidateMyPetsCache();
    return res;
  },
};

