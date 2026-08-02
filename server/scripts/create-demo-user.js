const {
  BreedingOption,
  Gender,
  PetStatus,
  PrismaClient,
  Species,
  UserRole,
  VerificationBadge,
  ApprovalStatus,
  SpaBookingStatus,
} = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@petmatching.local';
  const password = 'Demo@123456';
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      name: 'Demo User',
      phone: '0900000000',
      role: UserRole.USER,
      isVerified: true,
      failedOtpAttempts: 0,
      lockedUntil: null,
      refreshToken: null,
    },
    create: {
      email,
      passwordHash,
      name: 'Demo User',
      phone: '0900000000',
      role: UserRole.USER,
      isVerified: true,
      failedOtpAttempts: 0,
      lockedUntil: null,
    },
  });

  const clientUser = await prisma.user.upsert({
    where: { email: 'an@petmatch.vn' },
    update: {
      name: 'Nguyễn Văn An',
      phone: '0987654321',
      role: UserRole.USER,
      isVerified: true,
    },
    create: {
      email: 'an@petmatch.vn',
      passwordHash: await bcrypt.hash('123456', 10),
      name: 'Nguyễn Văn An',
      phone: '0987654321',
      role: UserRole.USER,
      isVerified: true,
    },
  });

  const breeder = await prisma.user.upsert({
    where: { email: 'breeder@petmatching.local' },
    update: {
      name: 'Breeder Demo',
      phone: '0911111111',
      role: UserRole.USER,
      isVerified: true,
    },
    create: {
      email: 'breeder@petmatching.local',
      passwordHash,
      name: 'Breeder Demo',
      phone: '0911111111',
      role: UserRole.USER,
      isVerified: true,
    },
  });

  const lunaPet = await prisma.pet.upsert({
    where: { slug: 'demo-luna-corgi-female' },
    update: {
      ownerId: clientUser.id,
      status: PetStatus.ACTIVE,
      isAvailableForMatching: false,
    },
    create: {
      ownerId: clientUser.id,
      slug: 'demo-luna-corgi-female',
      name: 'Luna',
      species: Species.DOG,
      breed: 'Corgi',
      gender: Gender.FEMALE,
      birthday: new Date('2023-03-15'),
      weight: 11,
      isVaccinated: true,
      hasPedigree: true,
      pedigreeNumber: 'DEMO-F-001',
      verificationBadge: VerificationBadge.VERIFIED,
      vaccineVerified: true,
      pedigreeVerified: true,
      avatarUrl: 'https://images.unsplash.com/photo-1612536057832-2ff7ead58194?w=500&h=500&fit=crop',
      gallery: ['https://images.unsplash.com/photo-1612536057832-2ff7ead58194?w=800'],
      personality: 'Friendly and calm.',
      breedingOption: BreedingOption.NEGOTIATE,
      location: 'TP. Ho Chi Minh',
      status: PetStatus.ACTIVE,
      isAvailableForMatching: false,
    },
  });

  const mochiPet = await prisma.pet.upsert({
    where: { slug: 'demo-mochi-corgi-male' },
    update: {
      ownerId: clientUser.id,
      status: PetStatus.ACTIVE,
      isAvailableForMatching: true,
    },
    create: {
      ownerId: clientUser.id,
      slug: 'demo-mochi-corgi-male',
      name: 'Mochi',
      species: Species.DOG,
      breed: 'Corgi',
      gender: Gender.MALE,
      birthday: new Date('2022-10-20'),
      weight: 13,
      isVaccinated: true,
      hasPedigree: true,
      pedigreeNumber: 'DEMO-M-001',
      verificationBadge: VerificationBadge.VERIFIED,
      vaccineVerified: true,
      pedigreeVerified: true,
      avatarUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=500&h=500&fit=crop',
      gallery: ['https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800'],
      personality: 'Playful and gentle.',
      breedingOption: BreedingOption.CASH,
      breedingFee: 5000000,
      location: 'TP. Ho Chi Minh',
      status: PetStatus.ACTIVE,
      isAvailableForMatching: true,
    },
  });

  const candidatePets = [
    {
      slug: 'candidate-bento-corgi-male',
      name: 'Bento',
      breed: 'Corgi',
      weight: 12,
      location: 'TP. Ho Chi Minh',
      avatarUrl: 'https://images.unsplash.com/photo-1546975490-e8b92a360b24?w=500&h=500&fit=crop',
      breedingFee: 4500000,
    },
    {
      slug: 'candidate-bailey-golden-male',
      name: 'Bailey',
      breed: 'Golden Retriever',
      weight: 29,
      location: 'Da Nang',
      avatarUrl: 'https://images.unsplash.com/photo-1633722715463-d30f4f325e24?w=500&h=500&fit=crop',
      breedingFee: 6000000,
    },
  ];

  for (const pet of candidatePets) {
    await prisma.pet.upsert({
      where: { slug: pet.slug },
      update: {
        ownerId: breeder.id,
        status: PetStatus.ACTIVE,
        isAvailableForMatching: true,
      },
      create: {
        ownerId: breeder.id,
        slug: pet.slug,
        name: pet.name,
        species: Species.DOG,
        breed: pet.breed,
        gender: Gender.MALE,
        birthday: new Date('2022-06-01'),
        weight: pet.weight,
        isVaccinated: true,
        hasPedigree: true,
        verificationBadge: VerificationBadge.VERIFIED,
        vaccineVerified: true,
        pedigreeVerified: true,
        avatarUrl: pet.avatarUrl,
        gallery: [pet.avatarUrl.replace('w=500&h=500', 'w=800')],
        personality: 'Available for responsible matching.',
        breedingOption: BreedingOption.CASH,
        breedingFee: pet.breedingFee,
        location: pet.location,
        status: PetStatus.ACTIVE,
        isAvailableForMatching: true,
      },
    });
  }

  // Seeding Store Manager account
  const storeManagerEmail = 'managerstore@petmatch.com';
  const storeManagerPasswordHash = await bcrypt.hash('123456', 10);

  const storeManager = await prisma.user.upsert({
    where: { email: storeManagerEmail },
    update: {
      passwordHash: storeManagerPasswordHash,
      name: 'Store Manager',
      phone: '0922222222',
      role: UserRole.STORE_MANAGER,
      isVerified: true,
    },
    create: {
      email: storeManagerEmail,
      passwordHash: storeManagerPasswordHash,
      name: 'Store Manager',
      phone: '0922222222',
      role: UserRole.STORE_MANAGER,
      isVerified: true,
    },
  });

  // Seed default Store
  await prisma.store.upsert({
    where: { id: 'default-store-id' },
    update: {
      name: 'Cửa hàng PetMatching Quận 1',
      description: 'Chi nhánh chính cung cấp phụ kiện và thức ăn thú cưng',
      address: '123 Nguyễn Huệ, Quận 1, TP. HCM',
      phone: '0922222222',
      status: ApprovalStatus.ACTIVE,
      managerId: storeManager.id,
    },
    create: {
      id: 'default-store-id',
      name: 'Cửa hàng PetMatching Quận 1',
      description: 'Chi nhánh chính cung cấp phụ kiện và thức ăn thú cưng',
      address: '123 Nguyễn Huệ, Quận 1, TP. HCM',
      phone: '0922222222',
      status: ApprovalStatus.ACTIVE,
      managerId: storeManager.id,
    },
  });

  // Delete any legacy hardcoded brand/category IDs if they exist
  await prisma.spaCategory.deleteMany({
    where: {
      id: { in: ['brand-tam-say', 'brand-cat-tia', 'brand-mong', 'brand-tai-rang', 'brand-massage', 'brand-combo'] }
    }
  });

  const comboCategory = await prisma.spaCategory.findFirst({ where: { name: 'Combo' } }) || await prisma.spaCategory.findFirst();
  const tamCategory = await prisma.spaCategory.findFirst({ where: { name: 'Tắm' } }) || await prisma.spaCategory.findFirst();

  // Seeding Spa Services
  await prisma.spaService.deleteMany({
    where: {
      id: {
        in: [
          'service-tam-say-co-ban',
          'service-tam-say-cao-cap',
          'service-cat-tia-yeu-cau',
          'service-cat-tia-co-ban',
          'service-cham-soc-mong',
          'service-ve-sinh-tai-rang',
          'service-massage-30',
          'service-full-day',
          'service-meo-premium'
        ]
      }
    }
  });

  // Legacy Spa Services removed - managed via seed-spa.ts

  const staffEmail = 'hoa@spa.petmatch.vn';
  const staffPasswordHash = await bcrypt.hash('spa123', 10);
  const staffUser = await prisma.user.upsert({
    where: { email: staffEmail },
    update: {
      passwordHash: staffPasswordHash,
      name: 'Lê Thị Hoa',
      phone: '0933333333',
      role: UserRole.SPA_STAFF,
      isVerified: true,
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop',
    },
    create: {
      email: staffEmail,
      passwordHash: staffPasswordHash,
      name: 'Lê Thị Hoa',
      phone: '0933333333',
      role: UserRole.SPA_STAFF,
      isVerified: true,
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop',
    },
  });

  const managerEmail = 'mai@spa.petmatch.vn';
  const managerPasswordHash = await bcrypt.hash('spa123', 10);
  const managerUser = await prisma.user.upsert({
    where: { email: managerEmail },
    update: {
      passwordHash: managerPasswordHash,
      name: 'Trần Thị Mai',
      phone: '0944444444',
      role: UserRole.SPA_MANAGER,
      isVerified: true,
    },
    create: {
      email: managerEmail,
      passwordHash: managerPasswordHash,
      name: 'Trần Thị Mai',
      phone: '0944444444',
      role: UserRole.SPA_MANAGER,
      isVerified: true,
    },
  });

  // Clear and seed AddressSpa records
  // Clear old AddressSpa records except Q1 if present, then ensure Q1 exists
  await prisma.addressSpa.deleteMany({
    where: {
      id: { not: 'petmatch-spa-q1' }
    }
  });

  const addressQ1 = await prisma.addressSpa.upsert({
    where: { id: 'petmatch-spa-q1' },
    update: {
      name: 'PetMatch Spa – Quận 1',
      description: 'Trung tâm chăm sóc sắc đẹp chính tại TP. HCM',
      address: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1',
      phone: '02899998888',
      status: ApprovalStatus.ACTIVE,
      managerId: managerUser.id,
    },
    create: {
      id: 'petmatch-spa-q1',
      name: 'PetMatch Spa – Quận 1',
      description: 'Trung tâm chăm sóc sắc đẹp chính tại TP. HCM',
      address: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1',
      phone: '02899998888',
      status: ApprovalStatus.ACTIVE,
      managerId: managerUser.id,
    }
  });

  // Seed SpaStaff profile for Hoa
  await prisma.spaStaff.upsert({
    where: { userId: staffUser.id },
    update: {
      id: 'spaHoaLT',
      addressSpaId: addressQ1.id,
    },
    create: {
      id: 'spaHoaLT',
      userId: staffUser.id,
      addressSpaId: addressQ1.id,
    },
  });

  const today = new Date();
  
  const date1 = new Date(today);
  date1.setHours(8, 0, 0, 0);

  const date2 = new Date(today);
  date2.setHours(10, 0, 0, 0);

  const date3 = new Date(today);
  date3.setHours(13, 0, 0, 0);

  await prisma.spaBooking.deleteMany({
    where: {
      id: { in: ['demo-booking-1', 'demo-booking-2', 'demo-booking-3'] }
    }
  });

  const demoService = await prisma.spaService.findFirst({ where: { isMain: true } });
  const demoServiceId = demoService ? demoService.id : null;
  const demoPrice = demoService ? demoService.price : 100000;

  await prisma.spaBooking.create({
    data: {
      id: 'demo-booking-1',
      categoryId: comboCategory ? comboCategory.id : null,
      addressSpaId: 'petmatch-spa-q1',
      serviceId: demoServiceId,
      mainServiceId: demoServiceId,
      userId: clientUser.id,
      staffId: staffUser.id,
      petId: mochiPet.id,
      petName: 'Mochi',
      scheduledAt: date1,
      status: SpaBookingStatus.COMPLETED,
      priceSnapshot: demoPrice,
      totalPrice: demoPrice,
      note: 'Mochi hơi sợ máy sấy, làm nhẹ nhàng giúp mình nhé',
      petConditionAfter: 'Bé Mochi rất ngoan, hoàn thành tốt. Lông đẹp và thơm.',
      photoAfter: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=500&h=500&fit=crop',
    }
  });

  await prisma.spaBooking.create({
    data: {
      id: 'demo-booking-2',
      categoryId: tamCategory ? tamCategory.id : null,
      addressSpaId: 'petmatch-spa-q1',
      serviceId: demoServiceId,
      mainServiceId: demoServiceId,
      userId: clientUser.id,
      staffId: staffUser.id,
      petName: 'Titan',
      scheduledAt: date2,
      status: SpaBookingStatus.ASSIGNED,
      priceSnapshot: demoPrice,
      totalPrice: demoPrice,
      note: 'Titan nặng 30kg, cần 2 nhân viên hỗ trợ',
    }
  });

  await prisma.spaBooking.create({
    data: {
      id: 'demo-booking-3',
      categoryId: tamCategory ? tamCategory.id : null,
      addressSpaId: 'petmatch-spa-q1',
      serviceId: demoServiceId,
      mainServiceId: demoServiceId,
      userId: clientUser.id,
      staffId: staffUser.id,
      petId: lunaPet.id,
      petName: 'Luna',
      scheduledAt: date3,
      status: SpaBookingStatus.IN_PROGRESS,
      priceSnapshot: demoPrice,
      totalPrice: demoPrice,
      note: 'Luna thích được massage nhẹ khi sấy',
    }
  });

  // Seeding Free Ship Voucher
  await prisma.voucher.upsert({
    where: { code: 'FREESHIP100' },
    update: {
      type: 'FREE_SHIP',
      value: 100,
      isActive: true,
      maxUsage: 1000,
    },
    create: {
      code: 'FREESHIP100',
      type: 'FREE_SHIP',
      value: 100,
      isActive: true,
      maxUsage: 1000,
    },
  });

  console.log('Demo account is ready:');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`User ID: ${user.id}`);
  console.log(`Store Manager Email: ${storeManagerEmail}`);
  console.log(`Store Manager Password: 123456`);
  console.log(`Spa Manager Email: ${managerEmail}`);
  console.log(`Spa Manager Password: spa123`);
  console.log(`Spa Staff Email: ${staffEmail}`);
  console.log(`Spa Staff Password: spa123`);
  console.log('Demo pets, spa data, and matching candidates are ready.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
