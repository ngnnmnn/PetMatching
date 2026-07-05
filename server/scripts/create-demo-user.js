const {
  BreedingOption,
  Gender,
  PetStatus,
  PrismaClient,
  Species,
  UserRole,
  VerificationBadge,
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

  await prisma.pet.upsert({
    where: { slug: 'demo-luna-corgi-female' },
    update: {
      ownerId: user.id,
      status: PetStatus.ACTIVE,
      isActive: true,
      isAvailableForMatching: false,
    },
    create: {
      ownerId: user.id,
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

  await prisma.pet.upsert({
    where: { slug: 'demo-mochi-corgi-male' },
    update: {
      ownerId: user.id,
      status: PetStatus.ACTIVE,
      isActive: true,
      isAvailableForMatching: true,
    },
    create: {
      ownerId: user.id,
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

  console.log('Demo account is ready:');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`User ID: ${user.id}`);
  console.log('Demo pets and matching candidates are ready.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
