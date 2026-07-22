import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { basename, join } from 'path';

config({ path: ['.env', 'db.env'], override: false });

const prisma = new PrismaClient();
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error('Cloudinary environment variables are missing.');
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

let migrated = 0;
let skippedMissingFiles = 0;

function localUploadPath(value: string): string | null {
  if (!value.includes('/uploads/')) return null;
  try {
    const filename = basename(new URL(value).pathname);
    const path = join(process.cwd(), 'uploads', filename);
    return existsSync(path) ? path : null;
  } catch {
    return null;
  }
}

async function migrateValue(value: string | null, folder: string) {
  if (!value) return value;

  const isDataUrl = value.startsWith('data:image/');
  const localPath = localUploadPath(value);
  if (!isDataUrl && !localPath) {
    if (value.includes('/uploads/')) skippedMissingFiles += 1;
    return value;
  }

  const result = await cloudinary.uploader.upload(localPath ?? value, {
    folder,
    resource_type: 'image',
    unique_filename: true,
    overwrite: false,
    quality: 'auto:good',
    fetch_format: 'auto',
    transformation: [{ width: 2000, height: 2000, crop: 'limit' }],
  });
  migrated += 1;
  return result.secure_url;
}

async function migrateArray(values: string[], folder: string) {
  return Promise.all(
    values.map(async (value) => (await migrateValue(value, folder)) ?? value),
  );
}

async function main() {
  const users = await prisma.user.findMany({
    where: { avatarUrl: { not: null } },
    select: { id: true, avatarUrl: true },
  });
  for (const user of users) {
    const avatarUrl = await migrateValue(
      user.avatarUrl,
      `petmatching/users/${user.id}/avatars`,
    );
    if (avatarUrl !== user.avatarUrl) {
      await prisma.user.update({ where: { id: user.id }, data: { avatarUrl } });
    }
  }

  const pets = await prisma.pet.findMany({
    select: { id: true, ownerId: true, avatarUrl: true, gallery: true },
  });
  for (const pet of pets) {
    const baseFolder = `petmatching/users/${pet.ownerId}/pets/${pet.id}`;
    const avatarUrl = await migrateValue(pet.avatarUrl, `${baseFolder}/avatar`);
    const gallery = await migrateArray(pet.gallery, `${baseFolder}/gallery`);
    if (avatarUrl !== pet.avatarUrl || gallery.some((url, i) => url !== pet.gallery[i])) {
      await prisma.pet.update({
        where: { id: pet.id },
        data: { avatarUrl, gallery },
      });
    }
  }

  const documents = await prisma.petDocument.findMany({
    select: { id: true, petId: true, type: true, imageUrls: true },
  });
  for (const document of documents) {
    const imageUrls = await migrateArray(
      document.imageUrls,
      `petmatching/pets/${document.petId}/documents/${document.type.toLowerCase()}`,
    );
    if (imageUrls.some((url, i) => url !== document.imageUrls[i])) {
      await prisma.petDocument.update({
        where: { id: document.id },
        data: { imageUrls },
      });
    }
  }

  const products = await prisma.product.findMany({
    select: { id: true, imageUrl: true, images: true },
  });
  for (const product of products) {
    const folder = `petmatching/products/${product.id}`;
    const imageUrl = await migrateValue(product.imageUrl, folder);
    const images = await migrateArray(product.images, `${folder}/gallery`);
    if (imageUrl !== product.imageUrl || images.some((url, i) => url !== product.images[i])) {
      await prisma.product.update({
        where: { id: product.id },
        data: { imageUrl, images },
      });
    }
  }

  const bookings = await prisma.spaBooking.findMany({
    where: { photoAfter: { not: null } },
    select: { id: true, photoAfter: true },
  });
  for (const booking of bookings) {
    const photoAfter = await migrateValue(
      booking.photoAfter,
      `petmatching/spa-results/${booking.id}`,
    );
    if (photoAfter !== booking.photoAfter) {
      await prisma.spaBooking.update({
        where: { id: booking.id },
        data: { photoAfter },
      });
    }
  }

  console.log(`Migrated ${migrated} image(s) to Cloudinary.`);
  if (skippedMissingFiles) {
    console.warn(
      `Skipped ${skippedMissingFiles} local upload URL(s) because the source file was missing.`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
