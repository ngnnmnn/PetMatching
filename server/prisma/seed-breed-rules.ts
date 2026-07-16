import { PrismaClient, Species } from '@prisma/client';

const prisma = new PrismaClient();

const breedRules = [
  // =====================================================
  // CHÓ — Giống tương thích lai tạo tốt
  // =====================================================
  {
    species: Species.DOG,
    breedA: 'Poodle',
    breedB: 'Corgi',
    isCompatible: true,
    offspringName: 'Corgipoo',
    warningNote: null,
  },
  {
    species: Species.DOG,
    breedA: 'Poodle',
    breedB: 'Golden Retriever',
    isCompatible: true,
    offspringName: 'Goldendoodle',
    warningNote: null,
  },
  {
    species: Species.DOG,
    breedA: 'Poodle',
    breedB: 'Labrador',
    isCompatible: true,
    offspringName: 'Labradoodle',
    warningNote: null,
  },
  {
    species: Species.DOG,
    breedA: 'Poodle',
    breedB: 'Shiba Inu',
    isCompatible: true,
    offspringName: 'Poo-Shi',
    warningNote: null,
  },
  {
    species: Species.DOG,
    breedA: 'Poodle',
    breedB: 'Beagle',
    isCompatible: true,
    offspringName: 'Poogle',
    warningNote: null,
  },
  {
    species: Species.DOG,
    breedA: 'Corgi',
    breedB: 'Golden Retriever',
    isCompatible: true,
    offspringName: 'Golden Corgi',
    warningNote: null,
  },
  {
    species: Species.DOG,
    breedA: 'Corgi',
    breedB: 'Husky',
    isCompatible: true,
    offspringName: 'Horgi',
    warningNote: null,
  },
  {
    species: Species.DOG,
    breedA: 'Corgi',
    breedB: 'Shiba Inu',
    isCompatible: true,
    offspringName: 'Shorgi',
    warningNote: null,
  },
  {
    species: Species.DOG,
    breedA: 'Golden Retriever',
    breedB: 'Labrador',
    isCompatible: true,
    offspringName: 'Goldador',
    warningNote: null,
  },
  {
    species: Species.DOG,
    breedA: 'Husky',
    breedB: 'Samoyed',
    isCompatible: true,
    offspringName: 'Samusky',
    warningNote: null,
  },

  // =====================================================
  // CHÓ — Không khuyến nghị / Cần cẩn thận
  // =====================================================
  {
    species: Species.DOG,
    breedA: 'Chihuahua',
    breedB: 'Golden Retriever',
    isCompatible: false,
    offspringName: null,
    warningNote:
      'Chênh lệch kích thước quá lớn — nguy hiểm cho mẹ khi mang thai và sinh',
  },
  {
    species: Species.DOG,
    breedA: 'Chihuahua',
    breedB: 'Husky',
    isCompatible: false,
    offspringName: null,
    warningNote:
      'Chênh lệch kích thước quá lớn — nguy hiểm cho mẹ khi mang thai và sinh',
  },
  {
    species: Species.DOG,
    breedA: 'Chihuahua',
    breedB: 'Labrador',
    isCompatible: false,
    offspringName: null,
    warningNote:
      'Chênh lệch kích thước quá lớn — nguy hiểm cho mẹ khi mang thai và sinh',
  },
  {
    species: Species.DOG,
    breedA: 'Phốc Sóc (Pomeranian)',
    breedB: 'Alaska',
    isCompatible: false,
    offspringName: null,
    warningNote: 'Chênh lệch kích thước quá lớn — không an toàn cho sức khoẻ',
  },

  // =====================================================
  // MÈO — Giống tương thích lai tạo tốt
  // =====================================================
  {
    species: Species.CAT,
    breedA: 'Maine Coon',
    breedB: 'Ragdoll',
    isCompatible: true,
    offspringName: 'Ragcoon',
    warningNote: null,
  },
  {
    species: Species.CAT,
    breedA: 'Anh lông ngắn (British Shorthair)',
    breedB: 'Exotic Shorthair',
    isCompatible: true,
    offspringName: 'British Exotic',
    warningNote: null,
  },
  {
    species: Species.CAT,
    breedA: 'Anh lông ngắn (British Shorthair)',
    breedB: 'Ba Tư (Persian)',
    isCompatible: true,
    offspringName: 'British Longhair',
    warningNote: null,
  },
  {
    species: Species.CAT,
    breedA: 'Siamese',
    breedB: 'Ba Tư (Persian)',
    isCompatible: true,
    offspringName: 'Himalayan',
    warningNote: null,
  },
  {
    species: Species.CAT,
    breedA: 'Bengal',
    breedB: 'Siamese',
    isCompatible: true,
    offspringName: 'Bengal-Si',
    warningNote: null,
  },

  // =====================================================
  // MÈO — Không khuyến nghị / Cần cẩn thận
  // =====================================================
  {
    species: Species.CAT,
    breedA: 'Scottish Fold',
    breedB: 'Scottish Fold',
    isCompatible: false,
    offspringName: null,
    warningNote:
      'NGHIÊM CẤM lai Fold x Fold — gene gấp tai đồng hợp gây bệnh xương khớp nặng (Osteochondrodysplasia)',
  },
  {
    species: Species.CAT,
    breedA: 'Munchkin',
    breedB: 'Munchkin',
    isCompatible: false,
    offspringName: null,
    warningNote:
      'NGHIÊM CẤM lai Munchkin x Munchkin — gene chân ngắn đồng hợp gây chết phôi',
  },
  {
    species: Species.CAT,
    breedA: 'Scottish Fold',
    breedB: 'Munchkin',
    isCompatible: false,
    offspringName: null,
    warningNote:
      'Kết hợp hai gene đặc trưng (gấp tai + chân ngắn) có rủi ro di truyền cao',
  },
  {
    species: Species.CAT,
    breedA: 'Scottish Fold',
    breedB: 'Anh lông ngắn (British Shorthair)',
    isCompatible: true,
    offspringName: 'Scottish Straight/Fold',
    warningNote:
      'Kết hợp phổ biến và an toàn — nên xét nghiệm gene gấp tai trước khi phối',
  },
  {
    species: Species.CAT,
    breedA: 'Sphynx',
    breedB: 'Scottish Fold',
    isCompatible: false,
    offspringName: null,
    warningNote:
      'Sphynx có gene trội gây không lông — kết hợp với Fold tăng rủi ro sức khoẻ',
  },
];

async function main() {
  console.log('🌱 Seeding BreedRule data...');

  for (const rule of breedRules) {
    await prisma.breedRule.upsert({
      where: {
        breedA_breedB_species: {
          breedA: rule.breedA,
          breedB: rule.breedB,
          species: rule.species,
        },
      },
      update: {
        isCompatible: rule.isCompatible,
        offspringName: rule.offspringName,
        warningNote: rule.warningNote,
      },
      create: rule,
    });
  }

  console.log(`✅ Seeded ${breedRules.length} breed rules`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
