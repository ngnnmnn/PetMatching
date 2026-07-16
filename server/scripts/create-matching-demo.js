const { PrismaClient, Species, Gender, PetStatus, VerificationBadge, UserRole } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu tạo dữ liệu test cho Matching Engine...');

  // 1. Tạo 2 user: Demo User (nữ chính) và Partner User (các ứng viên nam)
  const passwordHash = await bcrypt.hash('Demo@123456', 10);

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@petmatching.local' },
    update: {},
    create: {
      email: 'demo@petmatching.local',
      passwordHash,
      name: 'Chủ Pet Nữ',
      phone: '0900000000',
      role: UserRole.USER,
      isVerified: true,
    },
  });

  const partnerUser = await prisma.user.upsert({
    where: { email: 'partner@petmatching.local' },
    update: {},
    create: {
      email: 'partner@petmatching.local',
      passwordHash,
      name: 'Chủ Trại Phối Giống',
      phone: '0911111111',
      role: UserRole.USER,
      isVerified: true,
    },
  });

  // Helper để tính ngày sinh dựa trên số tháng tuổi
  const getBirthday = (monthsAgo) => {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsAgo);
    return d;
  };

  // Helper để tính ngày phối gần nhất dựa trên số tháng trước
  const getLastBreeding = (monthsAgo) => {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsAgo);
    return d;
  };

  // =========================================================
  // 2. Tạo các bé cái cho Demo User
  // =========================================================
  
  // 2.1 Bé Poodle cái (15 tháng - đủ điều kiện)
  await prisma.pet.upsert({
    where: { slug: 'demo-female-poodle' },
    update: { status: PetStatus.ACTIVE, isActive: true, isAvailableForMatching: false },
    create: {
      ownerId: demoUser.id,
      slug: 'demo-female-poodle',
      name: 'Poca',
      species: Species.DOG,
      breed: 'Poodle',
      gender: Gender.FEMALE,
      birthday: getBirthday(15), // Đủ 12 tháng
      weight: 5,
      isVaccinated: true,
      hasPedigree: true,
      vaccineVerified: true,
      pedigreeVerified: true,
      verificationBadge: VerificationBadge.VERIFIED,
      avatarUrl: 'https://images.unsplash.com/photo-1593134257782-e89567b7718a?w=500&h=500&fit=crop',
      gallery: [],
      personality: 'Rất ngoan và thích quấn chủ',
      location: 'TP. Ho Chi Minh',
      status: PetStatus.ACTIVE,
      isActive: true,
      isAvailableForMatching: false, // Cái không cần available
    }
  });

  // 2.2 Bé Corgi cái đang trong chu kỳ nghỉ (18 tháng tuổi, phối cách đây 2 tháng)
  await prisma.pet.upsert({
    where: { slug: 'demo-female-corgi-cooldown' },
    update: { lastBreedingAt: getLastBreeding(2) },
    create: {
      ownerId: demoUser.id,
      slug: 'demo-female-corgi-cooldown',
      name: 'Corgi Nghỉ Sinh',
      species: Species.DOG,
      breed: 'Corgi',
      gender: Gender.FEMALE,
      birthday: getBirthday(18),
      weight: 12,
      lastBreedingAt: getLastBreeding(2), // Mới 2 tháng trước (chó cần nghỉ 6 tháng)
      isVaccinated: true,
      hasPedigree: false,
      avatarUrl: 'https://images.unsplash.com/photo-1612536057832-2ff7ead58194?w=500&h=500&fit=crop',
      gallery: [],
      location: 'TP. Ho Chi Minh',
      status: PetStatus.ACTIVE,
      isActive: true,
      isAvailableForMatching: false,
    }
  });

  // 2.3 Bé Scottish Fold cái (12 tháng)
  await prisma.pet.upsert({
    where: { slug: 'demo-female-fold' },
    update: {},
    create: {
      ownerId: demoUser.id,
      slug: 'demo-female-fold',
      name: 'Miu Miu',
      species: Species.CAT,
      breed: 'Scottish Fold',
      gender: Gender.FEMALE,
      birthday: getBirthday(12),
      weight: 4,
      isVaccinated: true,
      hasPedigree: true,
      avatarUrl: 'https://images.unsplash.com/photo-1577023311546-cdc07a8454d9?w=500&h=500&fit=crop',
      gallery: [],
      location: 'TP. Ho Chi Minh',
      status: PetStatus.ACTIVE,
      isActive: true,
      isAvailableForMatching: false,
    }
  });

  // =========================================================
  // 3. Tạo các bé đực ứng viên cho Partner User
  // =========================================================

  const candidates = [
    {
      slug: 'partner-male-poodle',
      name: 'Poodle Đực (Cùng giống)',
      species: Species.DOG,
      breed: 'Poodle',
      monthsOld: 24,
      weight: 6,
      avatar: 'https://images.unsplash.com/photo-1625316708582-7c38734be31d?w=500&h=500&fit=crop'
    },
    {
      slug: 'partner-male-corgi',
      name: 'Corgi Đực (Tương thích Poodle)',
      species: Species.DOG,
      breed: 'Corgi',
      monthsOld: 20,
      weight: 12,
      avatar: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=500&h=500&fit=crop'
    },
    {
      slug: 'partner-male-chihuahua',
      name: 'Chihuahua Đực (Cảnh báo lớn nhỏ)',
      species: Species.DOG,
      breed: 'Chihuahua',
      monthsOld: 30,
      weight: 3,
      avatar: 'https://images.unsplash.com/photo-1605897472359-85e4b94d685d?w=500&h=500&fit=crop'
    },
    {
      slug: 'partner-male-poodle-underage',
      name: 'Poodle Nhi Đồng (8 tháng)',
      species: Species.DOG,
      breed: 'Poodle',
      monthsOld: 8, // Sẽ không xuất hiện vì chó nam cần 12 tháng
      weight: 4,
      avatar: 'https://images.unsplash.com/photo-1537151608804-ea2d15a12f4a?w=500&h=500&fit=crop'
    },
    {
      slug: 'partner-male-fold',
      name: 'Fold Đực (Cấm lai Fold x Fold)',
      species: Species.CAT,
      breed: 'Scottish Fold',
      monthsOld: 14,
      weight: 5,
      avatar: 'https://images.unsplash.com/photo-1577023311546-cdc07a8454d9?w=500&h=500&fit=crop'
    },
    {
      slug: 'partner-male-bsh',
      name: 'BSH Đực (Hợp với Fold)',
      species: Species.CAT,
      breed: 'Anh lông ngắn (British Shorthair)',
      monthsOld: 16,
      weight: 6,
      avatar: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?w=500&h=500&fit=crop'
    },
  ];

  for (const pet of candidates) {
    await prisma.pet.upsert({
      where: { slug: pet.slug },
      update: {
        status: PetStatus.ACTIVE,
        isActive: true,
        isAvailableForMatching: true, // Quan trọng: phải là true mới lên danh sách
        birthday: getBirthday(pet.monthsOld),
      },
      create: {
        ownerId: partnerUser.id,
        slug: pet.slug,
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        gender: Gender.MALE,
        birthday: getBirthday(pet.monthsOld),
        weight: pet.weight,
        isVaccinated: true,
        hasPedigree: true,
        vaccineVerified: true,
        pedigreeVerified: true,
        verificationBadge: VerificationBadge.VERIFIED,
        avatarUrl: pet.avatar,
        gallery: [],
        personality: 'Ứng viên cực kỳ tiềm năng.',
        location: 'TP. Ho Chi Minh',
        status: PetStatus.ACTIVE,
        isActive: true,
        isAvailableForMatching: true,
      }
    });
  }

  console.log('✅ Đã tạo xong dữ liệu test matching.');
  console.log('User test: demo@petmatching.local / Demo@123456');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
