const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const cuteNames = [
  'Mochi', 'Milo', 'Kiki', 'Luna', 'Bella', 
  'Boba', 'Cacao', 'Tofu', 'Coco', 'Sữa',
  'Bim Bim', 'Bánh Bao', 'Lucky', 'Leo', 'Moka'
];

async function main() {
  console.log('Bắt đầu đổi tên thú cưng thành các tên đáng yêu...');
  const pets = await prisma.pet.findMany();
  let updatedCount = 0;

  for (let i = 0; i < pets.length; i++) {
    const pet = pets[i];
    // Chọn tên ngẫu nhiên (hoặc xoay vòng)
    const newName = cuteNames[i % cuteNames.length];
    
    await prisma.pet.update({
      where: { id: pet.id },
      data: { name: newName }
    });
    
    console.log(`- Đổi tên: "${pet.name}" -> "${newName}"`);
    updatedCount++;
  }
  
  console.log(`✅ Hoàn tất! Đã đổi tên cho ${updatedCount} thú cưng.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
