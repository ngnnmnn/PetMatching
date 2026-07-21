const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu làm sạch tên Pet trong CSDL...');
  const pets = await prisma.pet.findMany();
  let updatedCount = 0;

  for (const pet of pets) {
    if (pet.name.includes('(')) {
      // Thay thế phần trong ngoặc tròn và khoảng trắng thừa xung quanh
      const newName = pet.name.replace(/\s*\(.*?\)\s*/g, '').trim();
      
      await prisma.pet.update({
        where: { id: pet.id },
        data: { name: newName }
      });
      
      console.log(`- Đổi tên: "${pet.name}" -> "${newName}"`);
      updatedCount++;
    }
  }
  
  console.log(`✅ Hoàn tất! Đã làm sạch tên cho ${updatedCount} thú cưng.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
