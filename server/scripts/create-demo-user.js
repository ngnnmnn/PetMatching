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
      isActive: true,
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
      isActive: true,
      isAvailableForMatching: false,
    },
  });

  const mochiPet = await prisma.pet.upsert({
    where: { slug: 'demo-mochi-corgi-male' },
    update: {
      ownerId: clientUser.id,
      status: PetStatus.ACTIVE,
      isActive: true,
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
      isActive: true,
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
        isActive: true,
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
        isActive: true,
        isAvailableForMatching: true,
      },
    });
  }

  // Seeding Store Manager account
  const storeManagerEmail = 'managerstore@petmatch.com';
  const storeManagerPasswordHash = await bcrypt.hash('123456', 10);

  await prisma.user.upsert({
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

  // Seeding Spa Staff account and bookings
  // Seeding Spa Brands (Categories)
  await prisma.spaBrand.deleteMany({
    where: {
      id: { in: ['brand-tam-say', 'brand-cat-tia', 'brand-mong', 'brand-tai-rang', 'brand-massage', 'brand-combo'] }
    }
  });

  const brandTamSay = await prisma.spaBrand.create({
    data: {
      id: 'brand-tam-say',
      name: 'Tắm & Sấy',
      description: 'Dịch vụ tắm gội, sấy khô chuyên nghiệp cho thú cưng',
      status: ApprovalStatus.ACTIVE,
    }
  });

  const brandCatTia = await prisma.spaBrand.create({
    data: {
      id: 'brand-cat-tia',
      name: 'Cắt tỉa lông',
      description: 'Tạo kiểu lông, làm đẹp phom dáng cho bé cưng',
      status: ApprovalStatus.ACTIVE,
    }
  });

  const brandMong = await prisma.spaBrand.create({
    data: {
      id: 'brand-mong',
      name: 'Chăm sóc móng',
      description: 'Cắt mài móng vuốt an toàn, dũa nhẵn',
      status: ApprovalStatus.ACTIVE,
    }
  });

  const brandTaiRang = await prisma.spaBrand.create({
    data: {
      id: 'brand-tai-rang',
      name: 'Vệ sinh tai và răng',
      description: 'Làm sạch tai, đánh răng, xịt thơm miệng chuyên sâu',
      status: ApprovalStatus.ACTIVE,
    }
  });

  const brandMassage = await prisma.spaBrand.create({
    data: {
      id: 'brand-massage',
      name: 'Massage thư giãn',
      description: 'Massage bấm huyệt giúp giảm căng thẳng',
      status: ApprovalStatus.ACTIVE,
    }
  });

  const brandCombo = await prisma.spaBrand.create({
    data: {
      id: 'brand-combo',
      name: 'gói combo',
      description: 'Các gói chăm sóc toàn diện siêu tiết kiệm',
      status: ApprovalStatus.ACTIVE,
    }
  });

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

  const serviceTamSayCoBan = await prisma.spaService.create({
    data: {
      id: 'service-tam-say-co-ban',
      brandId: brandTamSay.id,
      name: 'Tắm & Sấy cơ bản',
      description: 'Tắm sạch bằng sữa tắm chuyên dụng, sấy khô và chải lông. Phù hợp cho thú cưng tắm định kỳ 1-2 tuần/lần.',
      price: 150000,
      durationMin: 60,
      isActive: true,
    }
  });

  const serviceTamSayCaoCap = await prisma.spaService.create({
    data: {
      id: 'service-tam-say-cao-cap',
      brandId: brandTamSay.id,
      name: 'Tắm & Sấy cao cấp',
      description: 'Tắm với sữa tắm dưỡng lông cao cấp, kem xả, sấy tạo kiểu. Bao gồm nước hoa thú cưng và băng rôn cổ.',
      price: 250000,
      durationMin: 90,
      isActive: true,
    }
  });

  await prisma.spaService.create({
    data: {
      id: 'service-cat-tia-yeu-cau',
      brandId: brandCatTia.id,
      name: 'Cắt tỉa lông theo yêu cầu',
      description: 'Cắt tỉa lông theo phong cách mong muốn, có thể mang ảnh mẫu. Bao gồm cắt lông mặt, tai, thân và chân.',
      price: 300000,
      durationMin: 90,
      isActive: true,
    }
  });

  await prisma.spaService.create({
    data: {
      id: 'service-cat-tia-co-ban',
      brandId: brandCatTia.id,
      name: 'Cắt tỉa lông cơ bản',
      description: 'Tỉa gọn các phần lông dài, cắt lông tai, vùng nhạy cảm và chân. Giữ form tự nhiên.',
      price: 180000,
      durationMin: 60,
      isActive: true,
    }
  });

  await prisma.spaService.create({
    data: {
      id: 'service-cham-soc-mong',
      brandId: brandMong.id,
      name: 'Chăm sóc móng vuốt',
      description: 'Cắt và mài móng vuốt an toàn, dũa nhẵn. Phòng ngừa móng cong gây đau khi đi lại.',
      price: 80000,
      durationMin: 30,
      isActive: true,
    }
  });

  await prisma.spaService.create({
    data: {
      id: 'service-ve-sinh-tai-rang',
      brandId: brandTaiRang.id,
      name: 'Vệ sinh tai và răng',
      description: 'Làm sạch ráy tai, đánh răng và xịt hơi thở thơm mát cho thú cưng.',
      price: 120000,
      durationMin: 45,
      isActive: true,
    }
  });

  await prisma.spaService.create({
    data: {
      id: 'service-massage-30',
      brandId: brandMassage.id,
      name: 'Massage thư giãn 30 phút',
      description: 'Massage toàn thân giúp thú cưng thư giãn, giảm stress, cải thiện tuần hoàn máu.',
      price: 200000,
      durationMin: 30,
      isActive: true,
    }
  });

  const serviceFullDay = await prisma.spaService.create({
    data: {
      id: 'service-full-day',
      brandId: brandCombo.id,
      name: 'Gói Spa Full Day',
      description: 'Tắm cao cấp + Cắt tỉa + Chăm sóc móng + Vệ sinh tai răng + Massage. Tiết kiệm 20% so với từng dịch vụ.',
      price: 680000,
      durationMin: 180,
      isActive: true,
    }
  });

  await prisma.spaService.create({
    data: {
      id: 'service-meo-premium',
      brandId: brandCombo.id,
      name: 'Gói Spa Mèo Premium',
      description: 'Tắm + Sấy + Cắt tỉa + Massage dành riêng cho mèo. Nhân viên được đào tạo chuyên biệt về tâm lý mèo.',
      price: 450000,
      durationMin: 120,
      isActive: true,
    }
  });

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
  await prisma.addressSpa.deleteMany({
    where: {
      id: { in: ['petmatch-spa-q1', 'petmatch-spa-bt', 'petmatch-spa-hk'] }
    }
  });

  const addressQ1 = await prisma.addressSpa.create({
    data: {
      id: 'petmatch-spa-q1',
      name: 'PetMatch Spa – Quận 1',
      description: 'Trung tâm chăm sóc sắc đẹp chính tại TP. HCM',
      address: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1',
      phone: '02899998888',
      status: ApprovalStatus.ACTIVE,
      managerId: managerUser.id,
    }
  });

  await prisma.addressSpa.create({
    data: {
      id: 'petmatch-spa-bt',
      name: 'PetMatch Spa – Bình Thạnh',
      description: 'Chi nhánh chăm sóc thú cưng tại Bình Thạnh',
      address: '45 Xô Viết Nghệ Tĩnh, Phường 21, Bình Thạnh',
      phone: '02899997777',
      status: ApprovalStatus.ACTIVE,
      managerId: managerUser.id,
    }
  });

  await prisma.addressSpa.create({
    data: {
      id: 'petmatch-spa-hk',
      name: 'PetMatch Spa – Hoàn Kiếm',
      description: 'Chi nhánh spa cao cấp tại Hà Nội',
      address: '78 Hàng Bông, Hoàn Kiếm',
      phone: '02499998888',
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

  await prisma.spaBooking.create({
    data: {
      id: 'demo-booking-1',
      brandId: brandCombo.id,
      addressSpaId: 'petmatch-spa-q1',
      serviceId: serviceFullDay.id,
      userId: clientUser.id,
      staffId: staffUser.id,
      petId: mochiPet.id,
      petName: 'Mochi',
      scheduledAt: date1,
      status: SpaBookingStatus.COMPLETED,
      priceSnapshot: serviceFullDay.price,
      note: 'Mochi hơi sợ máy sấy, làm nhẹ nhàng giúp mình nhé',
      petConditionAfter: 'Bé Mochi rất ngoan, hoàn thành tốt. Lông đẹp và thơm.',
      photoAfter: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=500&h=500&fit=crop',
    }
  });

  await prisma.spaBooking.create({
    data: {
      id: 'demo-booking-2',
      brandId: brandTamSay.id,
      addressSpaId: 'petmatch-spa-q1',
      serviceId: serviceTamSayCoBan.id,
      userId: clientUser.id,
      staffId: staffUser.id,
      petName: 'Titan',
      scheduledAt: date2,
      status: SpaBookingStatus.ASSIGNED,
      priceSnapshot: serviceTamSayCoBan.price,
      note: 'Titan nặng 30kg, cần 2 nhân viên hỗ trợ',
    }
  });

  await prisma.spaBooking.create({
    data: {
      id: 'demo-booking-3',
      brandId: brandTamSay.id,
      addressSpaId: 'petmatch-spa-q1',
      serviceId: serviceTamSayCoBan.id,
      userId: clientUser.id,
      staffId: staffUser.id,
      petId: lunaPet.id,
      petName: 'Luna',
      scheduledAt: date3,
      status: SpaBookingStatus.IN_PROGRESS,
      priceSnapshot: serviceTamSayCoBan.price,
      note: 'Luna thích được massage nhẹ khi sấy',
    }
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
