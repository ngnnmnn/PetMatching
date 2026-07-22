import { execSync } from 'child_process';
import * as path from 'path';

async function main() {
  const prismaDir = __dirname;
  
  console.log('--- Running seed-products.ts ---');
  execSync(`npx ts-node "${path.join(prismaDir, 'seed-products.ts')}"`, { stdio: 'inherit' });
  
  console.log('\n--- Running seed-orders.ts ---');
  execSync(`npx ts-node "${path.join(prismaDir, 'seed-orders.ts')}"`, { stdio: 'inherit' });

  console.log('\n--- Running seed-breed-rules.ts ---');
  execSync(`npx ts-node "${path.join(prismaDir, 'seed-breed-rules.ts')}"`, { stdio: 'inherit' });

  console.log('\n--- Running seed-spa.ts ---');
  execSync(`npx ts-node "${path.join(prismaDir, 'seed-spa.ts')}"`, { stdio: 'inherit' });

  console.log('\n--- Running create-demo-user.js ---');
  execSync(`node "${path.join(prismaDir, '../scripts/create-demo-user.js')}"`, { stdio: 'inherit' });
  
  console.log('\nDatabase seeding completed successfully!');
}

main().catch((error) => {
  console.error('Error during seeding:', error);
  process.exit(1);
});
