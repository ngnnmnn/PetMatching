const { PrismaClient, UserRole } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const staffEmail = 'lan@spa.petmatch.vn';
  const staffPassword = 'spa123';
  const staffPasswordHash = await bcrypt.hash(staffPassword, 10);
  const staffName = 'Phạm Thị Lan';
  const staffPhone = '0955555555';

  console.log(`Creating staff account: ${staffEmail}...`);

  const user = await prisma.user.upsert({
    where: { email: staffEmail },
    update: {
      passwordHash: staffPasswordHash,
      name: staffName,
      phone: staffPhone,
      role: UserRole.SPA_STAFF,
      isVerified: true,
      accountStatus: 'ACTIVE',
    },
    create: {
      email: staffEmail,
      passwordHash: staffPasswordHash,
      name: staffName,
      phone: staffPhone,
      role: UserRole.SPA_STAFF,
      isVerified: true,
      accountStatus: 'ACTIVE',
    },
  });

  const addressSpa = await prisma.addressSpa.findFirst();
  const addressSpaId = addressSpa ? addressSpa.id : 'petmatch-spa-q1';

  const spaStaff = await prisma.spaStaff.upsert({
    where: { userId: user.id },
    update: {
      addressSpaId: addressSpaId,
    },
    create: {
      id: `spaStaff_${user.id}`,
      userId: user.id,
      addressSpaId: addressSpaId,
    },
  });

  console.log('✅ Staff account created successfully:');
  console.log(`- Email: ${user.email}`);
  console.log(`- Password: ${staffPassword}`);
  console.log(`- Name: ${user.name}`);
  console.log(`- Role: ${user.role}`);
  console.log(`- User ID: ${user.id}`);
  console.log(`- Spa Branch ID: ${spaStaff.addressSpaId}`);
}

main()
  .catch((e) => {
    console.error('Error creating staff user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
