import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('--- Checking Image URL Hosting Status ---');

    // 1. Users Avatars
    const users = await prisma.user.findMany({ select: { avatarUrl: true } });
    const userStats = { total: users.length, local: 0, cloudinary: 0, dataUrl: 0, other: 0, nulls: 0 };
    const otherUrls: string[] = [];
    for (const u of users) {
      if (!u.avatarUrl) userStats.nulls++;
      else if (u.avatarUrl.includes('res.cloudinary.com')) userStats.cloudinary++;
      else if (u.avatarUrl.startsWith('data:image/')) userStats.dataUrl++;
      else if (u.avatarUrl.includes('/uploads/') || u.avatarUrl.includes('localhost')) userStats.local++;
      else {
        userStats.other++;
        otherUrls.push(u.avatarUrl);
      }
    }

    // 2. Pets Gallery and Avatars
    const pets = await prisma.pet.findMany({ select: { avatarUrl: true, gallery: true } });
    const petStats = { total: pets.length, local: 0, cloudinary: 0, dataUrl: 0, other: 0, nulls: 0 };
    for (const p of pets) {
      const urls = [p.avatarUrl, ...p.gallery].filter(Boolean) as string[];
      if (urls.length === 0) petStats.nulls++;
      for (const url of urls) {
        if (url.includes('res.cloudinary.com')) petStats.cloudinary++;
        else if (url.startsWith('data:image/')) petStats.dataUrl++;
        else if (url.includes('/uploads/') || url.includes('localhost')) petStats.local++;
        else {
          petStats.other++;
          otherUrls.push(url);
        }
      }
    }

    // 3. Products
    const products = await prisma.product.findMany({ select: { imageUrl: true } });
    const productStats = { total: products.length, local: 0, cloudinary: 0, dataUrl: 0, other: 0, nulls: 0 };
    for (const p of products) {
      if (!p.imageUrl) productStats.nulls++;
      else if (p.imageUrl.includes('res.cloudinary.com')) productStats.cloudinary++;
      else if (p.imageUrl.startsWith('data:image/')) productStats.dataUrl++;
      else if (p.imageUrl.includes('/uploads/') || p.imageUrl.includes('localhost')) productStats.local++;
      else {
        productStats.other++;
        otherUrls.push(p.imageUrl);
      }
    }

    console.log('User Avatars Status:', userStats);
    console.log('Pet Images Status:', petStats);
    console.log('Product Images Status:', productStats);
    console.log('Sample Other URLs:', otherUrls.slice(0, 10));
    
  } catch (error) {
    console.error('Error running check script:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
