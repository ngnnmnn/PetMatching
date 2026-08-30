export const dogBreeds = [
  'Poodle',
  'Corgi',
  'Golden Retriever',
  'Labrador',
  'Husky',
  'Shiba Inu',
  'Pomeranian',
  'Chihuahua',
  'Beagle',
  'Bulldog Pháp',
  'Alaska',
  'Samoyed',
  'Chó Phú Quốc',
];

export const catBreeds = [
  'British Shorthair',
  'Persian',
  'Ragdoll',
  'Maine Coon',
  'Scottish Fold',
  'Munchkin',
  'Bengal',
  'Siamese',
  'Sphynx',
  'Mèo ta',
  'Exotic Shorthair',
];

export const provinces = [
  'TP. Hồ Chí Minh',
  'Hà Nội',
  'Đà Nẵng',
  'Bình Dương',
  'Đồng Nai',
  'Cần Thơ',
  'Hải Phòng',
  'Nha Trang',
  'Huế',
  'Vũng Tàu',
];

export const breedingOptions = [
  { value: 'cash', label: 'Thu phí tiền mặt' },
  { value: 'share', label: 'Chia con non sau khi đẻ' },
  { value: 'negotiate', label: 'Thỏa thuận sau' },
];

export const petWeightLimits = {
  dog: {
    profileMin: 0.2,
    profileMax: 160,
    matchingMin: 1.5,
    matchingMax: 100,
  },
  cat: {
    profileMin: 0.2,
    profileMax: 20,
    matchingMin: 1.5,
    matchingMax: 15,
  },
} as const;

export function getPetWeightLimits(species?: string) {
  const normalizedSpecies = species?.toLowerCase();
  if (normalizedSpecies === 'dog' || normalizedSpecies === 'cat') {
    return petWeightLimits[normalizedSpecies];
  }
  return null;
}

export function isPetProfileWeightValid(species: string, weight: number) {
  const limits = getPetWeightLimits(species);
  return Boolean(
    limits &&
      Number.isFinite(weight) &&
      weight >= limits.profileMin &&
      weight <= limits.profileMax,
  );
}

export function isPetMatchingWeightEligible(species: string, weight: number) {
  const limits = getPetWeightLimits(species);
  return Boolean(
    limits &&
      Number.isFinite(weight) &&
      weight >= limits.matchingMin &&
      weight <= limits.matchingMax,
  );
}

