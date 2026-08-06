import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  try {
    const users = await prisma.user.findMany({
      include: {
        pets: true,
      },
    });
    console.log('Users and their pets:');
    users.forEach((u: any) => {
      console.log(`- User: ${u.email} (Name: ${u.name}), Role: ${u.role}`);
      if (u.pets.length === 0) {
        console.log('  No pets.');
      } else {
        u.pets.forEach((p: any) => {
          console.log(`  * Pet: ${p.name} (Species: ${p.species}, Breed: ${p.breed}, Weight: ${p.weight}kg)`);
        });
      }
    });
  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

check();
