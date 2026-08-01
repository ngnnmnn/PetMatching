import { PrismaClient, Species } from '@prisma/client';

const prisma = new PrismaClient();

const defaultDogBreeds = [
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

const defaultCatBreeds = [
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

async function seedBreeds() {
  console.log('--- Seeding default Dog and Cat breeds ---');

  for (const name of defaultDogBreeds) {
    await prisma.breed.upsert({
      where: {
        species_name: {
          species: Species.DOG,
          name,
        },
      },
      update: {},
      create: {
        species: Species.DOG,
        name,
        isActive: true,
      },
    });
  }

  for (const name of defaultCatBreeds) {
    await prisma.breed.upsert({
      where: {
        species_name: {
          species: Species.CAT,
          name,
        },
      },
      update: {},
      create: {
        species: Species.CAT,
        name,
        isActive: true,
      },
    });
  }

  console.log('✓ Breeds seeded successfully!');
}

seedBreeds()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
