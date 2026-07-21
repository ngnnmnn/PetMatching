const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu làm sạch tên Giống (Breed) trong CSDL...');
  const pets = await prisma.pet.findMany();
  let updatedCount = 0;

  for (const pet of pets) {
    if (pet.breed && pet.breed.includes('(')) {
      // Extract the text inside the parentheses
      const match = pet.breed.match(/\(([^)]+)\)/);
      if (match && match[1]) {
        const englishName = match[1].trim();
        
        await prisma.pet.update({
          where: { id: pet.id },
          data: { breed: englishName }
        });
        
        console.log(`- Đổi giống: "${pet.breed}" -> "${englishName}"`);
        updatedCount++;
      }
    }
  }
  
  console.log(`✅ Hoàn tất! Đã đổi tên giống sang tiếng Anh cho ${updatedCount} thú cưng.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
