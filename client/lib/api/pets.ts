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

export const petsApi = {
  getMine: () => api.get<Pet[]>("/pets/my"),
  getDetail: (petId: string) => api.get<Pet>(`/pets/${petId}`),
  update: (petId: string, payload: UpdatePetPayload) =>
    api.patch<Pet>(`/pets/${petId}`, payload),
  updateAvailability: (
    petId: string,
    payload: {
      isAvailableForMatching?: boolean;
      status?: Pet["status"];
      breedingOption?: Pet["breedingOption"];
      breedingFee?: number;
      shareLitterCount?: number;
      personality?: string;
    },
  ) => api.patch<Pet>(`/pets/${petId}/availability`, payload),
};
