export const dogBreeds = [
  "Poodle",
  "Corgi",
  "Golden Retriever",
  "Labrador",
  "Husky",
  "Shiba Inu",
  "Phốc Sóc (Pomeranian)",
  "Chihuahua",
  "Beagle",
  "Bulldog Pháp",
  "Alaska",
  "Samoyed",
  "Chó ta (Phú Quốc)",
]

export const catBreeds = [
  "Anh lông ngắn (British Shorthair)",
  "Ba Tư (Persian)",
  "Ragdoll",
  "Maine Coon",
  "Scottish Fold",
  "Munchkin",
  "Bengal",
  "Siamese",
  "Sphynx",
  "Mèo ta",
  "Exotic Shorthair",
]

export const provinces = [
  "TP. Hồ Chí Minh",
  "Hà Nội",
  "Đà Nẵng",
  "Bình Dương",
  "Đồng Nai",
  "Cần Thơ",
  "Hải Phòng",
  "Nha Trang",
  "Huế",
  "Vũng Tàu",
]

export const breedingOptions = [
  { value: "cash", label: "Thu phí tiền mặt" },
  { value: "share", label: "Chia sản phẩm (Chia con non sau khi đẻ)" },
  { value: "negotiate", label: "Thỏa thuận sau" },
]

export interface Pet {
  id: string
  name: string
  species: "dog" | "cat"
  breed: string
  gender: "male" | "female"
  birthday: Date
  weight: number
  isVaccinated: boolean
  hasPedigree: boolean
  pedigreeNumber?: string
  avatar?: string
  gallery: string[]
  personality: string
  breedingOption: string
  breedingPrice?: number
  location: string
  ownerName: string
  ownerAvatar?: string
  verified: boolean
}

export const samplePets: Pet[] = [
  {
    id: "1",
    name: "Mochi",
    species: "dog",
    breed: "Corgi",
    gender: "male",
    birthday: new Date("2023-03-15"),
    weight: 12,
    isVaccinated: true,
    hasPedigree: true,
    pedigreeNumber: "VKA-2023-001",
    avatar: "https://images.unsplash.com/photo-1612536057832-2ff7ead58194?w=400&h=400&fit=crop",
    gallery: [
      "https://images.unsplash.com/photo-1612536057832-2ff7ead58194?w=600",
      "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600",
    ],
    personality: "Bé rất hiền, thích chơi đùa và quấn người. Đã được huấn luyện cơ bản.",
    breedingOption: "cash",
    breedingPrice: 5000000,
    location: "TP. Hồ Chí Minh",
    ownerName: "Nguyễn Văn A",
    verified: true,
  },
  {
    id: "2",
    name: "Luna",
    species: "cat",
    breed: "Anh lông ngắn (British Shorthair)",
    gender: "female",
    birthday: new Date("2022-08-20"),
    weight: 4.5,
    isVaccinated: true,
    hasPedigree: true,
    pedigreeNumber: "TICA-2022-045",
    avatar: "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=400&fit=crop",
    gallery: [
      "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=600",
      "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=600",
    ],
    personality: "Luna rất điềm đạm, thích nằm phơi nắng và được vuốt ve.",
    breedingOption: "share",
    location: "Hà Nội",
    ownerName: "Trần Thị B",
    verified: true,
  },
  {
    id: "3",
    name: "Đậu Đậu",
    species: "dog",
    breed: "Golden Retriever",
    gender: "female",
    birthday: new Date("2021-12-01"),
    weight: 28,
    isVaccinated: true,
    hasPedigree: false,
    avatar: "https://images.unsplash.com/photo-1633722715463-d30f4f325e24?w=400&h=400&fit=crop",
    gallery: [
      "https://images.unsplash.com/photo-1633722715463-d30f4f325e24?w=600",
    ],
    personality: "Đậu rất thân thiện, yêu trẻ em và các động vật khác.",
    breedingOption: "negotiate",
    location: "Đà Nẵng",
    ownerName: "Lê Văn C",
    verified: false,
  },
  {
    id: "4",
    name: "Bông",
    species: "cat",
    breed: "Scottish Fold",
    gender: "male",
    birthday: new Date("2023-01-10"),
    weight: 3.8,
    isVaccinated: true,
    hasPedigree: true,
    pedigreeNumber: "TICA-2023-012",
    avatar: "https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=400&h=400&fit=crop",
    gallery: [
      "https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=600",
    ],
    personality: "Bông rất ngoan, ít kêu và thích chơi với đồ chơi.",
    breedingOption: "cash",
    breedingPrice: 8000000,
    location: "TP. Hồ Chí Minh",
    ownerName: "Phạm Thị D",
    verified: true,
  },
  {
    id: "5",
    name: "Milo",
    species: "dog",
    breed: "Poodle",
    gender: "male",
    birthday: new Date("2022-06-15"),
    weight: 5,
    isVaccinated: true,
    hasPedigree: true,
    pedigreeNumber: "VKA-2022-089",
    avatar: "https://images.unsplash.com/photo-1575859431774-2e57ed632564?w=400&h=400&fit=crop",
    gallery: [
      "https://images.unsplash.com/photo-1575859431774-2e57ed632564?w=600",
    ],
    personality: "Milo thông minh, đã học nhiều trò và rất nghe lời.",
    breedingOption: "cash",
    breedingPrice: 6000000,
    location: "Bình Dương",
    ownerName: "Hoàng Văn E",
    verified: true,
  },
  {
    id: "6",
    name: "Sushi",
    species: "cat",
    breed: "Ragdoll",
    gender: "female",
    birthday: new Date("2022-11-25"),
    weight: 4.2,
    isVaccinated: true,
    hasPedigree: true,
    pedigreeNumber: "TICA-2022-156",
    avatar: "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=400&h=400&fit=crop",
    gallery: [
      "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=600",
    ],
    personality: "Sushi rất dịu dàng, thích được bế và âu yếm.",
    breedingOption: "share",
    location: "Hà Nội",
    ownerName: "Ngô Thị F",
    verified: true,
  },
]

export function calculateAge(birthday: Date): string {
  const now = new Date()
  const months = (now.getFullYear() - birthday.getFullYear()) * 12 + (now.getMonth() - birthday.getMonth())
  if (months < 12) {
    return `${months} tháng tuổi`
  }
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  if (remainingMonths === 0) {
    return `${years} tuổi`
  }
  return `${years} tuổi ${remainingMonths} tháng`
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("vi-VN").format(price) + " VNĐ"
}
