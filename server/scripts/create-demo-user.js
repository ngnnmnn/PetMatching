const { PrismaClient, UserRole } = require('@prisma/client');
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

  console.log('Demo account is ready:');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`User ID: ${user.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
