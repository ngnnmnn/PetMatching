import { Species } from '@prisma/client';

export const PET_WEIGHT_LIMITS = {
  [Species.DOG]: {
    profileMin: 0.2,
    profileMax: 160,
    matchingMin: 1.5,
    matchingMax: 100,
  },
  [Species.CAT]: {
    profileMin: 0.2,
    profileMax: 20,
    matchingMin: 1.5,
    matchingMax: 15,
  },
} as const;

export function isPetProfileWeightValid(
  species: Species,
  weight: number,
): boolean {
  const limits = PET_WEIGHT_LIMITS[species];
  return (
    Number.isFinite(weight) &&
    weight >= limits.profileMin &&
    weight <= limits.profileMax
  );
}

export function isPetMatchingWeightEligible(
  species: Species,
  weight: number,
): boolean {
  const limits = PET_WEIGHT_LIMITS[species];
  return (
    Number.isFinite(weight) &&
    weight >= limits.matchingMin &&
    weight <= limits.matchingMax
  );
}
