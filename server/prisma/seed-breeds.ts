import { PrismaClient, Species } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedBreedItem {
  species: Species;
  name: string;
  breedType: 'PUREBRED' | 'HYBRID';
  allowPedigree: boolean;
}

// Danh sách giống chó mặc định (bao gồm cả thuần chủng và giống lai/bản địa)
const defaultDogBreeds: SeedBreedItem[] = [
  { species: Species.DOG, name: 'Poodle', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.DOG, name: 'Corgi', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.DOG, name: 'Golden Retriever', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.DOG, name: 'Labrador', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.DOG, name: 'Husky', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.DOG, name: 'Shiba Inu', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.DOG, name: 'Pomeranian', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.DOG, name: 'Chihuahua', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.DOG, name: 'Beagle', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.DOG, name: 'Bulldog Pháp', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.DOG, name: 'Alaska', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.DOG, name: 'Samoyed', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.DOG, name: 'Chó Phú Quốc', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.DOG, name: 'Pug', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.DOG, name: 'Chó ta', breedType: 'HYBRID', allowPedigree: false },
  { species: Species.DOG, name: 'Chó lai', breedType: 'HYBRID', allowPedigree: false },
  { species: Species.DOG, name: 'Puggle', breedType: 'HYBRID', allowPedigree: false },
];

// Danh sách giống mèo mặc định (bao gồm cả thuần chủng và giống lai/bản địa)
const defaultCatBreeds: SeedBreedItem[] = [
  { species: Species.CAT, name: 'British Shorthair', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.CAT, name: 'Persian', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.CAT, name: 'Ragdoll', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.CAT, name: 'Maine Coon', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.CAT, name: 'Scottish Fold', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.CAT, name: 'Munchkin', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.CAT, name: 'Bengal', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.CAT, name: 'Siamese', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.CAT, name: 'Sphynx', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.CAT, name: 'Exotic Shorthair', breedType: 'PUREBRED', allowPedigree: true },
  { species: Species.CAT, name: 'Mèo ta', breedType: 'HYBRID', allowPedigree: false },
  { species: Species.CAT, name: 'Mèo lai', breedType: 'HYBRID', allowPedigree: false },
];

// Hàm khởi tạo hạt giống cho bảng giống thú cưng
async function seedBreeds() {
  console.log('--- Seeding default Dog and Cat breeds ---');

  for (const item of [...defaultDogBreeds, ...defaultCatBreeds]) {
    await prisma.breed.upsert({
      where: {
        species_name: {
          species: item.species,
          name: item.name,
        },
      },
      update: {
        breedType: item.breedType,
        allowPedigree: item.allowPedigree,
      },
      create: {
        species: item.species,
        name: item.name,
        breedType: item.breedType,
        allowPedigree: item.allowPedigree,
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
