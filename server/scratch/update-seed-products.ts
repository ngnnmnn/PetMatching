import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(__dirname, '../prisma/seed-products.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Replace originalPrice: 123, with sellingPrice: 123,\n      importPrice: 61.5,
// Using regex to capture the price value
content = content.replace(/originalPrice:\s*(\d+)/g, (match, priceStr) => {
  const price = parseInt(priceStr, 10);
  const importPrice = Math.round(price / 2);
  return `sellingPrice: ${price},\n      importPrice: ${importPrice}`;
});

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Successfully updated seed-products.ts');
