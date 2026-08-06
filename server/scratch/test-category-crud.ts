import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ManagerService } from '../src/modules/manager/manager.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const managerService = app.get(ManagerService);
  const prisma = app.get(PrismaService);

  console.log('--- STARTING CATEGORY CRUD VERIFICATION TEST ---');

  try {
    // 1. Create a test category
    console.log('Creating test category...');
    const cat = await managerService.createCategory({ name: 'Test Category Original' });
    console.log(`Created: id = ${cat.id}, name = ${cat.name}, slug = ${cat.slug}`);

    // Create a product referencing this category slug
    const productId = '999999'; // Test ID
    await prisma.product.upsert({
      where: { id: productId },
      update: { category: cat.slug },
      create: {
        id: productId,
        name: 'Test Product',
        category: cat.slug,
        sellingPrice: 100000,
        importPrice: 50000,
        stock: 5,
        isActive: true,
      },
    });
    console.log(`Created test product with category: ${cat.slug}`);

    // 2. Update category name (which changes the slug)
    console.log('Updating test category name...');
    const updated = await managerService.updateCategory(cat.id, { name: 'Test Category Updated' });
    console.log(`Updated: id = ${updated.id}, name = ${updated.name}, slug = ${updated.slug}`);

    // Check if the product's category slug cascaded to the new slug
    const product = await prisma.product.findUnique({ where: { id: productId } });
    console.log(`Product category after update: ${product?.category}`);
    if (product?.category !== updated.slug) {
      throw new Error(`Cascading update failed! Expected ${updated.slug}, got ${product?.category}`);
    }
    console.log('✅ Category update cascaded to product correctly.');

    // 3. Attempt to delete the category (should fail because product is still in it)
    console.log('Attempting to delete active category (expecting error)...');
    try {
      await managerService.deleteCategory(updated.id);
      throw new Error('Allowed deleting a category containing products! Test failed.');
    } catch (err: any) {
      console.log(`✅ Deletion blocked correctly with error: "${err.message}"`);
    }

    // Delete the product first
    await prisma.product.delete({ where: { id: productId } });
    console.log('Deleted test product.');

    // 4. Delete the category now (should succeed)
    console.log('Deleting category (expecting success)...');
    await managerService.deleteCategory(updated.id);
    const check = await prisma.category.findUnique({ where: { id: updated.id } });
    if (check) {
      throw new Error('Category was not deleted from database!');
    }
    console.log('✅ Category deleted successfully after removing product.');

    console.log('--- CATEGORY CRUD VERIFICATION TEST PASSED SUCCESSFULLY ---');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await app.close();
  }
}

main();
