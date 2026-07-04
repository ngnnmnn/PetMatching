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
  'Bulldog Phap',
  'Alaska',
  'Samoyed',
  'Cho Phu Quoc',
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
  'Meo ta',
  'Exotic Shorthair',
];

export const provinces = [
  'TP. Ho Chi Minh',
  'Ha Noi',
  'Da Nang',
  'Binh Duong',
  'Dong Nai',
  'Can Tho',
  'Hai Phong',
  'Nha Trang',
  'Hue',
  'Vung Tau',
];

export const breedingOptions = [
  { value: 'cash', label: 'Thu phi tien mat' },
  { value: 'share', label: 'Chia con non sau khi de' },
  { value: 'negotiate', label: 'Thoa thuan sau' },
];

export interface Pet {
  id: string;
  name: string;
  species: 'dog' | 'cat';
  breed: string;
  gender: 'male' | 'female';
  birthday: Date;
  weight: number;
  isVaccinated: boolean;
  hasPedigree: boolean;
  pedigreeNumber?: string;
  avatar?: string;
  gallery: string[];
  personality: string;
  description?: string;
  breedingOption: string;
  breedingPrice?: number;
  location: string;
  ownerName: string;
  ownerAvatar?: string;
  verified: boolean;
}

export const demoPets: Pet[] = [
  {
    id: '1',
    name: 'Mochi',
    species: 'dog',
    breed: 'Corgi',
    gender: 'male',
    birthday: new Date('2023-03-15'),
    weight: 12,
    isVaccinated: true,
    hasPedigree: true,
    pedigreeNumber: 'VKA-2023-001',
    avatar: 'https://images.unsplash.com/photo-1612536057832-2ff7ead58194?w=400&h=400&fit=crop',
    gallery: ['https://images.unsplash.com/photo-1612536057832-2ff7ead58194?w=600'],
    personality: 'Hien, thich choi dua va quan nguoi.',
    description: 'Da duoc huan luyen co ban.',
    breedingOption: 'cash',
    breedingPrice: 5000000,
    location: 'TP. Ho Chi Minh',
    ownerName: 'Nguyen Van A',
    verified: true,
  },
  {
    id: '2',
    name: 'Luna',
    species: 'cat',
    breed: 'British Shorthair',
    gender: 'female',
    birthday: new Date('2022-08-20'),
    weight: 4.5,
    isVaccinated: true,
    hasPedigree: true,
    pedigreeNumber: 'TICA-2022-045',
    avatar: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=400&fit=crop',
    gallery: ['https://images.unsplash.com/photo-1574158622682-e40e69881006?w=600'],
    personality: 'Diem dam, thich nam phoi nang.',
    breedingOption: 'share',
    location: 'Ha Noi',
    ownerName: 'Tran Thi B',
    verified: true,
  },
  {
    id: '3',
    name: 'Dau Dau',
    species: 'dog',
    breed: 'Golden Retriever',
    gender: 'female',
    birthday: new Date('2021-12-01'),
    weight: 28,
    isVaccinated: true,
    hasPedigree: false,
    avatar: 'https://images.unsplash.com/photo-1633722715463-d30f4f325e24?w=400&h=400&fit=crop',
    gallery: ['https://images.unsplash.com/photo-1633722715463-d30f4f325e24?w=600'],
    personality: 'Than thien, yeu tre em.',
    breedingOption: 'negotiate',
    location: 'Da Nang',
    ownerName: 'Le Van C',
    verified: false,
  },
];

export function calculateAge(birthday: Date): string {
  const now = new Date();
  const months = (now.getFullYear() - birthday.getFullYear()) * 12 + (now.getMonth() - birthday.getMonth());
  if (months < 12) {
    return `${months} thang tuoi`;
  }

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths === 0 ? `${years} tuoi` : `${years} tuoi ${remainingMonths} thang`;
}

export function formatPrice(price: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(price)} VND`;
}
