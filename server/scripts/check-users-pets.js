const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    const users = await prisma.user.findMany({
      include: {
        pets: true,
      },
    });

    console.log(`=== TÌM THẤY ${users.length} NGƯỜI DÙNG TRONG DATABASE ===\n`);
    for (const u of users) {
      console.log(`User: ${u.name} | Email: ${u.email} | Role: ${u.role}`);
      if (u.pets.length > 0) {
        console.log(`  -> Số thú cưng: ${u.pets.length}`);
        u.pets.forEach((p) => {
          console.log(`     + Pet: [${p.gender}] ${p.name} (${p.breed}) - Sẵn sàng ghép đôi: ${p.isAvailableForMatching ? 'CÓ' : 'KHÔNG'}`);
        });
      } else {
        console.log(`  -> Không có thú cưng.`);
      }
      console.log('--------------------------------------------------');
    }
  } catch (err) {
    console.error('Lỗi truy vấn DB:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
