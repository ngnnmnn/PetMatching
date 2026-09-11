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
    isBlocked: false,
    offspringName: 'Corgipoo',
    warningNote: null,
  },
  {
    species: Species.DOG,
    breedA: 'Poodle',
    breedB: 'Golden Retriever',
    isCompatible: true,
    isBlocked: false,
    offspringName: 'Goldendoodle',
    warningNote: null,
  },
  {
    species: Species.DOG,
    breedA: 'Poodle',
    breedB: 'Labrador',
    isCompatible: true,
    isBlocked: false,
    offspringName: 'Labradoodle',
    warningNote: null,
  },
  {
    species: Species.DOG,
    breedA: 'Poodle',
    breedB: 'Shiba Inu',
    isCompatible: true,
    isBlocked: false,
    offspringName: 'Poo-Shi',
    warningNote: null,
  },
  {
    species: Species.DOG,
    breedA: 'Poodle',
    breedB: 'Beagle',
    isCompatible: true,
    isBlocked: false,
    offspringName: 'Poogle',
    warningNote: null,
  },
  {
    species: Species.DOG,
    breedA: 'Corgi',
    breedB: 'Golden Retriever',
    isCompatible: true,
    isBlocked: false,
    offspringName: 'Golden Corgi',
    warningNote: null,
  },
  {
    species: Species.DOG,
    breedA: 'Corgi',
    breedB: 'Husky',
    isCompatible: true,
    isBlocked: false,
    offspringName: 'Horgi',
    warningNote: null,
  },
  {
    species: Species.DOG,
    breedA: 'Corgi',
    breedB: 'Shiba Inu',
    isCompatible: true,
    isBlocked: false,
    offspringName: 'Shorgi',
    warningNote: null,
  },
  {
    species: Species.DOG,
    breedA: 'Golden Retriever',
    breedB: 'Labrador',
    isCompatible: true,
    isBlocked: false,
    offspringName: 'Goldador',
    warningNote: null,
  },
  {
    species: Species.DOG,
    breedA: 'Husky',
    breedB: 'Samoyed',
    isCompatible: true,
    isBlocked: false,
    offspringName: 'Samusky',
    warningNote: null,
  },
  {
    species: Species.DOG,
    breedA: 'Pug',
    breedB: 'Beagle',
    isCompatible: true,
    isBlocked: false,
    offspringName: 'Puggle',
    warningNote: null,
  },

  // =====================================================
  // CHÓ — CẤM GHÉP ĐÔI (isBlocked = true, isCompatible = false)
  // Nguy hiểm tính mạng do chênh lệch kích thước cực đại
  // =====================================================
  {
    species: Species.DOG,
    breedA: 'Chihuahua',
    breedB: 'Golden Retriever',
    isCompatible: false,
    isBlocked: true,
    offspringName: null,
    warningNote:
      'Cấm ghép đôi tuyệt đối: Chênh lệch kích thước quá lớn (3kg vs 35kg), đe dọa tính mạng chó mẹ',
  },
  {
    species: Species.DOG,
    breedA: 'Chihuahua',
    breedB: 'Husky',
    isCompatible: false,
    isBlocked: true,
    offspringName: null,
    warningNote:
      'Cấm ghép đôi tuyệt đối: Chênh lệch thể trạng quá lớn (3kg vs 27kg), nguy hiểm tính mạng',
  },
  {
    species: Species.DOG,
    breedA: 'Chihuahua',
    breedB: 'Labrador',
    isCompatible: false,
    isBlocked: true,
    offspringName: null,
    warningNote:
      'Cấm ghép đôi tuyệt đối: Chênh lệch kích thước quá lớn (3kg vs 35kg), nguy cơ vỡ tử cung',
  },
  {
    species: Species.DOG,
    breedA: 'Chihuahua',
    breedB: 'Alaska',
    isCompatible: false,
    isBlocked: true,
    offspringName: null,
    warningNote:
      'Cấm ghép đôi tuyệt đối: Chênh lệch kích thước cực đại (3kg vs 45kg), đe dọa tính mạng chó mẹ',
  },
  {
    species: Species.DOG,
    breedA: 'Pomeranian',
    breedB: 'Alaska',
    isCompatible: false,
    isBlocked: true,
    offspringName: null,
    warningNote:
      'Cấm ghép đôi tuyệt đối: Chênh lệch kích thước cực đại (3kg vs 45kg), không thể sinh an toàn',
  },
  {
    species: Species.DOG,
    breedA: 'Pomeranian',
    breedB: 'Golden Retriever',
    isCompatible: false,
    isBlocked: true,
    offspringName: null,
    warningNote:
      'Cấm ghép đôi tuyệt đối: Chênh lệch kích thước quá lớn, nguy hiểm tính mạng khi sinh con',
  },
  {
    species: Species.DOG,
    breedA: 'Pomeranian',
    breedB: 'Husky',
    isCompatible: false,
    isBlocked: true,
    offspringName: null,
    warningNote:
      'Cấm ghép đôi tuyệt đối: Chênh lệch kích thước quá lớn, nguy hiểm cho chó mẹ',
  },

  // =====================================================
  // MÈO — Giống tương thích lai tạo tốt
  // =====================================================
  {
    species: Species.CAT,
    breedA: 'Maine Coon',
    breedB: 'Ragdoll',
    isCompatible: true,
    isBlocked: false,
    offspringName: 'Ragcoon',
    warningNote: null,
  },
  {
    species: Species.CAT,
    breedA: 'British Shorthair',
    breedB: 'Exotic Shorthair',
    isCompatible: true,
    isBlocked: false,
    offspringName: 'British Exotic',
    warningNote: null,
  },
  {
    species: Species.CAT,
    breedA: 'British Shorthair',
    breedB: 'Persian',
    isCompatible: true,
    isBlocked: false,
    offspringName: 'British Longhair',
    warningNote: null,
  },
  {
    species: Species.CAT,
    breedA: 'Siamese',
    breedB: 'Persian',
    isCompatible: true,
    isBlocked: false,
    offspringName: 'Himalayan',
    warningNote: null,
  },
  {
    species: Species.CAT,
    breedA: 'Bengal',
    breedB: 'Siamese',
    isCompatible: true,
    isBlocked: false,
    offspringName: 'Bengal-Si',
    warningNote: null,
  },
  {
    species: Species.CAT,
    breedA: 'Scottish Fold',
    breedB: 'British Shorthair',
    isCompatible: true,
    isBlocked: false,
    offspringName: 'Scottish Straight/Fold',
    warningNote:
      'Kết hợp phổ biến và an toàn — nên xét nghiệm gene gấp tai trước khi phối',
  },

  // =====================================================
  // MÈO — CẤM PHỐI TUYỆT ĐỐI (isBlocked = true, isCompatible = false)
  // Rủi ro di truyền gây dị tật nặng, liệt khớp chi hoặc chết phôi thai
  // =====================================================
  {
    species: Species.CAT,
    breedA: 'Scottish Fold',
    breedB: 'Scottish Fold',
    isCompatible: false,
    isBlocked: true,
    offspringName: null,
    warningNote:
      'NGHIÊM CẤM lai Fold x Fold — gene gấp tai đồng hợp gây bệnh xương khớp nặng (Osteochondrodysplasia)',
  },
  {
    species: Species.CAT,
    breedA: 'Munchkin',
    breedB: 'Munchkin',
    isCompatible: false,
    isBlocked: true,
    offspringName: null,
    warningNote:
      'NGHIÊM CẤM lai Munchkin x Munchkin — gene chân ngắn đồng hợp gây chết phôi thai',
  },
  {
    species: Species.CAT,
    breedA: 'Scottish Fold',
    breedB: 'Munchkin',
    isCompatible: false,
    isBlocked: true,
    offspringName: null,
    warningNote:
      'Cấm phối tuyệt đối: Kết hợp gene gấp tai và chân ngắn tăng tối đa nguy cơ dị tật xương chi',
  },
  {
    species: Species.CAT,
    breedA: 'Sphynx',
    breedB: 'Scottish Fold',
    isCompatible: false,
    isBlocked: true,
    offspringName: null,
    warningNote:
      'Cấm phối tuyệt đối: Đột biến gene không lông kết hợp dị tật sụn tai gây biến chứng sức khoẻ',
  },
];

// Hàm khởi tạo dữ liệu hạt giống cho các quy tắc phối giống (BreedRule)
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
        isBlocked: rule.isBlocked,
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
